import { prisma } from '@/lib/db'
import { auth } from '@/auth'
import VehicleClient from './VehicleClient'

export default async function VehiclePage() {
  const [vehiclesRaw, session] = await Promise.all([
    prisma.vehicle.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    auth(),
  ])

  const me     = session?.user as any
  const myName = me?.name as string ?? ''

  const vehicles = vehiclesRaw.map(v => ({
    id:         v.id,
    name:       v.name,
    plateNo:    v.plateNo,
    department: v.department ?? null,
    manager:    v.manager   ?? null,
    cardNo:     v.cardNo    ?? null,
    hasCharge:  Boolean((v as any).hasCharge),
    hasHipass:  Boolean((v as any).hasHipass),
  }))

  return <VehicleClient vehicles={vehicles} myName={myName} />
}
