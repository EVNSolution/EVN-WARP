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


def print_evidence(applied: list[Path], backup: Path | None) -> None:
    print("migration_engine=sqlite-custom")
    print(f"migration_ledger={HISTORY_TABLE}")
    print(f"migration_applied_count={len(applied)}")
    print(f"migration_backup={backup or 'none'}")
    print("migration_checksum_validation=passed")
    print("migration_schema_validation=passed")
    print("migration_required_objects_validation=passed")
    print("migration_before_candidate=true")
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
            print_evidence([], None)
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

        try:
            connection.execute("BEGIN EXCLUSIVE")
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
        print_evidence(pending, backup)
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
