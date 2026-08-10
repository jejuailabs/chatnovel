// AI 공급자 추상화 레이어
// - ANTHROPIC_API_KEY 가 있으면 실제 Claude 스트리밍을 사용
// - 없으면 목(mock) 응답을 스트리밍해서 키 없이도 전체 흐름을 확인할 수 있게 함

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// 단계별 모델 (비용 최적화 기본값: 둘 다 Sonnet 5)
// - 기획 품질을 최우선으로 하려면 ANTHROPIC_MODEL_GENESIS=claude-opus-4-6 으로 "고급 모드" 전환
export const GENESIS_MODEL =
  process.env.ANTHROPIC_MODEL_GENESIS || 'claude-sonnet-5'
export const EPISODE_MODEL =
  process.env.ANTHROPIC_MODEL_EPISODE || 'claude-sonnet-5'

// 단계별 프리셋: 사고(thinking) 사용 여부로 비용을 제어한다.
// - 기획: 창의성에 도움되는 가벼운 사고만 (effort medium)
// - 원고: 성경/트래커가 이미 컨텍스트에 있으므로 사고 OFF → 출력비 절감
export const GENESIS_PRESET = {
  model: GENESIS_MODEL,
  thinking: { type: 'adaptive' as const },
  effort: 'medium' as const,
}
export const EPISODE_PRESET = {
  model: EPISODE_MODEL,
  thinking: { type: 'disabled' as const },
}

export type CompletionOptions = {
  model?: string
  thinking?: { type: 'adaptive' } | { type: 'disabled' }
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
}

/** 스트리밍을 전부 모아 한 문자열로 반환 (JSON 생성 등 비스트리밍 용도) */
export async function complete(
  messages: ChatMessage[],
  opts: CompletionOptions = GENESIS_PRESET
): Promise<string> {
  let out = ''
  for await (const delta of streamCompletion(messages, opts)) out += delta
  return out
}

/** 응답 문자열에서 첫 JSON 객체를 추출·파싱 (코드펜스/잡텍스트 방어) */
export function extractJson<T = any>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

/**
 * messages 를 받아 텍스트 조각(delta)을 순차적으로 yield 하는 async iterable 반환.
 * @param opts 모델·사고·effort 프리셋 (기본값: 원고용 Sonnet, 사고 OFF)
 */
export async function* streamCompletion(
  messages: ChatMessage[],
  opts: CompletionOptions = EPISODE_PRESET
): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const model = opts.model || EPISODE_MODEL

  if (!apiKey) {
    yield* mockStream(messages)
    return
  }

  // Anthropic Messages API 는 system 을 별도 필드로 받음
  const systemPrompt = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')

  const chatMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }))

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: systemPrompt || undefined,
      messages: chatMessages,
      stream: true,
      thinking: opts.thinking,
      output_config: opts.effort ? { effort: opts.effort } : undefined,
    }),
  })

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Anthropic API error ${res.status}: ${errText}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        if (
          json.type === 'content_block_delta' &&
          json.delta?.type === 'text_delta' &&
          json.delta.text
        ) {
          yield json.delta.text as string
        }
      } catch {
        // 무시
      }
    }
  }
}

/**
 * 키가 없을 때 사용하는 목 스트리밍.
 * 마지막 사용자 메시지를 참고해 그럴듯한 한국어 응답을 만들어 글자 단위로 흘려보냄.
 */
async function* mockStream(messages: ChatMessage[]): AsyncGenerator<string> {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  const isEpisode = messages.some((m) => m.content.includes('원고를 작성'))

  let text: string
  if (isEpisode) {
    text = `[목(mock) 원고 · ANTHROPIC_API_KEY 를 설정하면 실제 Claude 원고가 생성됩니다]

한말리는 창밖으로 쏟아지는 가을 햇살을 바라보았다. 젖은 돌 냄새가 어디선가 스며들어 왔다. 그녀는 이유를 알 수 없는 거부감에 몸을 떨었다.

"제주에는 가지 않겠어요."

박다루는 아무 말 없이 그녀를 바라보았다. 두 사람 사이의 침묵이 방 안을 무겁게 채웠다.

(중략) — 이 자리에 성경과 캐논 트래커를 반영한 실제 회차 원고가 스트리밍됩니다.`
  } else {
    text = `[목(mock) 응답 · ANTHROPIC_API_KEY 를 설정하면 실제 Claude 응답이 생성됩니다]

좋은 출발점이네요! "${(lastUser?.content || '아이디어').slice(0, 40)}" 에서 여러 방향으로 확장해볼 수 있어요.

[NODE: 주인공의 숨겨진 과거]
[NODE: 제주를 거부하는 진짜 이유]
[NODE: 젖은 돌 냄새라는 감각 앵커]

이 중에서 어떤 방향을 먼저 파고들어 볼까요? 각각을 확정하면 자동으로 성경에 편입됩니다.`
  }

  for (const ch of text) {
    yield ch
    // 스트리밍 느낌을 위해 아주 짧게 대기
    await new Promise((r) => setTimeout(r, 4))
  }
}
