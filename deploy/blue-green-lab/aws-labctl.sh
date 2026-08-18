#!/usr/bin/env bash
set -euo pipefail

LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$LAB_DIR/../.." && pwd)"
RUNTIME_DIR="${WARP_LAB_RUNTIME_DIR:-$LAB_DIR/runtime}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-northeast-2}}"
LAB_ID="${WARP_AWS_LAB_ID:-oziing-20260818}"
STACK_NAME="${WARP_AWS_STACK_NAME:-warp-blue-green-lab-${LAB_ID}}"
OWNER="OziinG"
RELEASES=(lab-a lab-b lab-c lab-d lab-e)

usage() {
  cat <<'EOF'
Usage: aws-labctl.sh <command>
  create          Create the isolated ECR, IAM, security group and EC2 stack.
  push-all        Build and push five linux/amd64 images from a clean commit.
  install         Install the lab runner and empty seed database over SSM.
  register-all    Register the five ECR image digests on the instance.
  verify          Run all blue/green scenarios on the instance over SSM.
  collect         Save stack, image, instance and scenario evidence locally.
  status          Show stack outputs and remote slot status.
  destroy         Delete only this lab stack and wait for completion.
EOF
}

die() {
  echo "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null || die "Missing command: $1"
}

require_tools() {
  require_command aws
  require_command jq
  require_command python3
  require_command sqlite3
}

guard_lab_name() {
  [[ "$LAB_ID" =~ ^[a-z0-9-]{3,32}$ ]] || die "Invalid lab id: $LAB_ID"
  [[ "$STACK_NAME" =~ ^warp-blue-green-lab-[a-z0-9-]+$ ]] || die "Refusing non-lab stack name: $STACK_NAME"
}

stack_exists() {
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK_NAME" >/dev/null 2>&1
}

assert_lab_stack() {
  local owner environment
  stack_exists || die "Lab stack does not exist: $STACK_NAME"
  owner="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Tags[?Key=='Owner'].Value | [0]" --output text)"
  environment="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK_NAME" --query "Stacks[0].Tags[?Key=='Environment'].Value | [0]" --output text)"
  [ "$owner" = "$OWNER" ] && [ "$environment" = isolated-lab ] || die "Stack tags do not identify the OziinG isolated lab."
}

stack_output() {
  local key="$1"
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue | [0]" \
    --output text
}

remote_environment() {
  local repository_uri="$1"
  cat <<EOF
export WARP_LAB_RUNTIME_DIR=/var/lib/warp-bg-lab
export WARP_LAB_START_REGISTRY=0
export WARP_LAB_IMAGE_REPOSITORY=$repository_uri
export WARP_LAB_PROXY_PORT=3300
EOF
}

ssm_run() {
  local command="$1" instance_id command_id parameters invocation status stderr
  instance_id="$(stack_output InstanceId)"
  parameters="$(jq -cn --arg command "$command" '{commands: [$command]}')"
  command_id="$(aws ssm send-command \
    --region "$REGION" \
    --instance-ids "$instance_id" \
    --document-name AWS-RunShellScript \
    --comment "$OWNER WARP blue-green isolated lab" \
    --parameters "$parameters" \
    --query 'Command.CommandId' \
    --output text)"
  for _ in $(seq 1 180); do
    invocation="$(aws ssm get-command-invocation \
      --region "$REGION" \
      --command-id "$command_id" \
      --instance-id "$instance_id" \
      --output json)"
    status="$(printf '%s' "$invocation" | jq -r '.Status')"
    case "$status" in
      Pending|InProgress|Delayed) sleep 5 ;;
      *) break ;;
    esac
  done
  printf '%s' "$invocation" | jq -r '.StandardOutputContent' | sed '/^[[:space:]]*$/d'
  stderr="$(printf '%s' "$invocation" | jq -r '.StandardErrorContent')"
  [ -z "$stderr" ] || printf '%s\n' "$stderr" >&2
  [ "$status" = Success ] || die "SSM command failed with status: $status"
}

