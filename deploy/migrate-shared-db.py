#!/usr/bin/env python3
"""Atomically move the legacy SQLite path behind a shared-directory symlink."""

from __future__ import annotations

import argparse
import os
import sqlite3
from pathlib import Path


def migrate(source: Path, target: Path) -> bool:
    if source.is_symlink():
        if source.resolve() != target.resolve():
            raise RuntimeError(f"unexpected database symlink target: {source}")
        return False
    if not source.is_file():
        raise RuntimeError(f"legacy database is missing: {source}")
    if target.exists():
        raise RuntimeError(f"shared database target already exists: {target}")
    if source.stat().st_dev != target.parent.stat().st_dev:
        raise RuntimeError("legacy and shared database paths must be on the same filesystem")

    temporary_link = source.with_name(source.name + ".shared-link")
    connection = sqlite3.connect(source, timeout=30)
    linked = False
    try:
        connection.execute("BEGIN EXCLUSIVE")
        os.link(source, target)
        linked = True
        os.symlink(target, temporary_link)
        os.replace(temporary_link, source)
        connection.commit()
    except Exception:
        connection.rollback()
        if temporary_link.is_symlink():
            temporary_link.unlink()
        if linked and target.exists() and not source.is_symlink():
            target.unlink()
        raise
    finally:
        connection.close()
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    args = parser.parse_args()
    changed = migrate(args.source, args.target)
    print("shared_database_migrated=" + str(changed).lower())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
