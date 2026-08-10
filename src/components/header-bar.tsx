'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sparkles,
  LayoutDashboard,
  Plus,
  ChevronLeft,
  Coins,
  BookOpen,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

const GENRES = ['웹소설', '웹툰', '드라마', '영화', '게임 시나리오']

export default function HeaderBar() {
  const {
    currentView,
    currentProject,
    metricSummary,
    setCurrentView,
    setProjects,
    selectProject,
    clearProject,
  } = useAppStore()

  const [showNewDialog, setShowNewDialog] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newGenre, setNewGenre] = useState('웹소설')
  const [newLength, setNewLength] = useState('144')

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => {})
  }, [setProjects])

  const handleCreateProject = async () => {
    if (!newTitle.trim()) return
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, genre: newGenre, targetLength: parseInt(newLength) || 144 }),
      })
      const project = await res.json()
      if (res.ok) {
        toast.success('프로젝트가 생성되었습니다!')
        setShowNewDialog(false)
        setNewTitle('')
        // Refresh and select
        const projects = await fetch('/api/projects').then((r) => r.json())
        setProjects(projects)
        selectProject(project)
      } else {
        toast.error(project.error || '생성 실패')
      }
    } catch {
      toast.error('프로젝트 생성에 실패했습니다.')
    }
  }

  const totalCost = metricSummary?._sum?.costKrw || 0
  const totalTokens = (metricSummary?._sum?.inputTokens || 0) + (metricSummary?._sum?.outputTokens || 0)

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-3 px-4 md:px-6">
        {/* Left: Logo & Back */}
        <div className="flex items-center gap-3">
          {currentProject && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearProject}
              className="shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="font-bold text-sm hidden sm:inline">
              IP Creator Studio
            </span>
          </div>
        </div>

        {/* Center: Project Info */}
        <AnimatePresence mode="wait">
          {currentProject && (
            <motion.div
              key={currentProject.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-2 flex-1 min-w-0"
            >
              <span className="font-semibold text-sm truncate">
                {currentProject.title}
              </span>
              <Badge variant="secondary" className="text-xs shrink-0">
                {currentProject.genre}
              </Badge>
              <Badge
                variant="outline"
                className={`text-xs shrink-0 ${
                  currentProject.phase === 1
                    ? 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                    : 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {currentProject.phase === 1 ? 'Phase 1' : 'Phase 2'}
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 ml-auto">
          {currentProject && totalTokens > 0 && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
              <Coins className="h-3.5 w-3.5" />
              <span>{totalCost.toFixed(0)}원</span>
            </div>
          )}

          {currentProject && currentProject.phase === 2 && (
            <>
              <Button
                variant={currentView === 'genesis' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView('genesis')}
                className="gap-1.5"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Genesis</span>
              </Button>
              <Button
                variant={currentView === 'production' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setCurrentView('production')}
                className="gap-1.5"
              >
                <Layers className="h-4 w-4" />
                <span className="hidden sm:inline">Production</span>
              </Button>
            </>
          )}

          {currentProject && (
            <Button
              variant={currentView === 'dashboard' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setCurrentView('dashboard')}
              className="gap-1.5"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">대시보드</span>
            </Button>
          )}

          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">새 프로젝트</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 프로젝트 생성</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>프로젝트 제목</Label>
                  <Input
                    placeholder="예: 별빛 아래서"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                  />
                </div>
                <div className="space-y-2">
                  <Label>장르</Label>
                  <Select value={newGenre} onValueChange={setNewGenre}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>목표 화수</Label>
                  <Input
                    type="number"
                    value={newLength}
                    onChange={(e) => setNewLength(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">취소</Button>
                </DialogClose>
                <Button
                  onClick={handleCreateProject}
                  disabled={!newTitle.trim()}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  생성
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  )
}