create_stack() {
  local vpc_id subnet_id expires_at
  vpc_id="${WARP_AWS_VPC_ID:-$(aws ec2 describe-vpcs --region "$REGION" --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)}"
  [ "$vpc_id" != None ] || die 'No default VPC found; set WARP_AWS_VPC_ID.'
  subnet_id="${WARP_AWS_SUBNET_ID:-$(aws ec2 describe-subnets --region "$REGION" --filters Name=vpc-id,Values="$vpc_id" Name=default-for-az,Values=true --query 'Subnets[0].SubnetId' --output text)}"
  [ "$subnet_id" != None ] || die 'No default subnet found; set WARP_AWS_SUBNET_ID.'
  expires_at="${WARP_AWS_EXPIRES_AT:-$(python3 -c 'import datetime; print((datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(days=1)).isoformat())')}"
  aws cloudformation deploy \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --template-file "$LAB_DIR/cloudformation.yaml" \
    --capabilities CAPABILITY_IAM \
    --no-fail-on-empty-changeset \
    --parameter-overrides \
      "LabId=$LAB_ID" \
      "VpcId=$vpc_id" \
      "SubnetId=$subnet_id" \
      "ExpiresAt=$expires_at" \
      "InstanceType=${WARP_AWS_INSTANCE_TYPE:-t3.small}" \
    --tags "Owner=$OWNER" Environment=isolated-lab "ExpiresAt=$expires_at"

  local instance_id
  instance_id="$(stack_output InstanceId)"
  for _ in $(seq 1 36); do
    if [ "$(aws ssm describe-instance-information --region "$REGION" --filters "Key=InstanceIds,Values=$instance_id" --query 'length(InstanceInformationList)' --output text)" = 1 ]; then
      echo "SSM ready: $instance_id"
      ssm_run "set -euo pipefail
cloud-init status --wait >/dev/null
docker info --format 'docker-ready {{.ServerVersion}}'"
      return 0
    fi
    sleep 10
  done
  die "Instance did not register with SSM: $instance_id"
}

require_clean_commit() {
  git -C "$REPO_DIR" diff --quiet || die 'Tracked changes exist; commit the exact lab source before push.'
  git -C "$REPO_DIR" diff --cached --quiet || die 'Staged changes exist; commit the exact lab source before push.'
  [ -z "$(git -C "$REPO_DIR" ls-files --others --exclude-standard)" ] || die 'Untracked files exist; commit the exact lab source before push.'
}

