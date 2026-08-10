'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, Save, RotateCcw, CheckCircle2, Circle } from 'lucide-react'
import { toast } from 'sonner'
import { useState, useEffect, useCallback } from 'react'

const BIBLE_TYPES = [
  { value: 'concept', label: '기획서' },
  { value: 'production', label: '제작 성경' },
  { value: 'log', label: '창작 로그' },
]

const DEFAULT_CONTENT: Record<string, string> = {
  concept: JSON.stringify({
    title: '',
    logline: '',
    theme: '',
    targetAudience: '',
    genre: '',
    setting: '',
    coreConflict: '',
    characters: [],
    worldBuilding: '',
  }, null, 2),
  production: JSON.stringify({
    characters: [],
    locations: [],
    timeline: '',
    rules: '',
    items: [],
    relationships: [],
  }, null, 2),
  log: JSON.stringify({
    decisions: [],
    changes: [],
    notes: [],
  }, null, 2),
}

export default function BiblePanel() {
  const { currentProject, bibles, setBibles, updateBible } = useAppStore()
  const [activeTab, setActiveTab] = useState('concept')
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const getBible = useCallback((type: string) => {
    return bibles.find((b) => b.type === type)
  }, [bibles])

  const getContent = useCallback((type: string) => {
    const bible = getBible(type)
    if (!bible || !bible.content || bible.content === '{}') {
      return DEFAULT_CONTENT[type] || '{}'
    }
    return typeof bible.content === 'string'
      ? bible.content
      : JSON.stringify(bible.content, null, 2)
  }, [getBible])

  const handleEdit = (type: string) => {
    setEditing((prev) => ({ ...prev, [type]: getContent(type) }))
  }

  const handleCancel = (type: string) => {
    setEditing((prev) => {
      const next = { ...prev }
      delete next[type]
      return next
    })
  }

  const handleSave = async (type: string) => {
    if (!currentProject) return
    const content = editing[type]
    if (!content) return

    setSaving(type)
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/bibles/${type}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        const updated = await res.json()
        updateBible(type, updated)
        handleCancel(type)
        toast.success('바이블이 저장되었습니다.')
      }
    } catch {
      toast.error('저장 실패')
    } finally {
      setSaving(null)
    }
  }

  const getCompletionStatus = (type: string) => {
    const content = getContent(type)
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

  return (
    <div className="flex flex-col h-full w-[340px]">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="border-b border-border px-2 pt-2">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-semibold flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              바이블
            </span>
          </div>
          <TabsList className="w-full h-8">
            {BIBLE_TYPES.map((bt) => {
              const status = getCompletionStatus(bt.value)
              const bible = getBible(bt.value)
              return (
                <TabsTrigger key={bt.value} value={bt.value} className="text-xs flex-1 gap-1">
                  {bt.label}
                  {bible && bible.version > 0 && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                      v{bible.version}
                    </Badge>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        {BIBLE_TYPES.map((bt) => {
          const content = editing[bt.value] !== undefined ? editing[bt.value] : getContent(bt.value)
          const isEditing = editing[bt.value] !== undefined
          const status = getCompletionStatus(bt.value)

          return (
            <TabsContent key={bt.value} value={bt.value} className="flex-1 m-0 flex flex-col overflow-hidden">
              {/* Completion Bar */}
              <div className="px-3 py-2 border-b border-border">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>완성도</span>
                  <span>{status.total > 0 ? `${status.filled}/${status.total}` : '—'}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: status.total > 0 ? `${(status.filled / status.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden p-3">
                {isEditing ? (
                  <Textarea
                    value={content}
                    onChange={(e) => setEditing((prev) => ({ ...prev, [bt.value]: e.target.value }))}
                    className="h-full resize-none font-mono text-xs"
                  />
                ) : (
                  <ScrollArea className="h-full">
                    <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
                      {content}
                    </pre>
                  </ScrollArea>
                )}
              </div>

              {/* Actions */}
              <div className="border-t border-border p-2 flex gap-1.5">
                {isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs gap-1"
                      onClick={() => handleCancel(bt.value)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      취소
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => handleSave(bt.value)}
                      disabled={saving === bt.value}
                    >
                      <Save className="h-3 w-3" />
                      저장
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-7 text-xs gap-1"
                    onClick={() => handleEdit(bt.value)}
                  >
                    <BookOpen className="h-3 w-3" />
                    편집
                  </Button>
                )}
              </div>
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
