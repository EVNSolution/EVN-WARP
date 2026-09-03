#!/usr/bin/env python3
"""Fail deployment on unreviewed High/Critical npm advisories."""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).parents[1]
REVIEW_BY = dt.date(2026, 10, 1)
ALLOWED_ADVISORIES = {
    1138808: "image-size ICNS parser denial of service",
    1138809: "image-size JXL/HEIF parser denial of service",
    1145093: "deepmerge-ts recursive graph stack exhaustion",
    1153173: "mysql2 auth plugin downgrade leaks plaintext credentials",
    1158532: "mysql2 additional vulnerability (transitive via Prisma, no MySQL connection in WARP)",
}
IMAGE_ADVISORIES = {1138808, 1138809}
PRISMA_ADVISORIES = {1145093}
MYSQL2_ADVISORIES = {1153173, 1158532}
MYSQL2_VERSION = "3.15.3"
EXPECTED_PPTX_IMPORTS = {
    "app/api/a3/[id]/export/route.ts",
    "scripts/sample-ppt.ts",
}
EXPECTED_PRISMA_CONFIG_SHA256 = (
    "c1bcbd0ff267c8b6885cd467ed8122cf6508bdac6c929d69f9b512ccde65a033"
)


class AuditPolicyError(RuntimeError):
    pass


def leaf_advisories(report: dict) -> dict[int, dict]:
    vulnerabilities = report.get("vulnerabilities", {})
    leaves: dict[int, dict] = {}

    def visit(package: str, stack: tuple[str, ...] = ()) -> set[int]:
        if package in stack:
            raise AuditPolicyError(f"cyclic npm audit graph at {package}")
        vulnerability = vulnerabilities.get(package)
        if not isinstance(vulnerability, dict):
            raise AuditPolicyError(f"missing npm audit node for {package}")
        resolved: set[int] = set()
        for entry in vulnerability.get("via", []):
            if isinstance(entry, str):
                resolved.update(visit(entry, stack + (package,)))
            elif isinstance(entry, dict) and isinstance(entry.get("source"), int):
                leaves[entry["source"]] = entry
                resolved.add(entry["source"])
            else:
                raise AuditPolicyError(f"unrecognized npm audit entry for {package}")
        if not resolved:
            raise AuditPolicyError(f"High/Critical npm audit node has no advisory source: {package}")
        return resolved

    for package, vulnerability in vulnerabilities.items():
        if vulnerability.get("severity") in {"high", "critical"}:
            visit(package)
    return leaves


def validate_audit(report: dict) -> set[int]:
    metadata = report.get("metadata", {}).get("vulnerabilities", {})
    if metadata.get("critical", 0):
        raise AuditPolicyError("Critical npm advisory detected")

    leaves = leaf_advisories(report)
    unknown = set(leaves) - set(ALLOWED_ADVISORIES)
    if unknown:
        details = ", ".join(
            f"{source}:{leaves[source].get('dependency', 'unknown')}" for source in sorted(unknown)
        )
        raise AuditPolicyError(f"unreviewed High npm advisory detected: {details}")
    return set(leaves)


def package_versions() -> dict[str, str | None]:
    lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
    packages = lock.get("packages", {})
    names = (
        "prisma",
        "@prisma/client",
        "@prisma/adapter-libsql",
        "@prisma/config",
        "deepmerge-ts",
        "pptxgenjs",
        "image-size",
    )
    return {
        name: packages.get(f"node_modules/{name}", {}).get("version") for name in names
    }


