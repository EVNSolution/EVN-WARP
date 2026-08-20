#!/usr/bin/env python3
"""Apply reviewed, forward-only SQLite migrations with backup and checksums."""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import re
import sqlite3
from pathlib import Path


HISTORY_TABLE = "_WarpSchemaMigration"
AUDIT_ID = re.compile(r"[a-z0-9][a-z0-9._-]{2,63}")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def statements(sql: str):
    pending = ""
    for line in sql.splitlines(keepends=True):
        pending += line
        if sqlite3.complete_statement(pending):
            if pending.strip():
                yield pending
            pending = ""
    if pending.strip():
        raise RuntimeError("migration has an incomplete SQL statement")


def require_healthy(connection: sqlite3.Connection) -> None:
    result = connection.execute("PRAGMA quick_check").fetchone()
    if result != ("ok",):
        raise RuntimeError(f"SQLite quick_check failed: {result}")


def load_manifest(directory: Path) -> dict:
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    if not manifest.get("prismaSchemaSha256"):
        raise RuntimeError("schema migration manifest is missing prismaSchemaSha256")
    return manifest


def load_privacy_preflights(directory: Path, manifest: dict, migrations: set[str]) -> dict[str, dict]:
    entries = manifest.get("privacyPreflights", [])
    if not isinstance(entries, list):
        raise RuntimeError("privacyPreflights must be a list")

    contracts = {}
    audit_ids = set()
    root = directory.resolve()
    for entry in entries:
        if not isinstance(entry, dict):
            raise RuntimeError("privacy preflight entry must be an object")
        migration = entry.get("migration")
        audit_id = entry.get("auditId")
        query_name = entry.get("query")
        expected_digest = entry.get("sha256")
        if not isinstance(migration, str) or migration not in migrations:
            raise RuntimeError("privacy preflight references an unknown migration")
        if migration in contracts:
            raise RuntimeError("privacy preflight migration is duplicated")
        if not isinstance(audit_id, str) or not AUDIT_ID.fullmatch(audit_id):
            raise RuntimeError("privacy preflight auditId is invalid")
        if audit_id in audit_ids:
            raise RuntimeError("privacy preflight auditId is duplicated")
        if not isinstance(query_name, str):
            raise RuntimeError("privacy preflight query is missing")
        query_relative = Path(query_name)
        query_path = (directory / query_relative).resolve()
        if not query_relative.parts or query_relative.parts[0] != "privacy-preflights":
            raise RuntimeError(f"privacy preflight query path is invalid: {audit_id}")
        if root not in query_path.parents or not query_path.is_file():
            raise RuntimeError(f"privacy preflight query is missing: {audit_id}")
        if not isinstance(expected_digest, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_digest):
            raise RuntimeError(f"privacy preflight digest is invalid: {audit_id}")
        if digest(query_path) != expected_digest:
            raise RuntimeError(f"privacy preflight checksum changed: {audit_id}")
        contracts[migration] = {"audit_id": audit_id, "query": query_path}
        audit_ids.add(audit_id)
    return contracts


def run_privacy_preflights(connection: sqlite3.Connection, pending: list[Path], contracts: dict[str, dict]) -> list[tuple[str, str]]:
    relevant = [(path.name, contracts[path.name]) for path in pending if path.name in contracts]
    if not relevant:
        return []

    passed = []
    connection.execute("PRAGMA query_only = ON")
    try:
        for migration, contract in relevant:
            audit_id = contract["audit_id"]
            query = contract["query"].read_text(encoding="utf-8")
            if not re.match(r"\s*(SELECT|WITH)\b", query, re.IGNORECASE):
                raise RuntimeError(f"privacy preflight must be a read-only query: {audit_id}")
            rows = connection.execute(query).fetchall()
            if len(rows) != 1 or len(rows[0]) != 1 or type(rows[0][0]) is not int or rows[0][0] < 0:
                raise RuntimeError(f"privacy preflight must return one non-negative integer: {audit_id}")
            if rows[0][0] != 0:
                raise RuntimeError(f"privacy preflight blocked: {audit_id} violations={rows[0][0]}")
            passed.append((audit_id, migration))
    finally:
        connection.execute("PRAGMA query_only = OFF")
    return passed


