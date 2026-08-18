# WARP Blue/Green Lab Agent Rules

This directory is an isolated validation surface owned by `OziinG`. It does not authorize a production WARP change.

## Hard boundaries

- Never target the production WARP instance, domain, load balancer, security group, IAM profile or deployment directory from these scripts.
- Use only the CloudFormation stack selected by `WARP_AWS_STACK_NAME`; the default stack name contains `blue-green-lab`.
- The temporary instance has no inbound security-group rule. Operate it only through AWS Systems Manager.
- Build from a clean commit. Promote and verify images by `repository@sha256:digest`, never by a mutable tag.
- Do not cross-build linux/amd64 images in the 2 GiB local Colima VM. Use the isolated CodeBuild path; local memory exhaustion can terminate CLEVER HQ.
- Keep one `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` value across all five images in a test series. Never print the key.
- Transfer only the generated empty seed database. If `User` or `AccountEvidenceOutbox` contains a row, stop.
- Collect evidence before deleting the lab stack. Do not copy secrets, authorization headers, production databases or uploads into evidence.

## Required order

1. Run local image and A–E scenario validation.
2. Commit the exact source under the `OziinG` branch.
3. Create the isolated AWS stack.
4. Push five linux/amd64 images to the lab-only ECR repository.
5. Install and register the lab runner over SSM.
6. Run the same A–E scenarios remotely.
7. Collect evidence locally.
8. Delete the isolated stack and verify deletion.

Any failure before step 6 blocks production planning. A successful lab is evidence for a later production PR; it is not production approval.
