import { prisma } from '@/lib/db'

export async function createNotification({
  userId,
  tripId,
  type,
  message,
  link,
}: {
  userId: string
  tripId: string
  type: string
  message: string
  link: string
}) {
  const id = crypto.randomUUID()
  try {
    await prisma.$executeRaw`
      INSERT INTO "Notification" (id, "userId", "tripId", type, message, link, read, "createdAt")
      VALUES (${id}, ${userId}, ${tripId}, ${type}, ${message}, ${link}, 0, datetime('now'))
    `
  } catch (e) {
    console.error('[Notification] create failed:', e)
  }
}
