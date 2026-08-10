'use client'

import { useAppStore } from '@/lib/store'
import EpisodeTree from '@/components/episode-tree'
import EpisodeEditor from '@/components/episode-editor'
import CanonTrackerPanel from '@/components/canon-tracker'
import { Badge } from '@/components/ui/badge'
import { ScrollText } from 'lucide-react'

export default function ProductionEngine() {
  const { currentProject, episodes } = useAppStore()

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

      {/* Right: Canon Tracker */}
      <div className="w-[320px] border-l border-border flex flex-col shrink-0">
        <div className="flex items-center gap-1.5 p-3 border-b border-border">
          <ScrollText className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">캐논 트래커</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <CanonTrackerPanel />
        </div>
      </div>
    </div>
  )
}
