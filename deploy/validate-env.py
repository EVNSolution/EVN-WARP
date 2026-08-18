#!/usr/bin/env python3
"""Validate WARP dotenv files without printing values."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


KEY = re.compile(r"^[A-Z][A-Z0-9_]*$")
REQUIRED = (
    "DATABASE_URL",
    "AUTH_SECRET",
    "AUTH_TRUST_HOST",
    "AUTH_URL",
    "NEXTAUTH_URL",
    "UPLOADS_DIR",
)
OPTIONAL_URLS = ("BUILDUP_API_BASE_URL",)


def unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def parse_env(path: Path) -> tuple[dict[str, str], list[str]]:
    values: dict[str, str] = {}
    errors: list[str] = []
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            errors.append(f"line {number}: expected KEY=VALUE")
            continue
        key, value = (part.strip() for part in line.split("=", 1))
        if not KEY.fullmatch(key):
            errors.append(f"line {number}: invalid key name")
            continue
        if key in values:
            errors.append(f"line {number}: duplicate key {key}")
            continue
        values[key] = unquote(value)
    return values, errors


def is_url(value: str, allow_http: bool) -> bool:
    parsed = urlparse(value)
    schemes = {"https"} | ({"http"} if allow_http else set())
    return parsed.scheme in schemes and bool(parsed.netloc)


def validate(values: dict[str, str], allow_http: bool = False) -> list[str]:
    errors = [f"missing or empty key {key}" for key in REQUIRED if not values.get(key, "").strip()]
    if values.get("AUTH_SECRET") and len(values["AUTH_SECRET"]) < 32:
        errors.append("AUTH_SECRET must contain at least 32 characters")
    if values.get("AUTH_TRUST_HOST", "").lower() != "true":
        errors.append("AUTH_TRUST_HOST must be true")
    for key in ("AUTH_URL", "NEXTAUTH_URL"):
        if values.get(key) and not is_url(values[key], allow_http):
            errors.append(f"{key} must be a valid {'HTTP or HTTPS' if allow_http else 'HTTPS'} URL")
    database_url = values.get("DATABASE_URL", "")
    if database_url and not database_url.startswith(("file:", "libsql:")):
        errors.append("DATABASE_URL must use file: or libsql:")
    uploads_dir = values.get("UPLOADS_DIR", "")
    if uploads_dir and not Path(uploads_dir).is_absolute():
        errors.append("UPLOADS_DIR must be an absolute path")
    for key in OPTIONAL_URLS:
        if values.get(key) and not is_url(values[key], allow_http):
            errors.append(f"{key} must be a valid {'HTTP or HTTPS' if allow_http else 'HTTPS'} URL when set")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("env_file", type=Path)
    parser.add_argument("--allow-http", action="store_true")
    args = parser.parse_args()

    try:
        values, errors = parse_env(args.env_file)
    except (OSError, UnicodeError) as error:
        print(f"ENV validation failed: {error}", file=sys.stderr)
        return 1
    errors.extend(validate(values, args.allow_http))
    if errors:
        for error in errors:
            print(f"ENV validation failed: {error}", file=sys.stderr)
        return 1

    configured_optional = sorted(key for key in values if key not in REQUIRED and values[key])
    print(f"ENV validation passed: {len(values)} keys")
    print("required=" + ",".join(REQUIRED))
    print("optional_configured=" + (",".join(configured_optional) if configured_optional else "none"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
