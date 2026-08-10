'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore, type Episode } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sparkles,
  Save,
  Check,
  Eye,
  PenLine,
  Loader2,
  Coins,
  Type,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import { motion } from 'framer-motion'

export default function EpisodeEditor() {
  const {
    currentProject,
    episodes,
    selectedEpisodeId,
    updateEpisode,
    bibles,
    canonTracker,
  } = useAppStore()

  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [generating, setGenerating] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ consistent: boolean; issues: any[] } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const episode = episodes.find((e) => e.id === selectedEpisodeId)

  useEffect(() => {
    if (episode) {
      setEditContent(episode.content)
      setStreamContent('')
      setEditMode(false)
    }
  }, [episode?.id])

  useEffect(() => {
    if (scrollRef.current && generating) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [streamContent, generating])

  const handleStatusChange = async (status: string) => {
    if (!currentProject || !episode) return
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/episodes/${episode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const updated = await res.json()
        updateEpisode(episode.id, updated)
        toast.success(`상태가 '${status === 'draft' ? '초안' : status === 'reviewed' ? '검토' : '승인'}'으로 변경되었습니다.`)
      }
    } catch {
      toast.error('상태 변경 실패')
    }
  }

  const handleSaveContent = async () => {
    if (!currentProject || !episode) return
    setSaving(true)
    try {
      const wordCount = editContent.replace(/\s/g, '').length
      const res = await fetch(`/api/projects/${currentProject.id}/episodes/${episode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent, wordCount }),
      })
      if (res.ok) {
        const updated = await res.json()
        updateEpisode(episode.id, updated)
        setEditMode(false)
        toast.success('저장되었습니다.')
      }
    } catch {
      toast.error('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    if (!currentProject || !episode || generating) return
    setGenerating(true)
    setStreamContent('')
    setEditMode(false)

    try {
      // Build context
      const bibleContent = bibles
        .map((b) => `[${b.type}] ${b.content}`)
        .join('\n\n')

      const prevEps = episodes
        .filter((e) => (e.bu < episode.bu || (e.bu === episode.bu && e.hwa < episode.hwa)) && e.content)
        .sort((a, b) => a.bu === b.bu ? a.hwa - b.hwa : a.bu - b.bu)
        .slice(-3)

      const response = await fetch('/api/generate-episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProject.id,
          bu: episode.bu,
          hwa: episode.hwa,
          bibleContent,
          canonTrackerState: canonTracker?.state || '{}',
          previousEpisodes: prevEps,
        }),
      })

      if (!response.ok || !response.body) throw new Error('Stream error')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.error) {
                toast.error(parsed.error)
                continue
              }
              if (parsed.content) {
                fullContent += parsed.content
                setStreamContent(fullContent)
              }
            } catch {}
          }
        }
      }

      // Refresh episodes + 자동 갱신된 캐논 트래커
      const store = useAppStore.getState()
      const epsRes = await fetch(`/api/projects/${currentProject.id}/episodes`)
      if (epsRes.ok) {
        store.setEpisodes(await epsRes.json())
      }
      fetch(`/api/projects/${currentProject.id}/canon-tracker`)
        .then((r) => r.json())
        .then((t) => store.setCanonTracker(t))
        .catch(() => {})

      toast.success('에피소드 생성 완료 · 캐논 트래커가 갱신되었습니다.')
    } catch {
      toast.error('에피소드 생성에 실패했습니다.')
    } finally {
      setGenerating(false)
      setStreamContent('')
    }
  }

  const handleVerify = async () => {
    if (!currentProject || !episode || verifying) return
    if (!episode.content?.trim()) {
      toast.error('먼저 원고를 생성하거나 작성하세요.')
      return
    }
    setVerifying(true)
    setVerifyResult(null)
    setVerifyOpen(true)
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/episodes/${episode.id}/verify`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '검증 실패')
        setVerifyOpen(false)
        return
      }
      setVerifyResult(data)
    } catch {
      toast.error('일관성 검증에 실패했습니다.')
      setVerifyOpen(false)
    } finally {
      setVerifying(false)
    }
  }

  if (!episode) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center gap-3">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <PenLine className="h-8 w-8 text-amber-600/40" />
          </div>
          <h2 className="text-lg font-semibold mb-1">Production Engine</h2>
          <p className="text-sm text-muted-foreground">
            에피소드를 선택하거나 새 에피소드를 생성하세요
          </p>
        </div>
      </div>
    )
  }

  const displayContent = generating ? streamContent : episode.content
  const statusConfig = {
    draft: { label: '초안', color: 'bg-gray-500', icon: PenLine },
    reviewed: { label: '검토', color: 'bg-amber-500', icon: Eye },
    approved: { label: '승인', color: 'bg-emerald-500', icon: Check },
  }
  const sc = statusConfig[episode.status as keyof typeof statusConfig] || statusConfig.draft
  const StatusIcon = sc.icon

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-wrap">
        <div className="flex items-center gap-2 mr-auto">
          <h2 className="text-sm font-semibold">{episode.bu}부 {episode.hwa}화</h2>
          <Badge variant="outline" className="gap-1 text-xs">
            <StatusIcon className={`h-3 w-3 ${sc.color.replace('bg-', 'text-')}`} />
            {sc.label}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {episode.wordCount > 0 && (
            <span className="flex items-center gap-1"><Type className="h-3 w-3" />{episode.wordCount}자</span>
          )}
          {episode.tokenUsed > 0 && (
            <span className="flex items-center gap-1"><Coins className="h-3 w-3" />{episode.costKrw.toFixed(1)}원</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {editMode ? (
            <>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setEditMode(false); setEditContent(episode.content) }}>
                취소
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={handleSaveContent} disabled={saving}>
                <Save className="h-3 w-3" />저장
              </Button>
            </>
          ) : (
            <>
              <Select value={episode.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-7 w-[90px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">초안</SelectItem>
                  <SelectItem value="reviewed">검토</SelectItem>
                  <SelectItem value="approved">승인</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setEditMode(true)}>
                <PenLine className="h-3 w-3" />편집
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleVerify}
                disabled={verifying || !episode.content?.trim()}
              >
                {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                일관성 검증
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                AI 생성
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {editMode ? (
          <div className="p-4 h-full">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="h-full resize-none font-mono text-sm leading-relaxed"
              placeholder="에피소드 내용을 작성하세요..."
            />
          </div>
        ) : displayContent ? (
          <div className="p-6 max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="prose prose-sm dark:prose-invert max-w-none leading-relaxed"
            >
              <ReactMarkdown>{displayContent}</ReactMarkdown>
              {generating && <span className="animate-pulse ml-0.5">▊</span>}
            </motion.div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Sparkles className="h-10 w-10 text-amber-500/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                아직 내용이 없습니다
              </p>
              <Button
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                AI로 원고 생성
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 일관성 검증 결과 */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>원고-성경 일관성 검증</DialogTitle>
          </DialogHeader>
          {verifying ? (
            <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> 성경·트래커와 대조 중...
            </div>
          ) : verifyResult ? (
            verifyResult.consistent ? (
              <div className="py-6 flex flex-col items-center gap-2 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="text-sm font-medium">일관성 문제가 발견되지 않았습니다.</p>
                <p className="text-xs text-muted-foreground">성경·트래커와 어긋나는 지점이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2 py-2 max-h-[50vh] overflow-y-auto">
                <p className="text-xs text-muted-foreground">
                  {verifyResult.issues.length}건의 불일치가 발견되었습니다.
                </p>
                {verifyResult.issues.map((iss, i) => (
                  <div key={i} className="rounded-md border border-border p-2.5 space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className={`h-3.5 w-3.5 shrink-0 ${
                          iss.severity === 'high'
                            ? 'text-red-500'
                            : iss.severity === 'medium'
                            ? 'text-amber-500'
                            : 'text-gray-400'
                        }`}
                      />
                      <Badge variant="outline" className="text-[10px]">{iss.type}</Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto">기준: {iss.source}</span>
                    </div>
                    <p className="text-xs">{iss.detail}</p>
                    {iss.suggestion && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400">💡 {iss.suggestion}</p>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
