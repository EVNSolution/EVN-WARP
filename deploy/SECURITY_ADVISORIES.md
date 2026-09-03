# WARP dependency advisory policy

Owner: `OziinG`

Production release runs `npm run security:audit`. Critical advisories and unreviewed High advisories stop before image build. Do not replace this with `npm audit fix --force`, an unverified transitive override or a lower audit threshold.

## Time-bounded compensating controls

The upstream packages below have no compatible patched release as of 2026-08-24. The release gate accepts only these exact advisory IDs until 2026-10-01 and fails when the package topology, controlled source surface or review date changes.

| Advisory | Current reachability | Enforced control |
| --- | --- | --- |
| `GHSA-w3rx-r6r6-pgpr`, `GHSA-5p2g-fcmc-qvqq` | `pptxgenjs@4.0.1` carries `image-size@1.2.1`, but WARP generates text, shapes and tables only. No `addImage` path exists. | Scan every application and script source for PptxGenJS imports and image calls. A new import surface or image call blocks release. |
| `GHSA-ggr8-5vv4-36mx` | Prisma CLI loads a static repository-owned config during trusted build and migration commands. No request or provider payload reaches recursive config merge. | Pin the reviewed Prisma topology and exact `prisma.config.ts` digest. Any change blocks release. |

Prisma CLI, Client and libSQL adapter are aligned at 7.9.1. This removes the previous Hono and Valibot Moderate advisory paths but upstream Prisma still carries `deepmerge-ts@7.1.5` and `mysql2@3.15.3`.

| Advisory | Current reachability | Enforced control |
| --- | --- | --- |
| `GHSA-3f6p-5ww8-9rcr` (npm 1153173) | Prisma CLI carries `mysql2@3.15.3` as a transitive dependency, but WARP connects only to SQLite/libSQL. No WARP source file imports mysql2 and no MySQL connection string is configured. The auth plugin downgrade path requires an active MySQL server connection, which never occurs. | Pin mysql2 as transitive (not root dependency). Scan all WARP source for mysql2 imports. Any direct import or root dependency entry blocks release. |
| npm 1158532 | Prisma CLI carries `mysql2@3.15.3` as a transitive dependency. Same isolation as 1153173: WARP has no MySQL connection, no mysql2 import, and no MySQL connection string. Vulnerability reachability requires an active MySQL server connection which never occurs in WARP. | Same control as 1153173: transitive-only, no WARP source import, no root dependency entry. |

## Removal

Re-run the audit before the review date. When PptxGenJS/image-size or Prisma/deepmerge-ts publishes a compatible fixed graph, update the direct packages normally, remove the corresponding exception and retain the regression checks that protect PPTX generation, Prisma generate, migrations, typecheck and production build.