def verify_objects(connection: sqlite3.Connection, manifest: dict) -> None:
    for kind, names in (("table", manifest.get("requiredTables", [])), ("index", manifest.get("requiredIndexes", []))):
        existing = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = ?", (kind,)
            )
        }
        missing = sorted(set(names) - existing)
        if missing:
            raise RuntimeError(f"required SQLite {kind}s are missing: {', '.join(missing)}")
    for table, expected in manifest.get("requiredColumns", {}).items():
        actual = [row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')]
        if actual != expected:
            raise RuntimeError(f"required SQLite columns do not match for {table}")


def print_evidence(applied: list[Path], backup: Path | None, preflights: list[tuple[str, str]]) -> None:
    print("migration_engine=sqlite-custom")
    print(f"migration_ledger={HISTORY_TABLE}")
    print(f"migration_applied_count={len(applied)}")
    print(f"migration_backup={backup or 'none'}")
    print("migration_checksum_validation=passed")
    print("migration_schema_validation=passed")
    print("migration_required_objects_validation=passed")
    print("migration_before_candidate=true")
    print(f"privacy_preflight_count={len(preflights)}")
    print("privacy_preflight_validation=passed")
    for audit_id, migration in preflights:
        print(f"privacy_preflight={audit_id}:{migration}:0")
    for path in applied:
        print(f"migration_file={path.name}")


def apply_migrations(database: Path, directory: Path, backups: Path, revision: str) -> tuple[list[str], Path | None]:
    if not database.is_file():
        raise RuntimeError(f"database is missing: {database}")
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise RuntimeError("source revision must be a full lowercase Git SHA")
    files = sorted(directory.glob("*.sql"))
    if not files:
        raise RuntimeError(f"no schema migrations found in {directory}")
    manifest = load_manifest(directory)
    checksums = {path.name: digest(path) for path in files}
    preflight_contracts = load_privacy_preflights(directory, manifest, set(checksums))

    connection = sqlite3.connect(database, timeout=30)
    connection.execute("PRAGMA busy_timeout = 30000")
    try:
        require_healthy(connection)
        history_exists = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (HISTORY_TABLE,)
        ).fetchone()
        applied = [] if not history_exists else connection.execute(
            f'SELECT "name", "sha256" FROM "{HISTORY_TABLE}" ORDER BY "name"'
        ).fetchall()

        names = [path.name for path in files]
        applied_names = [name for name, _ in applied]
        if applied_names != names[: len(applied_names)]:
            raise RuntimeError("applied migrations are not a prefix of the reviewed migration set")
        for name, recorded in applied:
            if checksums.get(name) != recorded:
                raise RuntimeError(f"applied migration checksum changed: {name}")

        pending = files[len(applied_names) :]
        if not pending:
            verify_objects(connection, manifest)
            print_evidence([], None, [])
            return [], None

        backups.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S-%f")
        backup = backups / f"dev-{timestamp}-pre-schema-{revision[:12]}.db"
        target = sqlite3.connect(backup)
        try:
            connection.backup(target)
        finally:
            target.close()
        os.chmod(backup, 0o600)

        passed_preflights = []
        try:
            connection.execute("BEGIN EXCLUSIVE")
            passed_preflights = run_privacy_preflights(connection, pending, preflight_contracts)
            connection.execute(
                f'''CREATE TABLE IF NOT EXISTS "{HISTORY_TABLE}" (
                    "name" TEXT NOT NULL PRIMARY KEY,
                    "sha256" TEXT NOT NULL,
                    "sourceRevision" TEXT NOT NULL,
                    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                )'''
            )
            for path in pending:
                for statement in statements(path.read_text(encoding="utf-8")):
                    connection.execute(statement)
                connection.execute(
                    f'INSERT INTO "{HISTORY_TABLE}" ("name", "sha256", "sourceRevision") VALUES (?, ?, ?)',
                    (path.name, checksums[path.name], revision),
                )
            connection.commit()
        except Exception:
            connection.rollback()
            raise

        require_healthy(connection)
        verify_objects(connection, manifest)
        print_evidence(pending, backup, passed_preflights)
        return [path.name for path in pending], backup
    finally:
        connection.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("database", type=Path)
    parser.add_argument("migrations", type=Path)
    parser.add_argument("backups", type=Path)
    parser.add_argument("revision")
    args = parser.parse_args()
    apply_migrations(args.database, args.migrations, args.backups, args.revision)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
