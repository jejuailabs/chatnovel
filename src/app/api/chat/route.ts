import { db } from '@/lib/db'
import { NextRequest } from 'next/server'
import { streamCompletion, GENESIS_PRESET } from '@/lib/ai'

const GENESIS_SYSTEM_PROMPT = `당신은 웹소설·웹툰·드라마 IP 창작을 돕는 전문 AI 어시스턴트입니다.
현재 프로젝트의 성경(기획서, 제작 성경)과 이미 확정된 노드들을 참고하여, 사용자의 아이디어를 확장하고 구체화하세요.

규칙:
- 새로운 아이디어가 등장하면 반드시 [NODE: 제목] 형식으로 명시하세요
- 캐릭터, 설정, 플롯, 로케이션, 모티프 등 다양한 방향을 제시하세요
- 사용자의 결정을 유도하는 질문을 던지세요
- 한국어로 응답하세요
- 창의적이고 구체적인 제안을 제공하세요`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, sessionId, message, bibleContent, nodesContent } = body

    if (!projectId || !sessionId || !message) {
      return new Response(JSON.stringify({ error: '필수 항목이 누락되었습니다.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Save user message
    await db.message.create({
      data: { sessionId, role: 'user', content: message },
    })

    // Load previous messages for context
    const prevMessages = await db.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })

    // Build context
    let contextStr = ''
    if (bibleContent) {
      contextStr += `\n\n--- 프로젝트 바이블 ---\n${bibleContent}`
    }
    if (nodesContent) {
      contextStr += `\n\n--- 확정된 노드들 ---\n${nodesContent}`
    }

    // Build messages array
    const messages = [
      { role: 'system', content: GENESIS_SYSTEM_PROMPT + contextStr },
      ...prevMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ]

    // Call AI SDK
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = ''
        try {
          for await (const delta of streamCompletion(messages, GENESIS_PRESET)) {
            fullResponse += delta
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`))
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))

          // Save assistant message
          const assistantMsg = await db.message.create({
            data: { sessionId, role: 'assistant', content: fullResponse },
          })

          // Extract nodes from response
          const nodeRegex = /\[NODE:\s*([^\]]+)\]/g
          const nodeTitles: string[] = []
          let match
          while ((match = nodeRegex.exec(fullResponse)) !== null) {
            nodeTitles.push(match[1].trim())
          }

          for (const title of nodeTitles) {
            await db.node.create({
              data: {
                projectId,
                title,
                content: `자동 추출된 노드: ${title}`,
                tags: '[]',
                status: 'pending',
                sessionId,
                originMessageId: assistantMsg.id,
              },
            })
          }

          // Record metric (estimated tokens)
          const inputTokens = Math.ceil(message.length / 2)
          const outputTokens = Math.ceil(fullResponse.length / 2)
          await db.metric.create({
            data: {
              projectId,
              eventType: 'chat',
              entityId: sessionId,
              inputTokens,
              outputTokens,
              costKrw: (inputTokens * 0.00001 + outputTokens * 0.00003),
            },
          })

          controller.close()
        } catch (err) {
          console.error('Stream error:', err)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'AI 응답 생성 중 오류가 발생했습니다.' })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(JSON.stringify({ error: '채팅 처리 중 오류가 발생했습니다.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
