import unittest
from pathlib import Path


ROOT = Path(__file__).parents[2]


class DeploymentOptimizationContractTest(unittest.TestCase):
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
