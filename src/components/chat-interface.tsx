'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useAppStore, type Session, type Message } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Send,
  Plus,
  MessageSquare,
  Sparkles,
  Search,
  ArrowRightLeft,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Lightbulb,
} from 'lucide-react'
import { toast } from 'sonner'
import ReactMarkdown from 'react-markdown'
import { motion, AnimatePresence } from 'framer-motion'

const SESSION_TYPES = [
  { value: 'brainstorm', label: '브레인스토밍' },
  { value: 'direction', label: '방향 잡기' },
  { value: 'review', label: '검토' },
  { value: 'decision', label: '결정' },
]

export default function ChatInterface() {
  const {
    currentProject,
    currentSession,
    messages,
    nodes,
    bibles,
    isChatLoading,
    setMessages,
    addMessage,
    updateLastMessage,
    setIsChatLoading,
    setNodes,
    addNode,
    setCurrentSession,
    setBibles,
  } = useAppStore()

  const [input, setInput] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionType, setSessionType] = useState('brainstorm')
  const [showNewSession, setShowNewSession] = useState(false)
  const [newSessionTitle, setNewSessionTitle] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const projectId = currentProject?.id

  // Load sessions
  useEffect(() => {
    if (!projectId) return
    fetch(`/api/projects/${projectId}/sessions`)
      .then((r) => r.json())
      .then(setSessions)
      .catch(() => {})
  }, [projectId])

  // Load messages when session changes
  useEffect(() => {
    if (!currentSession) return
    fetch(`/api/projects/${projectId}/sessions/${currentSession.id}/messages`)
      .then((r) => r.json())
      .then(setMessages)
      .catch(() => {})
  }, [currentSession, projectId, setMessages])

  // Load nodes
  useEffect(() => {
    if (!projectId) return
    fetch(`/api/projects/${projectId}/nodes`)
      .then((r) => r.json())
      .then(setNodes)
      .catch(() => {})
  }, [projectId, setNodes])

  // Load bibles
  useEffect(() => {
    if (!projectId) return
    fetch(`/api/projects/${projectId}/bibles`)
      .then((r) => r.json())
      .then(setBibles)
      .catch(() => {})
  }, [projectId, setBibles])

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const createSession = async () => {
    if (!projectId) return
    try {
      const res = await fetch(`/api/projects/${projectId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: sessionType, title: newSessionTitle || SESSION_TYPES.find(s => s.value === sessionType)?.label || '새 세션' }),
      })
      const session = await res.json()
      if (res.ok) {
        setSessions((prev) => [session, ...prev])
        setCurrentSession(session)
        setShowNewSession(false)
        setNewSessionTitle('')
      }
    } catch {
      toast.error('세션 생성 실패')
    }
  }

  const sendMessage = useCallback(async (messageText: string) => {
    if (!projectId || !currentSession || isChatLoading) return
    const msg = messageText.trim()
    if (!msg) return

    setInput('')
    setIsChatLoading(true)

    // Add user message to UI immediately
    addMessage({ id: 'temp-user', sessionId: currentSession.id, role: 'user', content: msg, createdAt: new Date().toISOString() })

    // Add empty assistant message
    addMessage({ id: 'temp-assistant', sessionId: currentSession.id, role: 'assistant', content: '', createdAt: new Date().toISOString() })

    try {
      // Build context
      const confirmedNodes = nodes
        .filter((n) => n.status === 'confirmed')
        .map((n) => `- ${n.title}: ${n.content}`)
        .join('\n')

      const bibleContent = bibles
        .map((b) => `[${b.type}] ${b.content}`)
        .join('\n\n')

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sessionId: currentSession.id,
          message: msg,
          bibleContent: bibleContent || undefined,
          nodesContent: confirmedNodes || undefined,
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error('Stream error')
      }

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
                updateLastMessage(fullContent)
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
      }

      // Refresh nodes (AI may have auto-extracted new nodes)
      const nodesRes = await fetch(`/api/projects/${projectId}/nodes`)
      const freshNodes = await nodesRes.json()
      setNodes(freshNodes)

    } catch {
      toast.error('AI 응답을 받지 못했습니다.')
      updateLastMessage('응답을 생성하지 못했습니다. 다시 시도해주세요.')
    } finally {
      setIsChatLoading(false)
    }
  }, [projectId, currentSession, isChatLoading, nodes, bibles, addMessage, updateLastMessage, setIsChatLoading, setNodes])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const quickPrompts = [
    { label: '이 노드 확장해봐', icon: Sparkles, prefix: '앞서 언급된 노드를 더 깊이 확장해줘. ' },
    { label: '구멍 찾아줘', icon: Search, prefix: '현재까지의 설정과 플롯에서 논리적 구멍이나 모순을 찾아줘. ' },
    { label: '반대 방향', icon: ArrowRightLeft, prefix: '현재 방향과 반대되는 전개나 설정을 제안해줘. ' },
  ]

  return (
    <div className="flex h-full">
      {/* Session Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r border-border flex flex-col shrink-0 overflow-hidden"
          >
            <div className="flex items-center justify-between p-3 border-b border-border">
              <span className="text-xs font-semibold">세션</span>
              <div className="flex items-center gap-1">
                <Select value={sessionType} onValueChange={setSessionType}>
                  <SelectTrigger className="h-7 text-xs w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_TYPES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setCurrentSession(session)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    currentSession?.id === session.id
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate flex-1">{session.title}</span>
                    {session._count && (
                      <span className="text-xs text-muted-foreground">
                        {session._count.messages}
                      </span>
                    )}
                  </div>
                </button>
              ))}

              {sessions.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  세션이 없습니다
                </div>
              )}
            </div>

            <div className="p-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => setShowNewSession(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                새 세션
              </Button>
            </div>

            <Dialog open={showNewSession} onOpenChange={setShowNewSession}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>새 세션 생성</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>세션 제목</Label>
                    <Input
                      placeholder={SESSION_TYPES.find(s => s.value === sessionType)?.label || '새 세션'}
                      value={newSessionTitle}
                      onChange={(e) => setNewSessionTitle(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">취소</Button>
                  </DialogClose>
                  <Button
                    onClick={createSession}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    생성
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
          <div className="flex-1 min-w-0">
            {currentSession ? (
              <span className="text-sm font-medium truncate block">
                {currentSession.title}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">
                세션을 선택하거나 새 세션을 만드세요
              </span>
            )}
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            Phase 1 · Genesis
          </Badge>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {!currentSession && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">Genesis Engine</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  AI와 함께 아이디어를 브레인스토밍하고, 캐릭터·플롯·세계관을 구체화하세요.
                </p>
              </div>
              <Button
                onClick={() => setShowNewSession(true)}
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Plus className="h-4 w-4" />
                첫 세션 시작하기
              </Button>
            </div>
          )}

          {currentSession && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Lightbulb className="h-10 w-10 text-amber-500/30" />
              <p className="text-sm text-muted-foreground">
                아래에 메시지를 입력하여 브레인스토밍을 시작하세요
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <motion.div
              key={msg.id || idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-amber-600 text-white'
                    : 'bg-muted'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2">
                    <ReactMarkdown>{msg.content || (isChatLoading ? '▊' : '')}</ReactMarkdown>
                    {isChatLoading && idx === messages.length - 1 && (
                      <span className="inline-block animate-pulse ml-0.5">▊</span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Quick Prompts + Input */}
        {currentSession && (
          <div className="border-t border-border p-4 space-y-3">
            <div className="flex gap-2 flex-wrap">
              {quickPrompts.map((qp) => (
                <Button
                  key={qp.label}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  disabled={isChatLoading}
                  onClick={() => sendMessage(qp.prefix + input)}
                >
                  <qp.icon className="h-3.5 w-3.5" />
                  {qp.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="아이디어를 입력하세요..."
                className="min-h-[44px] max-h-32 resize-none"
                disabled={isChatLoading}
              />
              <Button
                size="icon"
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isChatLoading}
                className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 h-[44px] w-[44px]"
              >
                {isChatLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
