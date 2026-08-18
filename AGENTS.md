<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# WARP production deployment contract

- Production deployment owner and evidence actor is `OziinG`.
- Application ENV is read-only from SSM `/evn-warp/app-env`. Never restore GitHub `APP_ENV` write-back or local `.env` fallback.
- Never print `.env`, secret fragments, fingerprints, PM2 environment or decrypted SSM values.
- Run routine production deployment with the single `release` pipeline. It performs `prepare → status → switch → status` under one immutable Revision. Use `validate`, `prepare`, `status` and `switch` separately only for preflight or recovery diagnosis. `rollback` restores the recorded previous slot. Never type an image digest by hand.
- Only exact `main` may assume the deployment role. Images are promoted by immutable ECR digest.
- Routine deployment must not run schema/data migration, seed, backfill or `prisma db push`.
- A failed candidate must leave the current Nginx upstream and active runtime healthy.

## Confirmed zero-downtime operating state

- The post-bootstrap Blue/Green path was confirmed in production on 2026-08-18 under Issue `EVNSolution/EVN-WARP#8`. The verified sequence was `prepare` with traffic unchanged, `switch` to blue, rollback to legacy, re-prepare and final switch to blue.
- Confirmation evidence recorded 2,504 public login probes with zero errors and zero HTTP 5xx responses. The final active Revision was `caf13e902c0bc2ba6bc71b9e141cd842aae58d7c`; runtime identity was verified through public `/api/readyz`.
- The zero-downtime claim applies after the one-time Docker, Nginx upstream and shared SQLite bootstrap. That initial bootstrap required one short PM2 restart and is explicitly outside the zero-downtime guarantee.
- At confirmation, `blue` was active and `legacy` was the recorded previous slot. Keep the legacy emergency path until a normal `blue` to `green` deployment and container-to-container rollback have also been observed in production.

## Agent rules for every production release

- Never rewrite or replace `main` after `prepare`. Git SHA, ECR tag, image digest, server manifest and candidate Revision are one release identity; changing the SHA invalidates the prepared candidate and forces a new build.
- Use only the GitHub Actions `release`, `validate`, `prepare`, `status`, `switch` and `rollback` inputs. Do not run PM2, Nginx, Docker, SSM write or database commands as a substitute for the workflow.
- Routine `release` must show the prepared inactive candidate before switching and end with final slot status. Require public `/api/readyz` to return the exact `main` Revision and image digest before declaring the release complete.
- Keep the recorded previous slot running through the observation window. Roll back through the workflow; do not restore a database or type an image digest manually.
- Record the Issue, PR, final commit, Actions runs, SSM Parameter version, image digest, readiness result, rollback result and continuity probe counts. Never include secret values.
- Deployment-speed optimization may reuse caches or shorten polling latency, but it must not remove source tests, immutable digest promotion, ECR critical/high scan gates, candidate readiness, external digest verification or automatic rollback.
- Keep ECR `evn-warp` immutable and scan-gated for release images. Store mutable BuildKit data only in `evn-warp-buildcache`; never deploy from that repository or grant the EC2 instance role access to it.
- Treat build cache as disposable performance data, not release evidence. `prepare` must fail when release/cache repository mutability differs from the Runbook, while cache export failure may not replace final image build, digest verification or scanning.
- The cache repository lifecycle and least-privilege role policy are governed by `deploy/aws/buildcache-lifecycle-policy.json` and `deploy/aws/github-deploy-policy.json`; keep the applied AWS state aligned with those files.
