import assert from 'node:assert/strict'
import test from 'node:test'
import { GET } from './route'

test('deployment identity is exposed when an immutable image digest is present', async () => {
  const previous = process.env.WARP_IMAGE_DIGEST
  try {
    delete process.env.WARP_IMAGE_DIGEST
    assert.deepEqual(await (await GET()).json(), { ok: true })

    process.env.WARP_SLOT = 'blue'
    process.env.WARP_RELEASE_ID = 'lab-a'
    process.env.WARP_SOURCE_REVISION = 'revision-a'
    process.env.WARP_IMAGE_DIGEST = 'sha256:digest-a'
    assert.deepEqual(await (await GET()).json(), {
      ok: true,
      slot: 'blue',
      release: 'lab-a',
      revision: 'revision-a',
      imageDigest: 'sha256:digest-a',
    })
  } finally {
    if (previous === undefined) delete process.env.WARP_IMAGE_DIGEST
    else process.env.WARP_IMAGE_DIGEST = previous
    delete process.env.WARP_SLOT
    delete process.env.WARP_RELEASE_ID
    delete process.env.WARP_SOURCE_REVISION
  }
})
