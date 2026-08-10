'use client'

import { create } from 'zustand'

export type ViewType = 'welcome' | 'genesis' | 'production' | 'dashboard'
export type RightPanelView = 'none' | 'nodes' | 'bible' | 'canon'
export type NodeStatus = 'confirmed' | 'evolving' | 'pending' | 'discarded'
export type EpisodeStatus = 'draft' | 'reviewed' | 'approved'

export interface Project {
  id: string
  title: string
  genre: string
  targetLength: number
  phase: number
  createdAt: string
  updatedAt: string
  _count?: { nodes: number; episodes: number; sessions: number }
}

export interface Session {
  id: string
  projectId: string
  type: string
  title: string
  createdAt: string
  updatedAt: string
  _count?: { messages: number; nodes: number }
}

export interface Message {
  id: string
  sessionId: string
  role: string
  content: string
  createdAt: string
}

export interface Node {
  id: string
  projectId: string
  title: string
  content: string
  tags: string
  status: string
  sessionId: string | null
  originMessageId: string | null
  createdAt: string
  updatedAt: string
}

export interface Bible {
  id: string
  projectId: string
  type: string
  version: number
  content: string
  createdAt: string
  updatedAt: string
}

export interface CanonTracker {
  id: string
  projectId: string
  version: number
  state: string
  lastUpdated: string
}

export interface Episode {
  id: string
  projectId: string
  bu: number
  hwa: number
  content: string
  wordCount: number
  tokenUsed: number
  costKrw: number
  status: string
  createdAt: string
  approvedAt: string | null
  revisions?: Revision[]
}

export interface Revision {
  id: string
  episodeId: string
  version: number
  content: string
  createdAt: string
}

export interface Metric {
  id: string
  projectId: string
  eventType: string
  entityId: string
  inputTokens: number
  outputTokens: number
  costKrw: number
  createdAt: string
}

export interface MetricSummary {
  _sum: { inputTokens: number | null; outputTokens: number | null; costKrw: number | null }
  _count: number
}

interface AppState {
  // Navigation
  currentView: ViewType
  currentProject: Project | null
  projects: Project[]

  // Genesis
  currentSession: Session | null
  nodes: Node[]
  messages: Message[]
  bibles: Bible[]

  // Production
  episodes: Episode[]
  canonTracker: CanonTracker | null

  // Metrics
  metrics: Metric[]
  metricSummary: MetricSummary | null

  // UI State
  isChatLoading: boolean
  selectedNodeId: string | null
  selectedEpisodeId: string | null
  sidebarOpen: boolean
  rightPanelView: RightPanelView
  sessionTypeFilter: string

  // Actions
  setCurrentView: (view: ViewType) => void
  setProjects: (projects: Project[]) => void
  selectProject: (project: Project) => void
  clearProject: () => void
  setCurrentSession: (session: Session | null) => void
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  updateLastMessage: (content: string) => void
  setNodes: (nodes: Node[]) => void
  addNode: (node: Node) => void
  updateNode: (id: string, data: Partial<Node>) => void
  removeNode: (id: string) => void
  setEpisodes: (episodes: Episode[]) => void
  addEpisode: (episode: Episode) => void
  updateEpisode: (id: string, data: Partial<Episode>) => void
  setBibles: (bibles: Bible[]) => void
  updateBible: (type: string, bible: Partial<Bible>) => void
  setCanonTracker: (tracker: CanonTracker | null) => void
  setMetrics: (metrics: Metric[], summary: MetricSummary | null) => void
  setIsChatLoading: (loading: boolean) => void
  setSelectedNodeId: (id: string | null) => void
  setSelectedEpisodeId: (id: string | null) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setRightPanel: (view: RightPanelView) => void
  setSessionTypeFilter: (type: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  currentView: 'welcome',
  currentProject: null,
  projects: [],
  currentSession: null,
  nodes: [],
  messages: [],
  bibles: [],
  episodes: [],
  canonTracker: null,
  metrics: [],
  metricSummary: null,
  isChatLoading: false,
  selectedNodeId: null,
  selectedEpisodeId: null,
  sidebarOpen: true,
  rightPanelView: 'none',
  sessionTypeFilter: 'brainstorm',

  // Actions
  setCurrentView: (view) => set({ currentView: view }),

  setProjects: (projects) => set({ projects }),

  selectProject: (project) => set({
    currentProject: project,
    // phase 가 명시적으로 2일 때만 Production, 그 외(1·미설정)는 Genesis
    currentView: project.phase === 2 ? 'production' : 'genesis',
    currentSession: null,
    nodes: [],
    messages: [],
    bibles: [],
    episodes: [],
    canonTracker: null,
    metrics: [],
    metricSummary: null,
    selectedNodeId: null,
    selectedEpisodeId: null,
  }),

  clearProject: () => set({
    currentProject: null,
    currentView: 'welcome',
    currentSession: null,
    nodes: [],
    messages: [],
    bibles: [],
    episodes: [],
    canonTracker: null,
    metrics: [],
    metricSummary: null,
    selectedNodeId: null,
    selectedEpisodeId: null,
  }),

  setCurrentSession: (session) => set({ currentSession: session, messages: [] }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),

  updateLastMessage: (content) => set((state) => {
    const msgs = [...state.messages]
    if (msgs.length > 0) {
      msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content }
    }
    return { messages: msgs }
  }),

  setNodes: (nodes) => set({ nodes }),

  addNode: (node) => set((state) => ({ nodes: [node, ...state.nodes] })),

  updateNode: (id, data) => set((state) => ({
    nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...data } : n)),
  })),

  removeNode: (id) => set((state) => ({
    nodes: state.nodes.filter((n) => n.id !== id),
  })),

  setEpisodes: (episodes) => set({ episodes }),

  addEpisode: (episode) => set((state) => ({
    episodes: [...state.episodes, episode].sort((a, b) => a.bu === b.bu ? a.hwa - b.hwa : a.bu - b.bu),
  })),

  updateEpisode: (id, data) => set((state) => ({
    episodes: state.episodes.map((e) => (e.id === id ? { ...e, ...data } : e)),
  })),

  setBibles: (bibles) => set({ bibles }),

  updateBible: (type, bible) => set((state) => ({
    bibles: state.bibles.map((b) => (b.type === type ? { ...b, ...bible } : b)),
  })),

  setCanonTracker: (tracker) => set({ canonTracker: tracker }),

  setMetrics: (metrics, summary) => set({ metrics, metricSummary: summary }),

  setIsChatLoading: (loading) => set({ isChatLoading: loading }),

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  setSelectedEpisodeId: (id) => set({ selectedEpisodeId: id }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setRightPanel: (view) => set({ rightPanelView: view }),

  setSessionTypeFilter: (type) => set({ sessionTypeFilter: type }),
}))