def validate_image_control() -> None:
    versions = package_versions()
    expected = {"pptxgenjs": "4.0.1", "image-size": "1.2.1"}
    if any(versions[name] != version for name, version in expected.items()):
        raise AuditPolicyError("PptxGenJS advisory topology changed; review the control")

    lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
    root_dependencies = lock.get("packages", {}).get("", {}).get("dependencies", {})
    if "image-size" in root_dependencies:
        raise AuditPolicyError("image-size must remain transitive to the controlled PPTX surface")

    imports: set[str] = set()
    add_image = re.compile(r"(?:\.\s*addImage\b|\[\s*['\"]addImage['\"]\s*\])")
    pptx_import = re.compile(
        r"(?:from\s+['\"]pptxgenjs['\"]|require\(\s*['\"]pptxgenjs['\"]\s*\)|import\(\s*['\"]pptxgenjs['\"]\s*\))"
    )
    for directory in ("app", "lib", "scripts"):
        for path in (ROOT / directory).rglob("*"):
            if path.suffix not in {".js", ".mjs", ".cjs", ".ts", ".tsx"}:
                continue
            content = path.read_text(encoding="utf-8")
            relative = path.relative_to(ROOT).as_posix()
            if pptx_import.search(content):
                imports.add(relative)
            if add_image.search(content):
                raise AuditPolicyError(f"PptxGenJS image input requires a new security review: {relative}")
    if imports != EXPECTED_PPTX_IMPORTS:
        raise AuditPolicyError(f"PptxGenJS import surface changed: {sorted(imports)}")


def validate_mysql2_control() -> None:
    lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
    pkg = lock.get("packages", {}).get("node_modules/mysql2", {})
    if pkg.get("version") != MYSQL2_VERSION:
        raise AuditPolicyError("mysql2 advisory topology changed; review the control")
    root_dependencies = lock.get("packages", {}).get("", {}).get("dependencies", {})
    root_dev_dependencies = lock.get("packages", {}).get("", {}).get("devDependencies", {})
    if "mysql2" in root_dependencies or "mysql2" in root_dev_dependencies:
        raise AuditPolicyError("mysql2 must remain transitive; direct dependency requires a new security review")
    for directory in ("app", "lib", "scripts"):
        for path in (ROOT / directory).rglob("*"):
            if path.suffix not in {".js", ".mjs", ".cjs", ".ts", ".tsx"}:
                continue
            if "mysql2" in path.read_text(encoding="utf-8"):
                raise AuditPolicyError(f"mysql2 import found in WARP source; credential leak reachability requires review: {path}")


def validate_prisma_control() -> None:
    versions = package_versions()
    expected = {
        "prisma": "7.9.1",
        "@prisma/client": "7.9.1",
        "@prisma/adapter-libsql": "7.9.1",
        "@prisma/config": "7.9.1",
        "deepmerge-ts": "7.1.5",
    }
    if any(versions[name] != version for name, version in expected.items()):
        raise AuditPolicyError("Prisma advisory topology changed; review the control")
    digest = hashlib.sha256((ROOT / "prisma.config.ts").read_bytes()).hexdigest()
    if digest != EXPECTED_PRISMA_CONFIG_SHA256:
        raise AuditPolicyError("Prisma config changed; recursive merge reachability must be reviewed")


def enforce(report: dict, today: dt.date | None = None) -> set[int]:
    allowed = validate_audit(report)
    if not allowed:
        return allowed
    if (today or dt.date.today()) > REVIEW_BY:
        raise AuditPolicyError(f"compensating control expired on {REVIEW_BY.isoformat()}")
    if allowed & IMAGE_ADVISORIES:
        validate_image_control()
    if allowed & PRISMA_ADVISORIES:
        validate_prisma_control()
    if allowed & MYSQL2_ADVISORIES:
        validate_mysql2_control()
    return allowed


def main() -> int:
    result = subprocess.run(
        ["npm", "audit", "--omit=dev", "--audit-level=high", "--json"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    try:
        report = json.loads(result.stdout)
        allowed = enforce(report)
    except (json.JSONDecodeError, AuditPolicyError, OSError) as error:
        print(f"security_audit=failed reason={error}", file=sys.stderr)
        return 1

    counts = report.get("metadata", {}).get("vulnerabilities", {})
    print(
        "security_audit=passed "
        f"critical={counts.get('critical', 0)} "
        f"high_packages={counts.get('high', 0)} "
        f"reviewed_advisories={','.join(map(str, sorted(allowed))) or 'none'} "
        f"review_by={REVIEW_BY.isoformat() if allowed else 'not-required'}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