push_all() {
  require_clean_commit
  local repository_name bucket project revision archive build_id status phase last_phase release digest log_group log_stream
  repository_name="$(stack_output RepositoryName)"
  bucket="$(stack_output SourceBucketName)"
  project="$(stack_output BuildProjectName)"
  revision="$(git -C "$REPO_DIR" rev-parse HEAD)"
  for release in "${RELEASES[@]}"; do
    if aws ecr describe-images --region "$REGION" --repository-name "$repository_name" --image-ids "imageTag=$release" >/dev/null 2>&1; then
      die "Immutable ECR tag already exists: $release"
    fi
  done
  mkdir -p "$RUNTIME_DIR/aws-source"
  archive="$RUNTIME_DIR/aws-source/source.zip"
  git -C "$REPO_DIR" archive --format=zip --output "$archive" HEAD
  aws s3 cp "$archive" "s3://$bucket/source.zip" --region "$REGION" --sse AES256 --only-show-errors
  build_id="$(aws codebuild start-build \
    --region "$REGION" \
    --project-name "$project" \
    --environment-variables-override "name=SOURCE_REVISION,value=$revision,type=PLAINTEXT" \
    --query 'build.id' \
    --output text)"
  last_phase=''
  while true; do
    status="$(aws codebuild batch-get-builds --region "$REGION" --ids "$build_id" --query 'builds[0].buildStatus' --output text)"
    phase="$(aws codebuild batch-get-builds --region "$REGION" --ids "$build_id" --query 'builds[0].currentPhase' --output text)"
    if [ "$phase" != "$last_phase" ]; then
      echo "codebuild status=$status phase=$phase"
      last_phase="$phase"
    fi
    [ "$status" = IN_PROGRESS ] || break
    sleep 15
  done
  if [ "$status" != SUCCEEDED ]; then
    log_group="$(aws codebuild batch-get-builds --region "$REGION" --ids "$build_id" --query 'builds[0].logs.groupName' --output text)"
    log_stream="$(aws codebuild batch-get-builds --region "$REGION" --ids "$build_id" --query 'builds[0].logs.streamName' --output text)"
    if [ "$log_group" != None ] && [ "$log_stream" != None ]; then
      aws logs get-log-events --region "$REGION" --log-group-name "$log_group" --log-stream-name "$log_stream" --start-from-head --query 'events[].message' --output text | tr '\t' '\n' | tail -n 120
    fi
    die "CodeBuild failed: $build_id ($status)"
  fi
  for release in "${RELEASES[@]}"; do
    digest="$(aws ecr describe-images \
      --region "$REGION" \
      --repository-name "$repository_name" \
      --image-ids "imageTag=$release" \
      --query 'imageDetails[0].imageDigest' \
      --output text)"
    [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || die "Invalid ECR digest for $release: $digest"
    echo "pushed release=$release digest=$digest revision=$revision"
  done
}

install_remote() {
  local repository_uri scripts_bundle database_bundle remote_env user_count outbox_count
  repository_uri="$(stack_output RepositoryUri)"
  [ -f "$RUNTIME_DIR/shared/dev.db" ] || die 'Run labctl.sh init before installing the remote lab.'
  user_count="$(sqlite3 "$RUNTIME_DIR/shared/dev.db" 'SELECT count(*) FROM User;')"
  outbox_count="$(sqlite3 "$RUNTIME_DIR/shared/dev.db" 'SELECT count(*) FROM AccountEvidenceOutbox;')"
  [ "$user_count" = 0 ] && [ "$outbox_count" = 0 ] || die 'Seed database is not empty; refusing to transfer it.'
  scripts_bundle="$(COPYFILE_DISABLE=1 tar --no-xattrs -czf - -C "$LAB_DIR" labctl.sh nginx.conf probe.py verify.sh | base64 | tr -d '\n')"
  database_bundle="$(gzip -c "$RUNTIME_DIR/shared/dev.db" | base64 | tr -d '\n')"

  ssm_run "set -euo pipefail
install -d -m 0755 /opt/warp-bg-lab
printf '%s' '$scripts_bundle' | base64 -d | tar -xzf - -C /opt/warp-bg-lab
chmod 0755 /opt/warp-bg-lab/labctl.sh /opt/warp-bg-lab/probe.py /opt/warp-bg-lab/verify.sh"

  ssm_run "set -euo pipefail
install -d -m 0777 /var/lib/warp-bg-lab/shared/uploads /var/lib/warp-bg-lab/shared/public-uploads /var/lib/warp-bg-lab/shared/data
printf '%s' '$database_bundle' | base64 -d | gzip -d > /var/lib/warp-bg-lab/shared/dev.db
chmod 0666 /var/lib/warp-bg-lab/shared/dev.db"

  remote_env="$(remote_environment "$repository_uri")"
  ssm_run "set -euo pipefail
$remote_env
/opt/warp-bg-lab/labctl.sh init"
}

register_all() {
  local repository_uri repository_name revision remote_env command release digest
  repository_uri="$(stack_output RepositoryUri)"
  repository_name="$(stack_output RepositoryName)"
  revision="$(git -C "$REPO_DIR" rev-parse HEAD)"
  remote_env="$(remote_environment "$repository_uri")"
  command="set -euo pipefail
$remote_env"
  for release in "${RELEASES[@]}"; do
    digest="$(aws ecr describe-images --region "$REGION" --repository-name "$repository_name" --image-ids "imageTag=$release" --query 'imageDetails[0].imageDigest' --output text)"
    command="$command
/opt/warp-bg-lab/labctl.sh register-image '$release' '$repository_uri@$digest' '$revision'"
  done
  ssm_run "$command"
}

verify_remote() {
  local repository_uri registry remote_env
  repository_uri="$(stack_output RepositoryUri)"
  registry="${repository_uri%%/*}"
  remote_env="$(remote_environment "$repository_uri")"
  ssm_run "set -euo pipefail
$remote_env
aws ecr get-login-password --region '$REGION' | docker login --username AWS --password-stdin '$registry' >/dev/null 2>&1
cd /opt/warp-bg-lab
if ./verify.sh; then
  docker logout '$registry' >/dev/null 2>&1 || true
else
  result=\$?
  docker logout '$registry' >/dev/null 2>&1 || true
  exit \"\$result\"
fi"
}

collect_evidence() {
  local repository_name repository_uri registry instance_id security_group_id project remote_env evidence_dir build_id release
  repository_name="$(stack_output RepositoryName)"
  repository_uri="$(stack_output RepositoryUri)"
  registry="${repository_uri%%/*}"
  instance_id="$(stack_output InstanceId)"
  security_group_id="$(stack_output SecurityGroupId)"
  project="$(stack_output BuildProjectName)"
  remote_env="$(remote_environment "$repository_uri")"
  evidence_dir="$RUNTIME_DIR/aws-evidence"
  mkdir -p "$evidence_dir"
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK_NAME" --output json > "$evidence_dir/stack.json"
  aws cloudformation list-stack-resources --region "$REGION" --stack-name "$STACK_NAME" --output json > "$evidence_dir/resources.json"
  aws ec2 describe-instances --region "$REGION" --instance-ids "$instance_id" --output json > "$evidence_dir/instance.json"
  aws ec2 describe-security-groups --region "$REGION" --group-ids "$security_group_id" --output json > "$evidence_dir/security-group.json"
  aws ecr describe-images --region "$REGION" --repository-name "$repository_name" --output json > "$evidence_dir/images.json"
  for release in "${RELEASES[@]}"; do
    aws ecr describe-image-scan-findings --region "$REGION" --repository-name "$repository_name" --image-id "imageTag=$release" --output json > "$evidence_dir/scan-$release.json"
  done
  build_id="$(aws codebuild list-builds-for-project --region "$REGION" --project-name "$project" --query 'ids[0]' --output text)"
  if [ "$build_id" != None ]; then
    aws codebuild batch-get-builds --region "$REGION" --ids "$build_id" --output json > "$evidence_dir/builds.json"
  fi
  ssm_run "set -euo pipefail
$remote_env
cat /var/lib/warp-bg-lab/evidence.jsonl" > "$evidence_dir/scenarios.jsonl"
  ssm_run "set -euo pipefail
$remote_env
/opt/warp-bg-lab/labctl.sh status
if [ -f /root/.docker/config.json ] && grep -Fq '$registry' /root/.docker/config.json; then
  echo ecr-credential=present
else
  echo ecr-credential=absent
fi" > "$evidence_dir/remote-status.txt"
  jq -n --arg revision "$(git -C "$REPO_DIR" rev-parse HEAD)" --arg stack "$STACK_NAME" '{controllerRevision: $revision, stack: $stack}' > "$evidence_dir/controller.json"
  echo "Evidence saved: $evidence_dir"
}

show_status() {
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK_NAME" --query 'Stacks[0].{Status:StackStatus,Outputs:Outputs}' --output json
  local repository_uri remote_env
  repository_uri="$(stack_output RepositoryUri)"
  remote_env="$(remote_environment "$repository_uri")"
  ssm_run "set -euo pipefail
$remote_env
/opt/warp-bg-lab/labctl.sh status"
}

destroy_stack() {
  local bucket
  bucket="$(stack_output SourceBucketName 2>/dev/null || true)"
  if [ -n "$bucket" ] && [ "$bucket" != None ]; then
    [[ "$bucket" = warp-blue-green-lab-* ]] || die "Refusing unexpected bucket: $bucket"
    aws s3 rm "s3://$bucket" --recursive --region "$REGION" --only-show-errors
  fi
  aws cloudformation delete-stack --region "$REGION" --stack-name "$STACK_NAME"
  aws cloudformation wait stack-delete-complete --region "$REGION" --stack-name "$STACK_NAME"
  echo "Deleted isolated stack: $STACK_NAME"
}

command="${1:-}"
require_tools
guard_lab_name
if [ "$command" = create ]; then
  stack_exists && assert_lab_stack
elif [ -n "$command" ]; then
  assert_lab_stack
fi
case "$command" in
  create) create_stack ;;
  push-all) push_all ;;
  install) install_remote ;;
  register-all) register_all ;;
  verify) verify_remote ;;
  collect) collect_evidence ;;
  status) show_status ;;
  destroy) destroy_stack ;;
  *) usage; exit 2 ;;
esac
