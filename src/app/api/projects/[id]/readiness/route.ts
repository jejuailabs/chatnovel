import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// 성경 컨텐츠의 채움 비율 계산 (BiblePanel 과 동일 규칙)
function fillRatio(content?: string): { filled: number; total: number } {
  if (!content) return { filled: 0, total: 0 }
  try {
    const parsed = JSON.parse(content)
    const total = Object.keys(parsed).length
    const filled = Object.values(parsed).filter((v) => {
      if (Array.isArray(v)) return v.length > 0
      if (typeof v === 'string') return v.trim().length > 0
      return !!v
    }).length
    return { filled, total }
  } catch {
    return { filled: 0, total: 0 }
  }
}

// Phase 1 완결 준비도 진단 (결정론적 · AI 비용 없음)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [nodes, bibles] = await Promise.all([
      db.node.findMany({ where: { projectId: id } }),
      db.bible.findMany({ where: { projectId: id } }),
    ])

    const confirmed = nodes.filter((n: any) => n.status === 'confirmed')
    const evolving = nodes.filter((n: any) => n.status === 'evolving')
    const pending = nodes.filter((n: any) => n.status === 'pending')

    // 카테고리(태그) 커버리지
    const categories = new Set<string>()
    for (const n of [...confirmed, ...evolving]) {
      try {
        const tags = JSON.parse((n as any).tags || '[]')
        if (Array.isArray(tags)) tags.forEach((t) => categories.add(String(t)))
      } catch {}
    }

    const byType = (t: string) => bibles.find((b: any) => b.type === t)?.content
    const concept = fillRatio(byType('concept'))
    const production = fillRatio(byType('production'))
    const conceptPct = concept.total ? concept.filled / concept.total : 0
    const productionPct = production.total ? production.filled / production.total : 0

    const checks = [
      {
        key: 'confirmedNodes',
        label: '확정 노드',
        value: `${confirmed.length}개`,
        ok: confirmed.length >= 3,
        hint: '최소 3개 확정 권장 (많을수록 원고 일관성↑)',
      },
      {
        key: 'categories',
        label: '카테고리 다양성',
        value: `${categories.size}종`,
        ok: categories.size >= 2,
        hint: '캐릭터·플롯·배경 등 2종 이상 권장',
      },
      {
        key: 'conceptBible',
        label: '기획서 완성도',
        value: `${Math.round(conceptPct * 100)}%`,
        ok: conceptPct >= 0.5,
        hint: '핵심 5원칙(로그라인·주제·인물 등) 절반 이상',
      },
      {
        key: 'productionBible',
        label: '제작 성경 완성도',
        value: `${Math.round(productionPct * 100)}%`,
        ok: productionPct >= 0.3,
        hint: '인물·로케이션·규칙 등 기재',
      },
    ]

    // 필수: 확정 노드 + 기획서. 나머지는 권장.
    const ready = checks.find((c) => c.key === 'confirmedNodes')!.ok &&
      checks.find((c) => c.key === 'conceptBible')!.ok

    // 분량 계산기 (§1.9): 재료 풍부도 → 뽑을 수 있는 분량 추정
    const richness =
      confirmed.length * 4 +
      evolving.length * 1 +
      categories.size * 3 +
      Math.round(conceptPct * 20) +
      Math.round(productionPct * 20)
    const low = Math.max(1, Math.round(richness * 0.8))
    const high = Math.max(low, Math.round(richness * 1.3))
    const capacity =
      richness > 0
        ? {
            webnovel: `${low}~${high}화 (회당 5,000자)`,
            webtoon: `${Math.max(1, Math.round(low / 2))}~${Math.round(high / 2)}화 (회당 약 20컷)`,
            drama: `${Math.max(1, Math.round(high / 12))}부작 (60분 기준)`,
          }
        : null

    return NextResponse.json({
      ready,
      checks,
      capacity,
      summary: {
        totalNodes: nodes.length,
        confirmed: confirmed.length,
        evolving: evolving.length,
        pending: pending.length,
        categories: categories.size,
      },
    })
  } catch (error) {
    console.error('readiness error:', error)
    return NextResponse.json({ error: '완결 판정에 실패했습니다.' }, { status: 500 })
  }
}
