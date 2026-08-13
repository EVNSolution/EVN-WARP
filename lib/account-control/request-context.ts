import { auth } from '@/auth'
import { headers } from 'next/headers'

import { verifyAuthenticatedAccountContext } from './boundary'

export async function requireAccountContext() {
  const session = await auth()
  const subject = (session?.user as { id?: string } | undefined)?.id
  return verifyAuthenticatedAccountContext(new Headers(await headers()), subject)
}
