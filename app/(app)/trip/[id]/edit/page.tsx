import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { notFound, redirect } from 'next/navigation'
import TripForm from '@/components/TripForm'

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  const currentUser = session?.user as any

  const trip = await prisma.tripReport.findUnique({ where: { id } })
  if (!trip) notFound()

  // 작성자만 수정 가능 (초안/반려 상태만)
  if (trip.userId !== currentUser?.id || (trip.status !== '초안' && trip.status !== '반려')) {
    redirect(`/trip/${id}`)
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  })

  return (
    <TripForm
      mode="edit"
      currentUserId={currentUser?.id ?? ''}
      users={users}
      initial={{
        id: trip.id,
        type: trip.type,
        title: trip.title,
        userId: trip.userId ?? '',
        userName: trip.userName,
        teamName: trip.teamName ?? '',
        destination: trip.destination,
        purpose: trip.purpose,
        visitTarget: trip.visitTarget ?? '',
        companions: trip.companions ?? '',
        startDate: trip.startDate,
        endDate: trip.endDate,
        transport: trip.transport ?? '',
        accommodation: trip.accommodation ?? '',
        budgetTransport: trip.budgetTransport,
        budgetAccomm: trip.budgetAccomm,
        budgetMeal: trip.budgetMeal,
        budgetOther: trip.budgetOther,
        actualTransport: trip.actualTransport,
        actualAccomm: trip.actualAccomm,
        actualMeal: trip.actualMeal,
        actualOther: trip.actualOther,
        schedule: trip.schedule ?? '',
        result: trip.result ?? '',
        nextAction: trip.nextAction ?? '',
        status: trip.status,
        approverId: trip.approverId ?? '',
        approverName: trip.approverName ?? '',
        preApproverId: (trip as any).preApproverId ?? '',
        preApproverName: (trip as any).preApproverName ?? '',
        approversJson: (trip as any).approversJson ?? '[]',
      } as any}
    />
  )
}
