'use client'

import { useAppStore } from '@/lib/store'
import ChatInterface from '@/components/chat-interface'
import NodePanel from '@/components/node-panel'
import BiblePanel from '@/components/bible-panel'
import PhaseTransition from '@/components/phase-transition'
import { Button } from '@/components/ui/button'
import { PanelRightOpen, GitBranch, BookOpen } from 'lucide-react'

export default function GenesisEngine() {
  const {
    currentProject,
    rightPanelView,
    setRightPanel,
  } = useAppStore()

  if (!currentProject) return null

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-2.5rem)] overflow-hidden">
      {/* Phase 전환 바 (성경 생성 · 완결 판정 · Phase 2 진입) */}
      <PhaseTransition />

      <div className="flex flex-1 overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatInterface />
      </div>

      {/* Right Panel Toggle */}
      <div className="border-l border-border flex flex-col">
        <div className="flex items-center gap-1 p-1 border-b border-border">
          <Button
            variant={rightPanelView === 'nodes' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setRightPanel(rightPanelView === 'nodes' ? 'none' : 'nodes')}
            className="gap-1.5 text-xs"
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">노드</span>
          </Button>
          <Button
            variant={rightPanelView === 'bible' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setRightPanel(rightPanelView === 'bible' ? 'none' : 'bible')}
            className="gap-1.5 text-xs"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">바이블</span>
          </Button>
        </div>

        {/* Right Panel Content */}
        {rightPanelView === 'nodes' && <NodePanel />}
        {rightPanelView === 'bible' && <BiblePanel />}
        {rightPanelView === 'none' && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center text-xs text-muted-foreground">
              <PanelRightOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>노드 또는 바이블을</p>
              <p>선택해주세요</p>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}