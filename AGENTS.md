<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# WARP production deployment contract

- Production deployment owner and evidence actor is `OziinG`.
- Application ENV is read-only from SSM `/evn-warp/app-env`. Never restore GitHub `APP_ENV` write-back or local `.env` fallback.
- Never print `.env`, secret fragments, fingerprints, PM2 environment or decrypted SSM values.
- Run `validate`, `prepare`, `switch` in order. `rollback` restores the recorded previous slot. Never type an image digest by hand.
- Only exact `main` may assume the deployment role. Images are promoted by immutable ECR digest.
- Routine deployment must not run schema/data migration, seed, backfill or `prisma db push`.
- A failed candidate must leave the current Nginx upstream and active runtime healthy.
- Keep the legacy PM2 port 3000 until the first production switch, rollback rehearsal and observation gate have passed.
