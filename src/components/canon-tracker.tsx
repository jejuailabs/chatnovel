'use client'

import { useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Save, Edit2, RotateCcw, Clock, Users, MapPin, GitBranch } from 'lucide-react'
import { toast } from 'sonner'

interface CanonState {
  timeline?: { day: number; season: string; year: string; note: string }
  characters?: Array<{ name: string; status: string; lastScene: string; note: string }>
  plots?: Array<{ title: string; status: 'pending' | 'resolved'; note: string }>
  locations?: Array<{ name: string; note: string }>
}

export default function CanonTrackerPanel() {
  const { currentProject, canonTracker, setCanonTracker } = useAppStore()
  const [editing, setEditing] = useState(false)
  const [rawContent, setRawContent] = useState('')
  const [saving, setSaving] = useState(false)

  const getState = useCallback((): CanonState => {
    if (!canonTracker?.state) return {}
    try {
      return JSON.parse(canonTracker.state)
    } catch {
      return {}
    }
  }, [canonTracker])

  const state = getState()

  const handleEdit = () => {
    setRawContent(canonTracker?.state || JSON.stringify({
      timeline: { day: 1, season: '봄', year: '1년차', note: '' },
      characters: [],
      plots: [],
      locations: [],
    }, null, 2))
    setEditing(true)
  }

  const handleSave = async () => {
    if (!currentProject) return
    setSaving(true)
    try {
      // Validate JSON
      JSON.parse(rawContent)
      const res = await fetch(`/api/projects/${currentProject.id}/canon-tracker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: rawContent }),
      })
      if (res.ok) {
        const updated = await res.json()
        setCanonTracker(updated)
        setEditing(false)
        toast.success('캐논 트래커가 저장되었습니다.')
      }
    } catch {
      toast.error('유효한 JSON이 아닙니다.')
    } finally {
      setSaving(false)
    }
  }

  const pendingPlots = (state.plots || []).filter(p => p.status === 'pending').length
  const resolvedPlots = (state.plots || []).filter(p => p.status === 'resolved').length

  if (editing) {
    return (
      <div className="flex flex-col h-full p-3 gap-2">
        <Textarea
          value={rawContent}
          onChange={(e) => setRawContent(e.target.value)}
          className="flex-1 resize-none font-mono text-xs"
        />
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={() => setEditing(false)}>
            <RotateCcw className="h-3 w-3" />취소
          </Button>
          <Button size="sm" className="flex-1 h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={handleSave} disabled={saving}>
            <Save className="h-3 w-3" />저장
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-3 space-y-4">
        {/* Timeline */}
        <Section title="타임라인" icon={Clock}>
          {state.timeline ? (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><span className="text-muted-foreground">일</span><p className="font-medium">{state.timeline.day}일</p></div>
              <div><span className="text-muted-foreground">계절</span><p className="font-medium">{state.timeline.season}</p></div>
              <div><span className="text-muted-foreground">연도</span><p className="font-medium">{state.timeline.year}</p></div>
              {state.timeline.note && <div className="col-span-3"><span className="text-muted-foreground">메모</span><p className="text-muted-foreground">{state.timeline.note}</p></div>}
            </div>
          ) : (
            <EmptyState text="타임라인 미설정" />
          )}
        </Section>

        {/* Characters */}
        <Section title={`캐릭터 (${(state.characters || []).length})`} icon={Users}>
          {(state.characters || []).length > 0 ? (
            <div className="space-y-2">
              {(state.characters || []).map((char, i) => (
                <div key={i} className="bg-muted/50 rounded-md p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{char.name}</span>
                    <Badge variant="outline" className="text-[10px]">{char.status}</Badge>
                  </div>
                  {char.lastScene && <p className="text-[10px] text-muted-foreground mt-1">최근 장면: {char.lastScene}</p>}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="캐릭터 미등록" />
          )}
        </Section>

        {/* Plots */}
        <Section title={`플롯 (${pendingPlots} 대기 / ${resolvedPlots} 해결)`} icon={GitBranch}>
          {(state.plots || []).length > 0 ? (
            <div className="space-y-2">
              {(state.plots || []).map((plot, i) => (
                <div key={i} className="bg-muted/50 rounded-md p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{plot.title}</span>
                    <Badge variant={plot.status === 'resolved' ? 'default' : 'outline'} className="text-[10px]">
                      {plot.status === 'resolved' ? '해결' : '대기'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="플롯 미등록" />
          )}
        </Section>

        {/* Locations */}
        <Section title={`로케이션 (${(state.locations || []).length})`} icon={MapPin}>
          {(state.locations || []).length > 0 ? (
            <div className="space-y-2">
              {(state.locations || []).map((loc, i) => (
                <div key={i} className="bg-muted/50 rounded-md p-2">
                  <span className="text-xs font-medium">{loc.name}</span>
                  {loc.note && <p className="text-[10px] text-muted-foreground mt-1">{loc.note}</p>}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="로케이션 미등록" />
          )}
        </Section>
      </ScrollArea>

      <div className="border-t border-border p-2">
        <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1" onClick={handleEdit}>
          <Edit2 className="h-3 w-3" />편집
        </Button>
      </div>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Clock; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-semibold">{title}</span>
      </div>
      {children}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-[10px] text-muted-foreground py-2">{text}</p>
}