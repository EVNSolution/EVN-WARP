import { prisma } from '@/lib/db'
import { isHqMailEnabled } from '@/lib/dbTarget'
import { dispatchDueHqMailQueue } from '@/lib/hqMailQueue'
import { enqueueHqMailForNotification } from '@/lib/hqMailQueueCore'

export async function createNotification({
  id,
  userId,
  tripId,
  type,
  message,
  link,
}: {
  id?: string
  userId: string
  tripId?: string | null
  type: string
  message: string
  link: string
}): Promise<string> {
  const notificationId = id || crypto.randomUUID()
  let shouldDispatchHqMail = false
  const hqMailEnabled = isHqMailEnabled()
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT OR IGNORE INTO "Notification" (id, "userId", "tripId", type, message, link, read, "createdAt")
        VALUES (${notificationId}, ${userId}, ${tripId ?? null}, ${type}, ${message}, ${link}, 0, datetime('now'))
      `
      if (!hqMailEnabled) return
      shouldDispatchHqMail = await enqueueHqMailForNotification(tx, {
        notificationId,
        userId,
        message,
        link,
      })
    })
  } catch (error) {
    console.error('[Notification] create failed: notification_persist_failed')
    throw error
  }
  if (shouldDispatchHqMail) {
    dispatchDueHqMailQueue({ limit: 1 }).catch(() => {
      console.error('[Notification] HQ mail dispatch deferred: hq_dispatch_unavailable')
    })
  }
  return notificationId
}
