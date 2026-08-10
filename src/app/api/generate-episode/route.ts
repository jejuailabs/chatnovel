import { db } from '@/lib/db'
import { NextRequest } from 'next/server'
import { streamCompletion, EPISODE_PRESET } from '@/lib/ai'

const EPISODE_SYSTEM_PROMPT = `당신은 웹소설·웹툰·드라마의 에피소드 원고를 작성하는 전문 AI 작가입니다.

지침:
- 제공된 바이블(기획서, 제작 성경)을 엄격히 준수하세요
- 캐논 트래커의 현재 상태를 반영하여 일관성을 유지하세요
- 이전 에피소드의 내용과 자연스럽게 이어지도록 작성하세요
- 캐릭터의 성격, 관계, 현재 상태를 일관되게 유지하세요
- 한국어로 작성하세요
- 에피소드 길이는 약 3000~5000자 정도로 작성하세요
- 대사와 행동描写를 균형 있게 배치하세요
- 장면 전환을 자연스럽게 처리하세요`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, bu, hwa, bibleContent, canonTrackerState, previousEpisodes } = body

    if (!projectId || bu === undefined || hwa === undefined) {
      return new Response(JSON.stringify({ error: '필수 항목이 누락되었습니다.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Find or create episode
    let episode = await db.episode.findUnique({
      where: { projectId_bu_hwa: { projectId, bu, hwa } },
    })

    if (!episode) {
      episode = await db.episode.create({
        data: { projectId, bu, hwa },
      })
    }

    // Build context
    let contextParts = []

    if (bibleContent) {
      contextParts.push(`--- 프로젝트 바이블 ---\n${bibleContent}`)
    }

    if (canonTrackerState) {
      contextParts.push(`--- 캐논 트래커 (현재 상태) ---\n${canonTrackerState}`)
    }

    if (previousEpisodes && previousEpisodes.length > 0) {
      const prevText = previousEpisodes
        .map((ep: { bu: number; hwa: number; content: string }) =>
          `[${ep.bu}부 ${ep.hwa}화]\n${ep.content}`
        )
        .join('\n\n')
      contextParts.push(`--- 이전 에피소드 ---\n${prevText}`)
    }

    const userMessage = `${bu}부 ${hwa}화의 원고를 작성해주세요.\n${contextParts.length > 0 ? '\n' + contextParts.join('\n\n') : ''}`

    const messages = [
      { role: 'system', content: EPISODE_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ]

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = ''
        try {
          for await (const delta of streamCompletion(messages, EPISODE_PRESET)) {
            fullResponse += delta
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`))
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))

          // Calculate metrics
          const wordCount = fullResponse.replace(/\s/g, '').length
          const inputTokens = Math.ceil(userMessage.length / 2)
          const outputTokens = Math.ceil(fullResponse.length / 2)
          const costKrw = inputTokens * 0.00001 + outputTokens * 0.00003

          // Update episode
          await db.episode.update({
            where: { id: episode.id },
            data: { content: fullResponse, wordCount, tokenUsed: inputTokens + outputTokens, costKrw, status: 'draft' },
          })

          // Record metric
          await db.metric.create({
            data: {
              projectId,
              eventType: 'episode_generation',
              entityId: episode.id,
              inputTokens,
              outputTokens,
              costKrw,
            },
          })

          controller.close()
        } catch (err) {
          console.error('Episode generation error:', err)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: '에피소드 생성 중 오류가 발생했습니다.' })}\n\n`))
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
    console.error('Generate episode API error:', error)
    return new Response(JSON.stringify({ error: '에피소드 생성 중 오류가 발생했습니다.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
