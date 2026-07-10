import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/createNotification'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const currentUser = session?.user as any
  if (!currentUser?.id) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const action: string = body.action   // '동의' | '승인' | '반려'
  const comment: string | null = body.comment ?? null

  const trip = await prisma.tripReport.findUnique({ where: { id } }) as any
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (trip.status !== '승인요청') {
    return NextResponse.json({ error: '승인요청 상태가 아닙니다' }, { status: 400 })
  }

  let approvers: any[] = []
  try { approvers = JSON.parse(trip.approversJson ?? '[]') } catch {}

  const myIndex = approvers.findIndex((a: any) => a.userId === currentUser.id)
  if (myIndex === -1) return NextResponse.json({ error: '결재 권한이 없습니다' }, { status: 403 })

  const me = approvers[myIndex]
  const myType: string = me.type ?? '결재'

  if (me.status !== '대기') {
    return NextResponse.json({ error: '이미 처리하셨습니다' }, { status: 400 })
  }

  // 결재 차례: 동의 인원 전원 처리 완료 후에만 가능
  if (myType === '결재') {
    const consentPending = approvers
      .filter((a: any) => (a.type ?? '결재') === '동의')
      .some((a: any) => a.status === '대기')
    if (consentPending) {
      return NextResponse.json({ error: '동의 인원 처리가 완료되지 않았습니다' }, { status: 400 })
    }
  }

  // 같은 타입 내 이전 순서 처리 여부 확인
  const sameTypePrev = approvers.slice(0, myIndex).filter((a: any) => (a.type ?? '결재') === myType)
  if (sameTypePrev.some((a: any) => a.status === '대기')) {
    return NextResponse.json({ error: '이전 처리자가 아직 처리하지 않았습니다' }, { status: 400 })
  }

  // 개인 상태 업데이트
  const myNewStatus = action === '반려' ? '반려' : (myType === '동의' ? '동의' : '승인')
  approvers[myIndex] = { ...me, status: myNewStatus, comment, approvedAt: new Date().toISOString() }

  const newApproversJson = JSON.stringify(approvers)

  // 출장보고서 전체 상태 결정
  let newTripStatus = trip.status
  let approvedAt: string | null = null
  let approvalComment: string | null = trip.approvalComment ?? null

  if (action === '반려') {
    newTripStatus = '반려'
    approvalComment = comment
  } else {
    const allDone = approvers.every((a: any) => a.status !== '대기')
    if (allDone) {
      newTripStatus = '승인'
      approvedAt = new Date().toISOString()
      approvalComment = comment
    }
  }

  await prisma.$executeRaw`
    UPDATE "TripReport"
    SET "approversJson"  = ${newApproversJson},
        "approverId"     = ${currentUser.id},
        "approverName"   = ${currentUser.name ?? currentUser.email ?? ''},
        "status"         = ${newTripStatus},
        "approvedAt"     = ${approvedAt},
        "approvalComment"= ${approvalComment}
    WHERE id = ${id}
  `

  // ── 알림 발송 ──────────────────────────────────────────────────
  const updatedApprovers: any[] = JSON.parse(newApproversJson)

  if (newTripStatus === '반려') {
    // 작성자에게 반려 알림
    if (trip.userId) {
      await createNotification({
        userId: trip.userId,
        tripId: id,
        type: 'rejected',
        message: `[${trip.title}] 출장보고서가 반려되었습니다`,
        link: `/trip/${id}`,
      })
    }
  } else if (newTripStatus === '승인') {
    // 작성자에게 최종 승인 알림
    if (trip.userId) {
      await createNotification({
        userId: trip.userId,
        tripId: id,
        type: 'approved',
        message: `[${trip.title}] 출장보고서가 승인되었습니다`,
        link: `/trip/${id}`,
      })
    }
  } else {
    // 다음 처리 대상자에게 알림
    const nextConsentor = updatedApprovers.find(
      (a: any) => (a.type ?? '결재') === '동의' && a.status === '대기'
    )
    const nextFinalApprover = !nextConsentor
      ? updatedApprovers.find((a: any) => (a.type ?? '결재') === '결재' && a.status === '대기')
      : null
    const nextActor = nextConsentor ?? nextFinalApprover
    if (nextActor) {
      await createNotification({
        userId: nextActor.userId,
        tripId: id,
        type: 'approval_request',
        message: `[${trip.title}] 승인 차례가 되었습니다`,
        link: `/trip/${id}/print`,
      })
    }
  }

  return NextResponse.json({ ok: true, tripStatus: newTripStatus })
}
