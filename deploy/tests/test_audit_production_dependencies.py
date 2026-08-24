import datetime as dt
import importlib.util
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[2]
SPEC = importlib.util.spec_from_file_location(
    "audit_production_dependencies", ROOT / "deploy/audit_production_dependencies.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


def report(source: int = 1145093) -> dict:
    return {
        "vulnerabilities": {
            "prisma": {"severity": "high", "via": ["@prisma/config"]},
            "@prisma/config": {"severity": "high", "via": ["deepmerge-ts"]},
            "deepmerge-ts": {
                "severity": "high",
                "via": [
                    {
                        "source": source,
                        "dependency": "deepmerge-ts",
                        "severity": "high",
                    }
                ],
            },
        },
        "metadata": {"vulnerabilities": {"critical": 0, "high": 3}},
    }


class ProductionDependencyAuditTest(unittest.TestCase):
    def test_known_advisory_requires_current_repository_control(self):
        allowed = MODULE.enforce(report(), today=dt.date(2026, 8, 24))
        self.assertEqual(allowed, {1145093})

    def test_unknown_high_advisory_is_rejected(self):
        with self.assertRaisesRegex(MODULE.AuditPolicyError, "unreviewed High"):
            MODULE.enforce(report(9999999), today=dt.date(2026, 8, 24))

    def test_high_node_without_advisory_source_is_rejected(self):
        payload = report()
        payload["vulnerabilities"]["deepmerge-ts"]["via"] = []
        with self.assertRaisesRegex(MODULE.AuditPolicyError, "no advisory source"):
            MODULE.enforce(payload, today=dt.date(2026, 8, 24))

    def test_expired_compensating_control_is_rejected(self):
        with self.assertRaisesRegex(MODULE.AuditPolicyError, "expired"):
            MODULE.enforce(report(), today=dt.date(2026, 10, 2))


if __name__ == "__main__":
    unittest.main()
