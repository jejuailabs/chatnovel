'use client'

import { useState, useMemo } from 'react'
import { useAppStore, type Episode } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus,
  ChevronDown,
  ChevronRight,
  FileText,
  CheckCircle2,
  Eye,
  PenLine,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

const STATUS_CONFIG: Record<string, { color: string; icon: typeof FileText; label: string }> = {
  draft: { color: 'text-gray-500', icon: PenLine, label: '초안' },
  reviewed: { color: 'text-amber-500', icon: Eye, label: '검토' },
  approved: { color: 'text-emerald-500', icon: CheckCircle2, label: '승인' },
}

export default function EpisodeTree() {
  const {
    currentProject,
    episodes,
    selectedEpisodeId,
    setSelectedEpisodeId,
    addEpisode,
  } = useAppStore()

  const [expandedBus, setExpandedBus] = useState<Set<number>>(new Set())
  const [showNew, setShowNew] = useState(false)
  const [newBu, setNewBu] = useState('1')
  const [newHwa, setNewHwa] = useState('1')

  // Group episodes by 부
  const grouped = useMemo(() => {
    const map = new Map<number, Episode[]>()
    for (const ep of episodes) {
      const list = map.get(ep.bu) || []
      list.push(ep)
      map.set(ep.bu, list)
    }
    // Sort
    for (const [bu, list] of map) {
      list.sort((a, b) => a.hwa - b.hwa)
    }
    return new Map([...map].sort((a, b) => a[0] - b[0]))
  }, [episodes])

  const toggleBu = (bu: number) => {
    setExpandedBus((prev) => {
      const next = new Set(prev)
      if (next.has(bu)) next.delete(bu)
      else next.add(bu)
      return next
    })
  }

  const handleCreate = async () => {
    if (!currentProject) return
    const bu = parseInt(newBu) || 1
    const hwa = parseInt(newHwa) || 1
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bu, hwa }),
      })
      if (res.ok) {
        const episode = await res.json()
        addEpisode(episode)
        setSelectedEpisodeId(episode.id)
        setShowNew(false)
        toast.success(`${bu}부 ${hwa}화가 생성되었습니다.`)
      } else {
        const data = await res.json()
        toast.error(data.error || '생성 실패')
      }
    } catch {
      toast.error('에피소드 생성 실패')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {Array.from(grouped.entries()).map(([bu, eps]) => {
            const isExpanded = expandedBus.has(bu)
            return (
              <div key={bu}>
                <button
                  onClick={() => toggleBu(bu)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="text-xs font-semibold">{bu}부</span>
                  <Badge variant="secondary" className="text-[10px] ml-auto">
                    {eps.length}화
                  </Badge>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      {eps.map((ep) => {
                        const config = STATUS_CONFIG[ep.status] || STATUS_CONFIG.draft
                        const Icon = config.icon
                        return (
                          <button
                            key={ep.id}
                            onClick={() => setSelectedEpisodeId(ep.id)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 pl-7 rounded-md text-left transition-colors ${
                              selectedEpisodeId === ep.id
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
                            <span className="text-xs flex-1 truncate">{bu}부 {ep.hwa}화</span>
                            {ep.wordCount > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {ep.wordCount}자
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}

          {grouped.size === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              에피소드가 없습니다
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-2 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 text-xs"
          onClick={() => setShowNew(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          새 에피소드
        </Button>
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 에피소드 생성</DialogTitle>
          </DialogHeader>
          <div className="flex gap-4 py-2">
            <div className="space-y-2 flex-1">
              <Label>부</Label>
              <Input
                type="number"
                value={newBu}
                onChange={(e) => setNewBu(e.target.value)}
                min={1}
              />
            </div>
            <div className="space-y-2 flex-1">
              <Label>화</Label>
              <Input
                type="number"
                value={newHwa}
                onChange={(e) => setNewHwa(e.target.value)}
                min={1}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
            <Button onClick={handleCreate} className="bg-amber-600 hover:bg-amber-700 text-white">
              생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
