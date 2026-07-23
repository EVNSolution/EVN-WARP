import path from 'node:path'

import type { Config } from '@libsql/client'

export type WarpDbTarget = {
  config: Config
  label: string
}

type WarpDbEnv = {
  TURSO_DATABASE_URL?: string
  TURSO_AUTH_TOKEN?: string
  WARP_DB_PATH?: string
  DATABASE_URL?: string
  [key: string]: string | undefined
}

function present(value: string | undefined): string | undefined {
  return value && value.trim() ? value.trim() : undefined
}

function fileUrlFromPath(dbPath: string): string {
  return `file:${path.resolve(dbPath)}`
}

function redactedUrl(url: string): string {
  if (!url.includes('authToken=')) return url
  try {
    const parsed = new URL(url)
    if (parsed.searchParams.has('authToken')) {
      parsed.searchParams.set('authToken', '<redacted>')
    }
    return parsed.toString()
  } catch {
    return url
  }
}

export function resolveWarpDbTarget(
  env: WarpDbEnv = process.env,
  cwd = process.cwd()
): WarpDbTarget {
  const tursoUrl = present(env.TURSO_DATABASE_URL)
  if (tursoUrl) {
    const authToken = present(env.TURSO_AUTH_TOKEN)
    if (!authToken) {
      throw new Error('TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL is set')
    }
    return {
      config: { url: tursoUrl, authToken },
      label: `${redactedUrl(tursoUrl)} (authToken: set)`,
    }
  }

  const warpDbPath = present(env.WARP_DB_PATH)
  if (warpDbPath) {
    return {
      config: { url: fileUrlFromPath(warpDbPath) },
      label: fileUrlFromPath(warpDbPath),
    }
  }

  const databaseUrl = present(env.DATABASE_URL)
  if (databaseUrl) {
    return {
      config: { url: databaseUrl },
      label: redactedUrl(databaseUrl),
    }
  }

  const defaultUrl = fileUrlFromPath(path.join(cwd, 'dev.db'))
  return {
    config: { url: defaultUrl },
    label: defaultUrl,
  }
}

export function isHqMailEnabled(env: { [key: string]: string | undefined } = process.env): boolean {
  return present(env.CLEVER_HQ_MAIL_ENABLED)?.toLowerCase() === 'true'
}
