import { NextRequest, NextResponse } from 'next/server'
import { resolveMcpUser } from '@/lib/mcp/auth'
import { callTool, MCP_INSTRUCTIONS, TOOL_DEFINITIONS, type McpUser } from '@/lib/mcp/tools'

/**
 * 원격 MCP 엔드포인트 (Streamable HTTP, stateless JSON 응답).
 *
 * 개인 Claude(커넥터)·ChatGPT 등 MCP 클라이언트가 여기로 접속해 WARP 업무 기록 도구를 쓴다.
 * 인증: Authorization: Bearer <토큰> 또는 /api/mcp/<토큰> (헤더를 못 넣는 커넥터 UI용).
 * 토큰은 「내 계정」 화면에서 발급 — 토큰 주인 권한으로만 동작한다.
 *
 * 세션(Mcp-Session-Id)·SSE 스트림 없이 요청-응답만 쓰는 최소 구현이다 — 사양이 허용하는
 * stateless 모드로, 의존성 없이 감사 가능한 코드를 유지하기 위해 SDK 를 쓰지 않았다.
 */

export const dynamic = 'force-dynamic'

const SUPPORTED_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18']
const SERVER_INFO = { name: 'warp', title: 'EV& WARP 업무 기록', version: '1.0.0' }

type JsonRpcMessage = { jsonrpc?: string; id?: unknown; method?: string; params?: any }

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: '2.0', id, result }
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

async function handleMessage(user: McpUser, msg: JsonRpcMessage): Promise<object | null> {
  const { id, method, params } = msg
  if (!method) return id !== undefined ? rpcError(id, -32600, 'method 가 없습니다') : null

  // 알림(id 없음)은 처리할 것이 없다 — initialized 등
  if (id === undefined || id === null) return null

  switch (method) {
    case 'initialize': {
      const requested = typeof params?.protocolVersion === 'string' ? params.protocolVersion : ''
      return rpcResult(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: MCP_INSTRUCTIONS,
      })
    }
    case 'ping':
      return rpcResult(id, {})
    case 'tools/list':
      return rpcResult(id, { tools: TOOL_DEFINITIONS })
    case 'tools/call': {
      const name = typeof params?.name === 'string' ? params.name : ''
      const result = await callTool(user, name, params?.arguments ?? {})
      return rpcResult(id, {
        content: [{ type: 'text', text: result.text }],
        ...(result.isError ? { isError: true } : {}),
      })
    }
    default:
      return rpcError(id, -32601, `지원하지 않는 메서드: ${method}`)
  }
}

function extractToken(req: NextRequest, params: { token?: string[] }): string {
  const header = req.headers.get('authorization') ?? ''
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return params.token?.[0] ?? ''
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token?: string[] }> }) {
  const user = await resolveMcpUser(extractToken(req, await ctx.params))
  if (!user) {
    return NextResponse.json(
      rpcError(null, -32001, '인증 실패 — WARP 내 계정 화면에서 AI 연결 토큰을 발급해 다시 연결하세요.'),
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(rpcError(null, -32700, 'JSON 파싱 실패'), { status: 400 })
  }

  // 배치(구버전 프로토콜)와 단건 모두 수용
  const messages: JsonRpcMessage[] = Array.isArray(body) ? body : [body as JsonRpcMessage]
  const responses = (await Promise.all(messages.map(m => handleMessage(user, m)))).filter(r => r !== null)

  if (responses.length === 0) return new NextResponse(null, { status: 202 }) // 알림만 온 경우
  const payload = Array.isArray(body) ? responses : responses[0]
  return NextResponse.json(payload)
}

// 이 서버는 서버발 스트림(GET)·세션(DELETE)을 제공하지 않는다 — 사양상 405 로 알린다.
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
