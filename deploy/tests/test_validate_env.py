import importlib.util
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "validate-env.py"
SPEC = importlib.util.spec_from_file_location("validate_env", MODULE_PATH)
assert SPEC and SPEC.loader
validate_env = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validate_env)


VALID = {
    "DATABASE_URL": "file:./dev.db",
    "AUTH_SECRET": "a" * 32,
    "AUTH_TRUST_HOST": "true",
    "AUTH_URL": "https://warp.example",
    "NEXTAUTH_URL": "https://warp.example",
    "UPLOADS_DIR": "/opt/evn-uploads",
}


class ValidateEnvTest(unittest.TestCase):
    def test_valid_production_contract(self):
        self.assertEqual(validate_env.validate(VALID), [])

    def test_missing_secret_relative_upload_and_http_are_rejected(self):
        values = {**VALID, "AUTH_SECRET": "", "UPLOADS_DIR": "uploads", "AUTH_URL": "http://warp.example"}
        errors = validate_env.validate(values)
        self.assertTrue(any("AUTH_SECRET" in error for error in errors))
        self.assertTrue(any("UPLOADS_DIR" in error for error in errors))
        self.assertTrue(any("AUTH_URL" in error for error in errors))

    def test_parser_rejects_duplicate_keys_without_echoing_values(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.write_text("AUTH_SECRET=first-secret\nAUTH_SECRET=second-secret\n", encoding="utf-8")
            values, errors = validate_env.parse_env(path)
        self.assertEqual(values["AUTH_SECRET"], "first-secret")
        self.assertEqual(errors, ["line 2: duplicate key AUTH_SECRET"])
        self.assertNotIn("second-secret", " ".join(errors))


if __name__ == "__main__":
    unittest.main()
