'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { Input } from '@/components/ui/input'
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
import { Search, GitBranch, FileText, Loader2 } from 'lucide-react'

type SearchResult = {
  id: string
  _score: number
  _type: 'node' | 'episode'
  title?: string
  content?: string
  status?: string
  bu?: number
  hwa?: number
  snippet?: string
}

export default function SearchPanel() {
  const { currentProject, setSelectedNodeId, setSelectedEpisodeId } = useAppStore()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const handleSearch = async () => {
    if (!currentProject || !query.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, type }),
      })
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="노드·원고 검색..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="h-8 text-xs"
          />
          <Button size="sm" onClick={handleSearch} disabled={searching} className="h-8 px-2.5">
            {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="nodes">노드만</SelectItem>
            <SelectItem value="episodes">에피소드만</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {results.map((r) => (
            <div
              key={r.id}
              className="p-2.5 rounded-md cursor-pointer hover:bg-muted border border-transparent transition-colors"
              onClick={() => {
                if (r._type === 'node') setSelectedNodeId(r.id)
                else setSelectedEpisodeId(r.id)
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                {r._type === 'node' ? (
                  <GitBranch className="h-3 w-3 text-amber-500" />
                ) : (
                  <FileText className="h-3 w-3 text-emerald-500" />
                )}
                <span className="text-sm font-medium truncate">
                  {r._type === 'node' ? r.title : `${r.bu}부 ${r.hwa}화`}
                </span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto">
                  {Math.round(r._score * 100)}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {r._type === 'node' ? r.content?.slice(0, 100) : r.snippet}
              </p>
            </div>
          ))}

          {results.length === 0 && query && !searching && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              검색 결과가 없습니다
            </div>
          )}
          {!query && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              키워드를 입력하고 Enter
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
