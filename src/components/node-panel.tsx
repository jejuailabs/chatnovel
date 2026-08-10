'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  GitBranch,
  Plus,
  Trash2,
  Edit2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type NodeStatus = 'confirmed' | 'evolving' | 'pending' | 'discarded'

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  confirmed: { color: 'bg-emerald-500', label: '확정' },
  evolving: { color: 'bg-amber-500', label: '진화 중' },
  pending: { color: 'bg-gray-400', label: '대기' },
  discarded: { color: 'bg-red-500', label: '폐기' },
}

export default function NodePanel() {
  const {
    currentProject,
    nodes,
    selectedNodeId,
    setSelectedNodeId,
    updateNode,
    removeNode,
    setNodes,
  } = useAppStore()

  const [filter, setFilter] = useState<string>('all')
  const [editNode, setEditNode] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')

  const filteredNodes = filter === 'all'
    ? nodes
    : nodes.filter((n) => n.status === filter)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  const handleStatusChange = async (nodeId: string, status: NodeStatus) => {
    if (!currentProject) return
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        const updated = await res.json()
        updateNode(nodeId, updated)
      }
    } catch {
      toast.error('상태 변경 실패')
    }
  }

  const handleEdit = (node: typeof nodes[0]) => {
    setEditNode(node.id)
    setEditTitle(node.title)
    setEditContent(node.content)
  }

  const handleSaveEdit = async () => {
    if (!currentProject || !editNode) return
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/nodes/${editNode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      })
      if (res.ok) {
        const updated = await res.json()
        updateNode(editNode, updated)
        setEditNode(null)
      }
    } catch {
      toast.error('수정 실패')
    }
  }

  const handleDelete = async (nodeId: string) => {
    if (!currentProject) return
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/nodes/${nodeId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        removeNode(nodeId)
        if (selectedNodeId === nodeId) setSelectedNodeId(null)
        toast.success('노드가 삭제되었습니다.')
      }
    } catch {
      toast.error('삭제 실패')
    }
  }

  const handleCreate = async () => {
    if (!currentProject || !newTitle.trim()) return
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, content: newContent, status: 'pending' }),
      })
      if (res.ok) {
        const node = await res.json()
        const store = useAppStore.getState()
        store.addNode(node)
        setShowCreate(false)
        setNewTitle('')
        setNewContent('')
        toast.success('노드가 생성되었습니다.')
      }
    } catch {
      toast.error('생성 실패')
    }
  }

  return (
    <div className="flex flex-col h-full w-[300px]">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            노드 ({nodes.length})
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Node List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          <AnimatePresence>
            {filteredNodes.map((node) => (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <div
                  className={`p-2.5 rounded-md cursor-pointer transition-colors group ${
                    selectedNodeId === node.id
                      ? 'bg-amber-500/10 border border-amber-500/30'
                      : 'hover:bg-muted border border-transparent'
                  }`}
                  onClick={() => setSelectedNodeId(node.id === selectedNodeId ? null : node.id)}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${STATUS_CONFIG[node.status]?.color || 'bg-gray-400'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{node.title}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {STATUS_CONFIG[node.status]?.label || node.status}
                        </Badge>
                        {node.tags && (() => {
                          try {
                            const tags = JSON.parse(node.tags)
                            if (Array.isArray(tags) && tags.length > 0) {
                              return <span className="text-[10px] text-muted-foreground">{tags[0]}</span>
                            }
                          } catch {}
                          return null
                        })()}
                      </div>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); handleEdit(node) }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); handleDelete(node.id) }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredNodes.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              노드가 없습니다
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Selected Node Detail */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-border overflow-hidden"
          >
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{selectedNode.title}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedNodeId(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Select
                value={selectedNode.status}
                onValueChange={(v) => handleStatusChange(selectedNode.id, v as NodeStatus)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedNode.content && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {selectedNode.content}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Dialog */}
      <Dialog open={!!editNode} onOpenChange={() => setEditNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>노드 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>제목</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>내용</Label>
              <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="min-h-[120px]" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
            <Button onClick={handleSaveEdit} className="bg-amber-600 hover:bg-amber-700 text-white">저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 노드 생성</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>제목</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="예: 주인공의 비밀" />
            </div>
            <div className="space-y-2">
              <Label>내용</Label>
              <Textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} className="min-h-[120px]" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
            <Button onClick={handleCreate} disabled={!newTitle.trim()} className="bg-amber-600 hover:bg-amber-700 text-white">생성</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
