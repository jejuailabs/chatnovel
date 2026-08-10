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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Layers, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

type Row = { bu: number; hwa: number; status: 'generating' | 'done'; wordCount?: number }

export default function BatchGenerate() {
  const { currentProject } = useAppStore()
  const [open, setOpen] = useState(false)
  const [bu, setBu] = useState('1')
  const [fromHwa, setFromHwa] = useState('1')
  const [count, setCount] = useState('3')
  const [running, setRunning] = useState(false)
  const [rows, setRows] = useState<Row[]>([])

  if (!currentProject) return null
  const pid = currentProject.id
  const n = Math.max(1, Math.min(10, parseInt(count) || 1))

  const run = async () => {
    setRunning(true)
    setRows([])
    try {
      const res = await fetch(`/api/projects/${pid}/generate-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bu: parseInt(bu) || 1, fromHwa: parseInt(fromHwa) || 1, count: n }),
      })
      if (!res.ok || !res.body) throw new Error('stream error')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            const ev = JSON.parse(line.slice(6))
            if (ev.type === 'progress') {
              setRows((prev) => {
                const others = prev.filter((r) => !(r.bu === ev.bu && r.hwa === ev.hwa))
                return [...others, { bu: ev.bu, hwa: ev.hwa, status: ev.status, wordCount: ev.wordCount }].sort(
                  (a, b) => (a.bu === b.bu ? a.hwa - b.hwa : a.bu - b.bu)
                )
              })
            } else if (ev.type === 'error') {
              toast.error(ev.error)
            }
          } catch {}
        }
      }
      // 완료 후 새로고침
      const store = useAppStore.getState()
      fetch(`/api/projects/${pid}/episodes`).then((r) => r.json()).then((d) => Array.isArray(d) && store.setEpisodes(d))
      fetch(`/api/projects/${pid}/canon-tracker`).then((r) => r.json()).then((t) => store.setCanonTracker(t))
      toast.success('배치 생성이 완료되었습니다.')
    } catch {
      toast.error('배치 생성에 실패했습니다.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        title="배치 생성 (여러 화 한 번에)"
        onClick={() => setOpen(true)}
      >
        <Layers className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={(v) => !running && setOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>배치 생성 · 여러 화 한 번에</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex gap-3">
              <div className="space-y-1 flex-1">
                <Label className="text-xs">부</Label>
                <Input type="number" value={bu} onChange={(e) => setBu(e.target.value)} min={1} disabled={running} />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs">시작 화</Label>
                <Input type="number" value={fromHwa} onChange={(e) => setFromHwa(e.target.value)} min={1} disabled={running} />
              </div>
              <div className="space-y-1 flex-1">
                <Label className="text-xs">개수 (1~10)</Label>
                <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} min={1} max={10} disabled={running} />
              </div>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-md p-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                {bu}부 {fromHwa}화부터 <b>{n}개 회차</b>를 순차 생성합니다. 회차마다 AI 원고 생성 + 트래커 갱신이
                일어나 <b>토큰 비용이 발생</b>합니다.
              </span>
            </div>

            {rows.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-md p-2">
                {rows.map((r) => (
                  <div key={`${r.bu}-${r.hwa}`} className="flex items-center gap-2 text-xs">
                    {r.status === 'done' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                    )}
                    <span className="flex-1">{r.bu}부 {r.hwa}화</span>
                    <span className="text-muted-foreground">
                      {r.status === 'done' ? `${r.wordCount}자` : '생성 중...'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>
              닫기
            </Button>
            <Button
              onClick={run}
              disabled={running}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
              {running ? '생성 중...' : `${n}개 회차 생성`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
