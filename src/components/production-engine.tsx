'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import EpisodeTree from '@/components/episode-tree'
import EpisodeEditor from '@/components/episode-editor'
import CanonTrackerPanel from '@/components/canon-tracker'
import BiblePanel from '@/components/bible-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollText, BookOpen } from 'lucide-react'

export default function ProductionEngine() {
  const {
    currentProject,
    episodes,
    setEpisodes,
    setBibles,
    setCanonTracker,
  } = useAppStore()
  const [rightTab, setRightTab] = useState<'canon' | 'bible'>('canon')

  const projectId = currentProject?.id

  // Production 진입 시 필요한 데이터 로드 (성경·트래커·에피소드)
  useEffect(() => {
    if (!projectId) return
    fetch(`/api/projects/${projectId}/episodes`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setEpisodes(d))
      .catch(() => {})
    fetch(`/api/projects/${projectId}/bibles`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setBibles(d))
      .catch(() => {})
    fetch(`/api/projects/${projectId}/canon-tracker`)
      .then((r) => r.json())
      .then((d) => setCanonTracker(d))
      .catch(() => {})
  }, [projectId, setEpisodes, setBibles, setCanonTracker])

  if (!currentProject) return null

  return (
    <div className="flex h-[calc(100vh-3.5rem-2.5rem)] overflow-hidden">
      {/* Left: Episode Tree */}
      <div className="w-[260px] border-r border-border flex flex-col shrink-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="text-xs font-semibold">에피소드 목록</span>
          <Badge variant="outline" className="text-[10px]">
            {episodes.length}화
          </Badge>
        </div>
        <div className="flex-1 overflow-hidden">
          <EpisodeTree />
        </div>
      </div>

      {/* Center: Episode Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        <EpisodeEditor />
      </div>

      {/* Right: 캐논 트래커 / 성경 탭 */}
      <div className="w-[340px] border-l border-border flex flex-col shrink-0">
        <div className="flex items-center gap-1 p-1 border-b border-border">
          <Button
            variant={rightTab === 'canon' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-1.5 text-xs flex-1"
            onClick={() => setRightTab('canon')}
          >
            <ScrollText className="h-3.5 w-3.5" />
            캐논 트래커
          </Button>
          <Button
            variant={rightTab === 'bible' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-1.5 text-xs flex-1"
            onClick={() => setRightTab('bible')}
          >
            <BookOpen className="h-3.5 w-3.5" />
            성경
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          {rightTab === 'canon' ? <CanonTrackerPanel /> : <BiblePanel />}
        </div>
      </div>
    </div>
  )
}
