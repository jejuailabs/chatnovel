'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Coins,
  FileText,
  GitBranch,
  BookOpen,
  TrendingUp,
  ArrowLeft,
  Layers,
  Sparkles,
  Zap,
  MessageSquare,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { motion } from 'framer-motion'

type MetricData = {
  id: string
  eventType: string
  entityId: string
  inputTokens: number
  outputTokens: number
  costKrw: number
  createdAt: string
}

type SummaryData = {
  _sum: { inputTokens: number | null; outputTokens: number | null; costKrw: number | null }
  _count: number
}

export default function Dashboard() {
  const {
    currentProject,
    nodes,
    episodes,
    bibles,
    setCurrentView,
    setMetrics,
  } = useAppStore()

  const [metrics, setLocalMetrics] = useState<MetricData[]>([])
  const [summary, setSummary] = useState<SummaryData | null>(null)

  useEffect(() => {
    if (!currentProject) return
    fetch(`/api/projects/${currentProject.id}/metrics`)
      .then((r) => r.json())
      .then((data) => {
        setLocalMetrics(data.metrics || [])
        setSummary(data.summary || null)
        setMetrics(data.metrics || [], data.summary || null)
      })
      .catch(() => {})
  }, [currentProject, setMetrics])

  if (!currentProject) return null

  const totalCost = summary?._sum?.costKrw || 0
  const totalInput = summary?._sum?.inputTokens || 0
  const totalOutput = summary?._sum?.outputTokens || 0
  const totalTokens = totalInput + totalOutput

  const nodeStatusData = [
    { name: '확정', value: nodes.filter((n) => n.status === 'confirmed').length, color: '#10b981' },
    { name: '진화 중', value: nodes.filter((n) => n.status === 'evolving').length, color: '#f59e0b' },
    { name: '대기', value: nodes.filter((n) => n.status === 'pending').length, color: '#9ca3af' },
    { name: '폐기', value: nodes.filter((n) => n.status === 'discarded').length, color: '#ef4444' },
  ].filter((d) => d.value > 0)

  const episodeStatusData = [
    { name: '초안', value: episodes.filter((e) => e.status === 'draft').length, color: '#9ca3af' },
    { name: '검토', value: episodes.filter((e) => e.status === 'reviewed').length, color: '#f59e0b' },
    { name: '승인', value: episodes.filter((e) => e.status === 'approved').length, color: '#10b981' },
  ].filter((d) => d.value > 0)

  const progress = currentProject.targetLength > 0
    ? Math.round((episodes.filter((e) => e.status === 'approved').length / currentProject.targetLength) * 100)
    : 0

  const bibleCompletion = bibles.map((b) => {
    try {
      const parsed = JSON.parse(b.content || '{}')
      const total = Object.keys(parsed).length
      const filled = Object.values(parsed).filter((v) => {
        if (Array.isArray(v)) return v.length > 0
        if (typeof v === 'string') return v.trim().length > 0
        return !!v
      }).length
      return { type: b.type === 'concept' ? '기획서' : b.type === 'production' ? '제작 성경' : '창작 로그', filled, total, percent: total > 0 ? Math.round((filled / total) * 100) : 0 }
    } catch {
      return { type: b.type, filled: 0, total: 0, percent: 0 }
    }
  })

  // Daily cost chart data (last 7 days)
  const dailyCostData = (() => {
    const now = new Date()
    const days: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = `${d.getMonth() + 1}/${d.getDate()}`
      days[key] = 0
    }
    metrics.forEach((m) => {
      const d = new Date(m.createdAt)
      const key = `${d.getMonth() + 1}/${d.getDate()}`
      if (key in days) days[key] += m.costKrw
    })
    return Object.entries(days).map(([date, cost]) => ({ date, cost: Math.round(cost * 100) / 100 }))
  })()

  // Recent activity
  const recentActivity = metrics.slice(0, 10).map((m) => ({
    type: m.eventType === 'chat' ? '채팅' : '에피소드 생성',
    tokens: m.inputTokens + m.outputTokens,
    cost: m.costKrw,
    time: new Date(m.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
  }))

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView(currentProject.phase === 1 ? 'genesis' : 'production')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">대시보드</h1>
          <p className="text-sm text-muted-foreground">{currentProject.title}의 진행 상황</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Coins className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-xs text-muted-foreground">총 비용</span>
              </div>
              <p className="text-2xl font-bold">{totalCost.toFixed(0)}<span className="text-sm font-normal text-muted-foreground ml-1">원</span></p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-xs text-muted-foreground">총 토큰</span>
              </div>
              <p className="text-2xl font-bold">{totalTokens.toLocaleString()}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-xs text-muted-foreground">승인된 에피소드</span>
              </div>
              <p className="text-2xl font-bold">{episodes.filter((e) => e.status === 'approved').length}<span className="text-sm font-normal text-muted-foreground ml-1">/ {currentProject.targetLength}</span></p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <GitBranch className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                </div>
                <span className="text-xs text-muted-foreground">노드 수</span>
              </div>
              <p className="text-2xl font-bold">{nodes.length}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Progress + Bible Completion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">에피소드 진행률</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>전체 진행률</span>
                <span className="font-semibold">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-lg font-bold text-gray-500">{episodes.filter((e) => e.status === 'draft').length}</p><p className="text-[10px] text-muted-foreground">초안</p></div>
                <div><p className="text-lg font-bold text-amber-500">{episodes.filter((e) => e.status === 'reviewed').length}</p><p className="text-[10px] text-muted-foreground">검토</p></div>
                <div><p className="text-lg font-bold text-emerald-500">{episodes.filter((e) => e.status === 'approved').length}</p><p className="text-[10px] text-muted-foreground">승인</p></div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">바이블 완성도</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {bibleCompletion.map((b) => (
                <div key={b.type}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{b.type}</span>
                    <span className="text-xs text-muted-foreground">v{bibles.find((bl) => (bl.type === 'concept' ? '기획서' : bl.type === 'production' ? '제작 성경' : '창작 로그') === b.type)?.version || 0} · {b.percent}%</span>
                  </div>
                  <Progress value={b.percent} className="h-2" />
                </div>
              ))}
              {bibleCompletion.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">바이블이 아직 없습니다</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Node Distribution */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">노드 상태 분포</CardTitle>
            </CardHeader>
            <CardContent>
              {nodeStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={nodeStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name} ${value}`}>
                      {nodeStatusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">노드 데이터가 없습니다</div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Daily Cost */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">일별 비용 추이</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyCostData.some((d) => d.cost > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyCostData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value: number) => [`${value}원`, '비용']} />
                    <Bar dataKey="cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">비용 데이터가 없습니다</div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">최근 활동</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <ScrollArea className="max-h-60">
                <div className="space-y-2">
                  {recentActivity.map((activity, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${activity.type === '채팅' ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                        {activity.type === '채팅' ? (
                          <MessageSquare className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{activity.type}</p>
                        <p className="text-xs text-muted-foreground">{activity.tokens.toLocaleString()} 토큰</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{activity.cost.toFixed(1)}원</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">활동 내역이 없습니다</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}