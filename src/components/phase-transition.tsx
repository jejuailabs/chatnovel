'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { BookText, Rocket, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function PhaseTransition() {
  const { currentProject, setBibles, selectProject } = useAppStore()
  const [synthLoading, setSynthLoading] = useState(false)
  const [checkOpen, setCheckOpen] = useState(false)
  const [readiness, setReadiness] = useState<any>(null)
  const [checking, setChecking] = useState(false)
  const [advancing, setAdvancing] = useState(false)

  if (!currentProject) return null
  const pid = currentProject.id

  const synthesizeBible = async () => {
    setSynthLoading(true)
    try {
      const res = await fetch(`/api/projects/${pid}/synthesize-bible`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '성경 생성 실패')
        return
      }
      // 성경 새로고침
      const bibles = await fetch(`/api/projects/${pid}/bibles`).then((r) => r.json())
      setBibles(bibles)
      toast.success('확정 노드로 성경 3종을 생성했습니다.')
    } catch {
      toast.error('성경 자동 생성에 실패했습니다.')
    } finally {
      setSynthLoading(false)
    }
  }

  const openCheck = async () => {
    setCheckOpen(true)
    setChecking(true)
    setReadiness(null)
    try {
      const data = await fetch(`/api/projects/${pid}/readiness`).then((r) => r.json())
      setReadiness(data)
    } catch {
      toast.error('완결 판정에 실패했습니다.')
    } finally {
      setChecking(false)
    }
  }

  const advance = async () => {
    setAdvancing(true)
    try {
      const res = await fetch(`/api/projects/${pid}/advance-phase`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Phase 2 전환 실패')
        return
      }
      toast.success('Phase 2 · Production 으로 진입합니다.')
      setCheckOpen(false)
      selectProject(data.project) // phase=2 → production 뷰로 전환
    } catch {
      toast.error('Phase 2 전환에 실패했습니다.')
    } finally {
      setAdvancing(false)
    }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 shrink-0">
      <span className="text-xs text-muted-foreground mr-auto hidden md:block">
        재료(노드)를 확정 → <b>성경 자동 생성</b> → <b>완결 판정</b> → <b>Phase 2 진입</b>
      </span>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs h-8"
        onClick={synthesizeBible}
        disabled={synthLoading}
      >
        {synthLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookText className="h-3.5 w-3.5" />}
        성경 자동 생성
      </Button>
      <Button
        size="sm"
        className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
        onClick={openCheck}
      >
        <Rocket className="h-3.5 w-3.5" />
        완결 판정 · Phase 2
      </Button>

      <Dialog open={checkOpen} onOpenChange={setCheckOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Phase 1 완결 판정</DialogTitle>
          </DialogHeader>

          {checking ? (
            <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> 진단 중...
            </div>
          ) : readiness ? (
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                {readiness.checks?.map((c: any) => (
                  <div key={c.key} className="flex items-start gap-2">
                    {c.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{c.label}</span>
                        <span className="text-sm text-muted-foreground">{c.value}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{c.hint}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-xs text-muted-foreground border-t border-border pt-2">
                노드 {readiness.summary?.totalNodes ?? 0}개 (확정 {readiness.summary?.confirmed ?? 0} ·
                진화 {readiness.summary?.evolving ?? 0} · 대기 {readiness.summary?.pending ?? 0})
              </div>

              <div
                className={`text-sm rounded-md px-3 py-2 ${
                  readiness.ready
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                }`}
              >
                {readiness.ready
                  ? '✅ 준비 완료 — Phase 2로 진입해도 좋습니다.'
                  : '⚠️ 아직 재료가 부족하지만, 원하면 지금 진입할 수 있습니다.'}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckOpen(false)}>
              계속 확장
            </Button>
            <Button
              onClick={advance}
              disabled={advancing}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              Phase 2 진입
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
