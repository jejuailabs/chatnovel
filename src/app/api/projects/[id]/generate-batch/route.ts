import { db } from '@/lib/db'
import { complete, extractJson, EPISODE_PRESET } from '@/lib/ai'
import { NextRequest } from 'next/server'

const EPISODE_SYSTEM_PROMPT = `당신은 웹소설·웹툰·드라마의 에피소드 원고를 작성하는 전문 AI 작가입니다.
지침:
- 제공된 바이블(기획서, 제작 성경)을 엄격히 준수하세요
- 캐논 트래커의 현재 상태를 반영하여 일관성을 유지하세요
- 이전 에피소드의 내용과 자연스럽게 이어지도록 작성하세요
- 한국어로 작성하세요
- 에피소드 길이는 약 3000~5000자 정도로 작성하세요`

const TRACKER_PROMPT = `당신은 웹소설 연속성(캐논) 관리자입니다.
'현재 캐논 트래커'와 '새로 완성된 회차 원고'를 보고, 트래커를 갱신한 JSON을 출력하세요.
반드시 아래 스키마의 JSON 객체 하나만 출력하세요 (설명·코드펜스 없이):
{"timeline":{"day":정수,"season":"계절","year":"N년차","note":"핵심 사건"},"characters":[{"name":"이름","status":"현재 상태","lastScene":"최근 등장 회차","note":"메모"}],"plots":[{"title":"복선/사건","status":"pending 또는 resolved","note":"메모"}],"locations":[{"name":"장소","note":"메모"}]}
- 기존 항목은 유지하되 이번 회차 내용을 반영해 갱신하고, 새로 등장한 요소를 추가하세요.`

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const body = await req.json()
  const { bu, fromHwa, count } = body as { bu: number; fromHwa: number; count: number }

  const n = Math.max(1, Math.min(10, Number(count) || 1))
  const startHwa = Number(fromHwa) || 1
  const buNum = Number(bu) || 1

  const encoder = new TextEncoder()
  const send = (controller: ReadableStreamDefaultController, obj: any) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 컨텍스트 1회 로드
        const bibles = await db.bible.findMany({ where: { projectId } })
        const bibleContent = bibles.map((b: any) => `[${b.type}] ${b.content}`).join('\n\n')
        const tracker = await db.canonTracker.findUnique({ where: { projectId } })
        let trackerState = tracker?.state || '{}'
        const allEpisodes = await db.episode.findMany({ where: { projectId } })
        const generated: { bu: number; hwa: number; content: string }[] = []

        send(controller, { type: 'start', total: n })

        for (let i = 0; i < n; i++) {
          const hwa = startHwa + i
          send(controller, { type: 'progress', index: i + 1, total: n, bu: buNum, hwa, status: 'generating' })

          // 에피소드 확보
          let episode = await db.episode.findUnique({
            where: { projectId_bu_hwa: { projectId, bu: buNum, hwa } },
          })
          if (!episode) {
            episode = await db.episode.create({ data: { projectId, bu: buNum, hwa } })
          }

          // 직전 3화 (기존 + 이번 배치에서 생성한 것)
          const prevPool = [
            ...allEpisodes
              .filter((e: any) => e.content && (e.bu < buNum || (e.bu === buNum && e.hwa < hwa)))
              .map((e: any) => ({ bu: e.bu, hwa: e.hwa, content: e.content })),
            ...generated,
          ]
            .sort((a, b) => (a.bu === b.bu ? a.hwa - b.hwa : a.bu - b.bu))
            .slice(-3)
          const prevText = prevPool.map((e) => `[${e.bu}부 ${e.hwa}화]\n${e.content}`).join('\n\n')

          const userMessage = `${buNum}부 ${hwa}화의 원고를 작성해주세요.\n\n--- 바이블 ---\n${bibleContent}\n\n--- 캐논 트래커 ---\n${trackerState}${prevText ? `\n\n--- 이전 에피소드 ---\n${prevText}` : ''}`

          const content = await complete(
            [
              { role: 'system', content: EPISODE_SYSTEM_PROMPT },
              { role: 'user', content: userMessage },
            ],
            EPISODE_PRESET
          )

          const wordCount = content.replace(/\s/g, '').length
          const inputTokens = Math.ceil(userMessage.length / 2)
          const outputTokens = Math.ceil(content.length / 2)
          const costKrw = inputTokens * 0.00001 + outputTokens * 0.00003

          await db.episode.update({
            where: { id: episode.id },
            data: { content, wordCount, tokenUsed: inputTokens + outputTokens, costKrw, status: 'draft' },
          })
          await db.metric.create({
            data: { projectId, eventType: 'episode_generation', entityId: episode.id, inputTokens, outputTokens, costKrw },
          })
          generated.push({ bu: buNum, hwa, content })

          // 트래커 갱신 (실패 무해)
          try {
            const out = await complete(
              [
                { role: 'system', content: TRACKER_PROMPT },
                { role: 'user', content: `[현재 캐논 트래커]\n${trackerState}\n\n[새 회차: ${buNum}부 ${hwa}화]\n${content}` },
              ],
              EPISODE_PRESET
            )
            const next = extractJson(out)
            if (next) {
              trackerState = JSON.stringify(next, null, 2)
              const ex = await db.canonTracker.findUnique({ where: { projectId } })
              if (ex) {
                await db.canonTracker.update({
                  where: { projectId },
                  data: { state: trackerState, version: (ex.version || 0) + 1, lastUpdated: new Date() },
                })
              } else {
                await db.canonTracker.create({ data: { projectId, state: trackerState, version: 1 } })
              }
            }
          } catch (e) {
            console.error('batch tracker update skipped:', e)
          }

          send(controller, { type: 'progress', index: i + 1, total: n, bu: buNum, hwa, status: 'done', wordCount })
        }

        send(controller, { type: 'done', total: n })
        controller.close()
      } catch (err) {
        console.error('generate-batch error:', err)
        const msg = err instanceof Error ? err.message : '배치 생성 중 오류가 발생했습니다.'
        send(controller, { type: 'error', error: msg })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
}
