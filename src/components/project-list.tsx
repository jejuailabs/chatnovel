'use client'

import { useEffect, useState } from 'react'
import { useAppStore, type Project } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  BookOpen,
  Trash2,
  Sparkles,
  FileEdit,
  Layers,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import type { MetricSummary } from '@/lib/store'

const GENRES = ['웹소설', '웹툰', '드라마', '영화', '게임 시나리오']

const genreIcons: Record<string, string> = {
  '웹소설': '📖',
  '웹툰': '🎨',
  '드라마': '🎬',
  '영화': '🎥',
  '게임 시나리오': '🎮',
}

export default function ProjectList() {
  const { projects, setProjects, selectProject } = useAppStore()
  const [loading, setLoading] = useState(true)

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      setProjects(data)
    } catch {
      toast.error('프로젝트를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [setProjects])

  const handleSelectProject = async (project: Project) => {
    try {
      const res = await fetch(`/api/projects/${project.id}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      selectProject(data)
      // Load all related data
      setRelatedData(data)
    } catch {
      toast.error('프로젝트를 불러오지 못했습니다.')
    }
  }

  const setRelatedData = (data: Record<string, unknown>) => {
    const store = useAppStore.getState()
    if (data.sessions) store.setNodes(data.nodes || [])
    if (data.bibles) store.setBibles(data.bibles || [])
    if (data.episodes) store.setEpisodes(data.episodes || [])
    if (data.canonTracker) store.setCanonTracker(data.canonTracker || null)
    if (data.metrics) {
      store.setMetrics(data.metrics || [], (data.metricSummary || null) as MetricSummary | null)
    }
  }

  const handleDeleteProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('프로젝트가 삭제되었습니다.')
        loadProjects()
      } else {
        toast.error('삭제에 실패했습니다.')
      }
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <Sparkles className="h-8 w-8 text-amber-500" />
          <span className="text-sm text-muted-foreground">불러오는 중...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-amber-500/10 mb-4">
          <Sparkles className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-3">
          IP Creator Studio
        </h1>
        <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto">
          AI와 함께 웹소설·웹툰·드라마의 IP를 기획하고 제작하세요.
          아이디어 브레인스토밍부터 에피소드 원고 생성까지.
        </p>
      </motion.div>

      {/* Project Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((project, i) => (
          <motion.div
            key={project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card
              className="cursor-pointer hover:border-amber-500/50 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleSelectProject(project)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      {genreIcons[project.genre] || '📖'}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {project.genre}
                    </Badge>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>프로젝트 삭제</AlertDialogTitle>
                        <AlertDialogDescription>
                          &quot;{project.title}&quot; 프로젝트와 모든 데이터가 삭제됩니다.
                          이 작업은 되돌릴 수 없습니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteProject(project.id)}
                          className="bg-destructive text-white"
                        >
                          삭제
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <CardTitle className="text-base mt-2 flex items-center gap-2">
                  {project.title}
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" />
                    <span>Phase {project.phase}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>{project._count?.episodes || 0}화</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileEdit className="h-3.5 w-3.5" />
                    <span>{project._count?.nodes || 0}노드</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  목표 {project.targetLength}화
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* New Project Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: projects.length * 0.05 }}
        >
          <NewProjectCard />
        </motion.div>
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            아직 프로젝트가 없습니다.
          </p>
          <NewProjectCard inline />
        </div>
      )}
    </div>
  )
}

function NewProjectCard({ inline = false }: { inline?: boolean }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [genre, setGenre] = useState('웹소설')
  const [length, setLength] = useState('144')
  const { setProjects, selectProject } = useAppStore()

  const handleCreate = async () => {
    if (!title.trim()) return
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, genre, targetLength: parseInt(length) || 144 }),
      })
      const project = await res.json()
      if (res.ok) {
        toast.success('프로젝트가 생성되었습니다!')
        setOpen(false)
        setTitle('')
        const projects = await fetch('/api/projects').then((r) => r.json())
        setProjects(projects)
        const full = await fetch(`/api/projects/${project.id}`).then((r) => r.json())
        selectProject(full)
      } else {
        toast.error(project.error || '생성 실패')
      }
    } catch {
      toast.error('프로젝트 생성에 실패했습니다.')
    }
  }

  if (inline) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
      >
        <Plus className="h-4 w-4" />
        첫 프로젝트 만들기
      </Button>
    )
  }

  return (
    <>
      <Card
        className="cursor-pointer border-dashed hover:border-amber-500/50 hover:bg-amber-500/5 transition-all min-h-[160px] flex items-center justify-center"
        onClick={() => setOpen(true)}
      >
        <CardContent className="flex flex-col items-center gap-2 py-6">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <span className="text-sm text-muted-foreground">새 프로젝트</span>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 프로젝트 생성</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>프로젝트 제목</Label>
              <Input
                placeholder="예: 별빛 아래서"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>장르</Label>
              <Select value={genre} onValueChange={setGenre}>
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
                value={length}
                onChange={(e) => setLength(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">취소</Button>
            </DialogClose>
            <Button
              onClick={handleCreate}
              disabled={!title.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}