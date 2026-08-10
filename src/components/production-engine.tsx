'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import EpisodeTree from '@/components/episode-tree'
import EpisodeEditor from '@/components/episode-editor'
import CanonTrackerPanel from '@/components/canon-tracker'
import BiblePanel from '@/components/bible-panel'
import BatchGenerate from '@/components/batch-generate'
import SearchPanel from '@/components/search-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollText, BookOpen, Download, Search, FileText, FileArchive } from 'lucide-react'
import { toast } from 'sonner'

export default function ProductionEngine() {
  const {
    currentProject,
    episodes,
    setEpisodes,
    setBibles,
    setCanonTracker,
  } = useAppStore()
  const [rightTab, setRightTab] = useState<'canon' | 'bible' | 'search'>('canon')

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

  const exportMarkdown = () => {
    if (!currentProject) return
    const sorted = [...episodes].sort((a, b) => (a.bu === b.bu ? a.hwa - b.hwa : a.bu - b.bu))
    const withContent = sorted.filter((e) => e.content && e.content.trim())
    if (withContent.length === 0) {
      toast.error('내보낼 원고가 없습니다.')
      return
    }
    let md = `# ${currentProject.title}\n\n`
    let curBu: number | null = null
    for (const e of withContent) {
      if (e.bu !== curBu) {
        md += `\n# ${e.bu}부\n\n`
        curBu = e.bu
      }
      md += `## ${e.bu}부 ${e.hwa}화\n\n${e.content}\n\n---\n\n`
    }
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentProject.title}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${withContent.length}개 회차를 Markdown으로 내보냈습니다.`)
  }

  const exportDocx = async () => {
    if (!currentProject) return
    toast.info('DOCX 생성 중...')
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/export-docx`)
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'DOCX 내보내기 실패')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentProject.title}.docx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('DOCX로 내보냈습니다.')
    } catch {
      toast.error('DOCX 내보내기에 실패했습니다.')
    }
  }

  const exportEpub = async () => {
    if (!currentProject) return
    toast.info('EPUB 생성 중...')
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/export-epub`)
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error || 'EPUB 내보내기 실패')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentProject.title}.epub`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('EPUB으로 내보냈습니다.')
    } catch {
      toast.error('EPUB 내보내기에 실패했습니다.')
    }
  }

  if (!currentProject) return null

  return (
    <div className="flex h-[calc(100vh-3.5rem-2.5rem)] overflow-hidden">
      {/* Left: Episode Tree */}
      <div className="w-[260px] border-r border-border flex flex-col shrink-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="text-xs font-semibold">에피소드 목록</span>
          <div className="flex items-center gap-1">
            <BatchGenerate />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" title="내보내기">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportMarkdown}>
                  <FileText className="h-3.5 w-3.5 mr-2" /> Markdown (.md)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportDocx}>
                  <FileText className="h-3.5 w-3.5 mr-2" /> Word (.docx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportEpub}>
                  <FileArchive className="h-3.5 w-3.5 mr-2" /> EPUB (.epub)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Badge variant="outline" className="text-[10px]">
              {episodes.length}화
            </Badge>
          </div>
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
            캐논
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
          <Button
            variant={rightTab === 'search' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-1.5 text-xs flex-1"
            onClick={() => setRightTab('search')}
          >
            <Search className="h-3.5 w-3.5" />
            검색
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          {rightTab === 'canon' && <CanonTrackerPanel />}
          {rightTab === 'bible' && <BiblePanel />}
          {rightTab === 'search' && <SearchPanel />}
        </div>
      </div>
    </div>
  )
}
