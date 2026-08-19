import contextlib
import io
import json
import os
import textwrap
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).parents[2]


class DeploymentOptimizationContractTest(unittest.TestCase):
    def test_release_runs_as_two_job_bounded_pipeline(self):
        workflow = (ROOT / ".github/workflows/deploy-ec2-ssm.yml").read_text(encoding="utf-8")
        self.assertIn("run-name: WARP ${{ inputs.action }}", workflow.splitlines())
        self.assertIn("default: release", workflow)
        self.assertIn("- release", workflow)
        self.assertIn("  artifact:", workflow)
        self.assertIn("  operate:", workflow)
        self.assertIn("name: Validate source and prepare image", workflow)
        self.assertIn("name: Execute ${{ inputs.action }} and verify", workflow)
        self.assertNotIn(" · ", workflow)
        self.assertIn("needs: artifact", workflow)
        self.assertIn("image_digest: ${{ steps.image.outputs.image_digest }}", workflow)
        self.assertIn("IMAGE_DIGEST: ${{ needs.artifact.outputs.image_digest }}", workflow)
        self.assertIn('IMAGE_REF="${account_id}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}@${IMAGE_DIGEST}"', workflow)
        self.assertIn("needs.artifact.result == 'success'", workflow)
        self.assertIn("needs.artifact.result == 'skipped'", workflow)
        self.assertIn("remote_actions = ['prepare', 'status', 'switch', 'status']", workflow)
        self.assertIn("commands.extend(remote_command(action) for action in remote_actions)", workflow)
        self.assertEqual(workflow.count("aws ssm send-command"), 1)
        self.assertEqual(workflow.count("image_ref: ${{ steps.image.outputs.image_ref }}"), 0)

        generator = workflow.split("python3 - <<'PY' > /tmp/evn-warp-ssm.json\n", 1)[1].split(
            "\n          PY", 1
        )[0]
        environment = {
            "DEPLOY_ACTION": "release",
            "SERVER_NAME": "warp.example.test",
            "SSM_APP_ENV_PARAM": "/evn-warp/app-env",
            "GITHUB_SHA": "a" * 40,
            "IMAGE_REF": "example.test/evn-warp@sha256:" + "b" * 64,
            "setup_b64": "c2V0dXA=",
            "validator_b64": "dmFsaWRhdGU=",
            "database_migrator_b64": "bWlncmF0ZQ==",
            "schema_migrator_b64": "c2NoZW1hLW1pZ3JhdGU=",
            "schema_migrations_b64": "c2NoZW1hLW1pZ3JhdGlvbnM=",
            "remote_b64": "cmVtb3Rl",
        }
        output = io.StringIO()
        with patch.dict(os.environ, environment, clear=True), contextlib.redirect_stdout(output):
            exec(compile(textwrap.dedent(generator), "deploy-ssm-generator", "exec"), {})

        payload = json.loads(output.getvalue())
        remote_commands = [
            command
            for command in payload["commands"]
            if command.startswith("DEPLOY_ACTION=")
            and command.endswith(" /tmp/evn-remote-deploy.sh")
        ]
        self.assertEqual(
            [
                next(field for field in command.split() if field.startswith("DEPLOY_ACTION="))
                for command in remote_commands
            ],
            [
                "DEPLOY_ACTION=prepare",
                "DEPLOY_ACTION=status",
                "DEPLOY_ACTION=switch",
                "DEPLOY_ACTION=status",
            ],
        )
        self.assertIn("/tmp/evn-apply-schema-migrations.py", workflow)
        self.assertTrue(
            any("/tmp/evn-schema-migrations" in command for command in payload["commands"])
        )

    def test_only_the_governed_deployment_workflow_remains(self):
        workflows = {
            path.name
            for path in (ROOT / ".github/workflows").iterdir()
            if path.suffix in {".yml", ".yaml"}
        }
        self.assertEqual(workflows, {"deploy-ec2-ssm.yml"})
        self.assertFalse((ROOT / "scripts/a3-kpi-export.sql").exists())
        self.assertFalse((ROOT / "scripts/export-a3-kpi.mjs").exists())

    def test_non_runtime_material_is_excluded_from_build_context(self):
        ignored = set((ROOT / ".dockerignore").read_text(encoding="utf-8").splitlines())
        self.assertTrue(
            {
                ".claude",
                "*.docx",
                "*.pptx",
                "*.traineddata",
                "*.xlsx",
                "deploy",
                "scripts",
                "AGENTS.md",
                "CLAUDE.md",
            }.issubset(ignored)
        )

    def test_prepare_reuses_dependencies_and_builder_layers(self):
        workflow = (ROOT / ".github/workflows/deploy-ec2-ssm.yml").read_text(encoding="utf-8")
        self.assertIn("if: inputs.action == 'release' || inputs.action == 'prepare'", workflow)
        self.assertIn("uses: actions/setup-node@v7", workflow)
        self.assertIn("cache: npm", workflow)
        self.assertIn("id: buildx", workflow)
        self.assertIn("ECR_CACHE_REPOSITORY: evn-warp-buildcache", workflow)
        self.assertIn('test "$release_mutability" = IMMUTABLE', workflow)
        self.assertIn('test "$cache_mutability" = MUTABLE', workflow)
        self.assertIn("--cache-from \"type=registry,ref=$cache_repository_uri:buildcache-main\"", workflow)
        self.assertIn("mode=max,oci-mediatypes=true,image-manifest=true,ignore-error=true", workflow)
        self.assertIn("Require clean ECR operating-system scan", workflow)
        build_step = workflow.split("- name: Build or reuse immutable image", 1)[1].split(
            "- name: Require clean ECR operating-system scan", 1
        )[0]
        self.assertEqual(build_step.count("trap '"), 1)
        self.assertIn('shred -u "$build_key"', build_step)
        self.assertIn('rm -rf -- "$docker_config"', build_step)
        self.assertIn('buildx_config="${DOCKER_CONFIG:-$HOME/.docker}/buildx"', build_step)
        self.assertIn('export BUILDX_CONFIG="$buildx_config"', build_step)
        self.assertIn('export BUILDX_BUILDER="${{ steps.buildx.outputs.name }}"', build_step)

    def test_prepare_applies_only_reviewed_schema_migrations_before_candidate_start(self):
        remote = (ROOT / "deploy/remote-deploy.sh").read_text(encoding="utf-8")
        workflow = (ROOT / ".github/workflows/deploy-ec2-ssm.yml").read_text(encoding="utf-8")
        migrate = remote.index('"$SCHEMA_MIGRATOR"')
        candidate = remote.index("docker run -d")
        self.assertLess(migrate, candidate)
        self.assertNotIn("prisma db push", remote)
        self.assertNotIn("accept-data-loss", remote)
        self.assertIn('"event=schema-migration-verified"', remote)
        for field in (
            "migration_engine",
            "migration_ledger",
            "migration_applied_count",
            "migration_backup",
            "Migration validation",
        ):
            self.assertIn(field, workflow)

    def test_release_and_cache_repositories_have_separate_iam_scopes(self):
        policy = (ROOT / "deploy/aws/github-deploy-policy.json").read_text(encoding="utf-8")
        agent_rules = (ROOT / "AGENTS.md").read_text(encoding="utf-8")
        self.assertIn('"Sid": "PushWarpReleaseImages"', policy)
        self.assertIn('"Sid": "UseWarpBuildCache"', policy)
        self.assertIn("repository/evn-warp-buildcache", policy)
        self.assertIn("Keep ECR `evn-warp` immutable", agent_rules)
        self.assertIn("never deploy from that repository", agent_rules)

    def test_ssm_polling_keeps_the_bounded_deadline(self):
        workflow = (ROOT / ".github/workflows/deploy-ec2-ssm.yml").read_text(encoding="utf-8")
        wait_step = workflow.split("- name: Wait for bounded SSM command", 1)[1]
        self.assertIn("deadline=$((SECONDS + 3600))", wait_step)
        self.assertIn("sleep 5", wait_step)
        self.assertNotIn("sleep 15", wait_step)


if __name__ == "__main__":
    unittest.main()
