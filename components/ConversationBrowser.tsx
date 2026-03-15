'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Terminal,
  FolderOpen,
  Search,
  FileText,
  ChevronRight,
  ChevronDown,
  Wrench,
  Play,
  Pencil,
  FileOutput,
  Eye,
  Filter,
  X,
  Loader2,
  ArrowLeft,
  Copy,
  ExternalLink,
  BarChart3,
  Clock,
  HardDrive,
  Menu,
  Hash,
  Globe,
  Code,
  MessageSquare,
} from 'lucide-react'
import {
  cn,
  formatFileSize,
  formatFileDate,
  formatToolInput,
} from '@/lib/utils'
import type {
  Project,
  DashboardStats,
  ParsedConversation,
  ParsedMessage,
  ExtractedToolUse,
  ExtractedToolResult,
  ToolSearchResult,
  ScanResponse,
  ConversationResponse,
  SearchResponse,
} from '@/lib/types'

// ============================================================
// Constants
// ============================================================

type ViewMode = 'dashboard' | 'conversation' | 'search'

const TOOL_COLORS: Record<string, string> = {
  Write: '#A7C080',
  Edit: '#DBBC7F',
  MultiEdit: '#DBBC7F',
  Read: '#7FBBB3',
  Bash: '#E69875',
  Grep: '#83C092',
  Glob: '#D699B6',
  Agent: '#D699B6',
  Task: '#D699B6',
  WebSearch: '#7FBBB3',
  WebFetch: '#7FBBB3',
  NotebookEdit: '#DBBC7F',
  TodoRead: '#7FBBB3',
  TodoWrite: '#A7C080',
}

const DEFAULT_TOOL_COLOR = '#9DA9A0'

const TOOL_ICONS: Record<string, React.ReactNode> = {
  Write: <FileOutput className="w-3 h-3" />,
  Edit: <Pencil className="w-3 h-3" />,
  MultiEdit: <Pencil className="w-3 h-3" />,
  Read: <Eye className="w-3 h-3" />,
  Bash: <Play className="w-3 h-3" />,
  Grep: <Search className="w-3 h-3" />,
  Glob: <FolderOpen className="w-3 h-3" />,
  Agent: <Code className="w-3 h-3" />,
  Task: <Code className="w-3 h-3" />,
  WebSearch: <Globe className="w-3 h-3" />,
  WebFetch: <Globe className="w-3 h-3" />,
}

const FILTER_TOOL_TYPES = [
  'Edit',
  'Write',
  'Bash',
  'Read',
  'Grep',
  'Glob',
  'Agent',
  'WebSearch',
  'WebFetch',
  'Other',
]

function getToolColor(toolName: string): string {
  return TOOL_COLORS[toolName] || DEFAULT_TOOL_COLOR
}

function getToolIcon(toolName: string): React.ReactNode {
  return TOOL_ICONS[toolName] || <Wrench className="w-3 h-3" />
}

function getToolSummary(tool: ExtractedToolUse): string {
  if (tool.filePath) return tool.filePath
  if (tool.command) {
    const cmd = tool.command
    return cmd.length > 80 ? cmd.substring(0, 80) + '...' : cmd
  }
  if (tool.searchPattern) return `pattern: ${tool.searchPattern}`
  if (tool.url) return tool.url
  if (tool.description) return tool.description
  return ''
}

// ============================================================
// Sub-components
// ============================================================

/** Colored badge for tool type */
function ToolBadge({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) {
  const color = getToolColor(name)
  const icon = getToolIcon(name)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded font-mono font-semibold',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[10px]'
      )}
      style={{
        backgroundColor: color + '22',
        color: color,
        border: `1px solid ${color}44`,
      }}
    >
      {icon}
      {name}
    </span>
  )
}

/** Stat card for the dashboard */
function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-everforest-bg1 border border-everforest-bg3 rounded-lg p-4 flex items-center gap-4">
      <div className="p-3 rounded-lg bg-everforest-bg2 text-everforest-green">
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-everforest-fg">{value}</div>
        <div className="text-sm text-everforest-grey1">{label}</div>
      </div>
    </div>
  )
}

/** Horizontal bar for tool type distribution */
function ToolBar({
  name,
  count,
  maxCount,
}: {
  name: string
  count: number
  maxCount: number
}) {
  const color = getToolColor(name)
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
  return (
    <div className="flex items-center gap-3 group">
      <div className="w-24 text-right text-sm font-mono text-everforest-grey1 shrink-0">
        {name}
      </div>
      <div className="flex-1 h-6 bg-everforest-bg-dim rounded overflow-hidden relative">
        <div
          className="h-full rounded transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            minWidth: pct > 0 ? '2px' : '0',
          }}
        />
      </div>
      <div className="w-16 text-sm font-mono text-everforest-grey2 shrink-0">
        {count.toLocaleString()}
      </div>
    </div>
  )
}

/** Inline tool use card inside a conversation message */
function ToolUseCard({
  tool,
  isExpanded,
  onToggle,
  toolResult,
}: {
  tool: ExtractedToolUse
  isExpanded: boolean
  onToggle: () => void
  toolResult?: ExtractedToolResult
}) {
  const summary = getToolSummary(tool)
  const [resultExpanded, setResultExpanded] = useState(false)

  return (
    <div className="my-2 border border-everforest-bg3 rounded-lg overflow-hidden transition-all duration-200">
      {/* Header - always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 bg-everforest-bg1 hover:bg-everforest-bg2 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-everforest-grey1 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-everforest-grey1 shrink-0" />
        )}
        <ToolBadge name={tool.name} />
        {summary && (
          <span className="text-xs text-everforest-grey1 font-mono truncate flex-1">
            {summary}
          </span>
        )}
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-everforest-bg3">
          <div className="whitespace-pre-wrap font-mono text-xs bg-everforest-bg-dim p-3 rounded-b overflow-x-auto text-everforest-fg leading-relaxed max-h-[500px] overflow-y-auto custom-scrollbar">
            {formatToolInput(tool.input, tool.name)}
          </div>
        </div>
      )}

      {/* Tool result */}
      {toolResult && (
        <div className="border-t border-everforest-bg3">
          <button
            onClick={() => setResultExpanded(!resultExpanded)}
            className="w-full flex items-center gap-2 px-3 py-1.5 bg-everforest-bg-dim hover:bg-everforest-bg1 transition-colors text-left"
          >
            {resultExpanded ? (
              <ChevronDown className="w-3 h-3 text-everforest-grey0 shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-everforest-grey0 shrink-0" />
            )}
            <span
              className={cn(
                'text-[10px] font-mono',
                toolResult.isError
                  ? 'text-everforest-red'
                  : 'text-everforest-grey0'
              )}
            >
              {toolResult.isError ? 'Error Result' : 'Result'}
            </span>
          </button>
          {resultExpanded && (
            <div className="whitespace-pre-wrap font-mono text-[11px] bg-everforest-bg-dim p-3 overflow-x-auto text-everforest-grey1 leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar">
              {typeof toolResult.content === 'string'
                ? toolResult.content
                : JSON.stringify(toolResult.content, null, 2)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** A single message in the conversation timeline */
function MessageCard({
  message,
  expandedToolUses,
  onToggleToolUse,
  toolResultMap,
}: {
  message: ParsedMessage
  expandedToolUses: Set<string>
  onToggleToolUse: (id: string) => void
  toolResultMap: Map<string, ExtractedToolResult>
}) {
  const [showFullText, setShowFullText] = useState(false)
  const isUser = message.type === 'user'
  const isSummary = message.type === 'summary'
  const isAssistant = message.type === 'assistant'

  const TEXT_CUTOFF = 300
  const textContent = message.textContent || ''
  const isLong = textContent.length > TEXT_CUTOFF
  const displayText = showFullText
    ? textContent
    : textContent.substring(0, TEXT_CUTOFF)

  const borderColor = isUser
    ? 'border-l-everforest-blue'
    : isSummary
      ? 'border-l-everforest-grey0'
      : 'border-l-everforest-green'

  const roleIcon = isUser ? (
    <span className="text-sm" title="User">👤</span>
  ) : isSummary ? (
    <span className="text-sm" title="Summary">📋</span>
  ) : (
    <span className="text-sm" title="Assistant">🤖</span>
  )

  const roleLabel = isUser ? 'User' : isSummary ? 'Summary' : 'Assistant'
  const roleLabelColor = isUser
    ? 'text-everforest-blue'
    : isSummary
      ? 'text-everforest-grey1'
      : 'text-everforest-green'

  return (
    <div
      className={cn(
        'border-l-4 rounded-r-lg bg-everforest-bg1 transition-all duration-200',
        borderColor,
        isSummary && 'opacity-70'
      )}
    >
      {/* Message header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-everforest-bg2">
        {roleIcon}
        <span className={cn('text-sm font-semibold', roleLabelColor)}>
          {roleLabel}
        </span>
        {message.timestamp && (
          <span className="text-xs text-everforest-grey0 ml-auto font-mono">
            <Clock className="w-3 h-3 inline mr-1 opacity-60" />
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Text content */}
      {textContent && (
        <div className="px-4 py-3">
          <div className="whitespace-pre-wrap font-mono text-sm text-everforest-fg leading-relaxed">
            {displayText}
            {isLong && !showFullText && (
              <span className="text-everforest-grey0">...</span>
            )}
          </div>
          {isLong && (
            <button
              onClick={() => setShowFullText(!showFullText)}
              className="mt-2 text-xs text-everforest-aqua hover:text-everforest-green transition-colors font-medium"
            >
              {showFullText ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {/* Tool uses */}
      {message.toolUses.length > 0 && (
        <div className="px-4 pb-3">
          {message.toolUses.map((tool) => (
            <ToolUseCard
              key={tool.toolUseId}
              tool={tool}
              isExpanded={expandedToolUses.has(tool.toolUseId)}
              onToggle={() => onToggleToolUse(tool.toolUseId)}
              toolResult={toolResultMap.get(tool.toolUseId)}
            />
          ))}
        </div>
      )}

      {/* Standalone tool results (user messages) */}
      {isUser && message.toolResults.length > 0 && message.toolUses.length === 0 && (
        <div className="px-4 pb-3">
          {message.toolResults.map((result) => {
            // Don't show if already displayed under a tool use
            if (toolResultMap.has(result.toolUseId)) return null
            return (
              <div
                key={result.toolUseId}
                className="my-1 text-[11px] font-mono text-everforest-grey0 bg-everforest-bg-dim p-2 rounded border border-everforest-bg3"
              >
                <span className={result.isError ? 'text-everforest-red' : ''}>
                  {typeof result.content === 'string'
                    ? result.content.substring(0, 200)
                    : JSON.stringify(result.content).substring(0, 200)}
                  {(typeof result.content === 'string'
                    ? result.content.length
                    : JSON.stringify(result.content).length) > 200 && '...'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Search result card */
function SearchResultCard({
  result,
  isExpanded,
  onToggle,
  onOpenConversation,
}: {
  result: ToolSearchResult
  isExpanded: boolean
  onToggle: () => void
  onOpenConversation: () => void
}) {
  return (
    <div className="bg-everforest-bg1 border border-everforest-bg3 rounded-lg overflow-hidden transition-all duration-200 hover:border-everforest-bg4">
      {/* Card header */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-everforest-bg2 transition-colors"
      >
        <div className="flex items-center gap-1.5 pt-0.5 shrink-0">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-everforest-grey1" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-everforest-grey1" />
          )}
          <ToolBadge name={result.toolUse.name} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-everforest-grey1 mb-1">
            <span className="text-everforest-aqua font-medium">
              {result.projectName}
            </span>
            <ChevronRight className="w-3 h-3 opacity-40" />
            <span className="font-mono truncate">
              {result.conversationId.substring(0, 12)}...
            </span>
            {result.timestamp && (
              <>
                <span className="opacity-30 mx-1">|</span>
                <Clock className="w-3 h-3 opacity-40" />
                <span>{new Date(result.timestamp).toLocaleDateString()}</span>
              </>
            )}
          </div>
          <div className="text-sm text-everforest-grey2 font-mono truncate">
            {result.matchContext}
          </div>
          {getToolSummary(result.toolUse) && (
            <div className="text-xs text-everforest-grey0 font-mono mt-1 truncate">
              {getToolSummary(result.toolUse)}
            </div>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-everforest-bg3">
          <div className="whitespace-pre-wrap font-mono text-xs bg-everforest-bg-dim p-3 overflow-x-auto text-everforest-fg leading-relaxed max-h-[400px] overflow-y-auto custom-scrollbar">
            {formatToolInput(result.toolUse.input, result.toolUse.name)}
          </div>
          <div className="px-3 py-2 bg-everforest-bg1 border-t border-everforest-bg3">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onOpenConversation()
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-everforest-green bg-everforest-bg-green rounded hover:bg-everforest-bg2 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Open Conversation
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export default function ConversationBrowser() {
  // --- State ---
  const [directoryPath, setDirectoryPath] = useState('~/.claude/projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [conversationData, setConversationData] = useState<ParsedConversation | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ToolSearchResult[]>([])
  const [searchTotalMatches, setSearchTotalMatches] = useState(0)
  const [searchTime, setSearchTime] = useState(0)
  const [toolTypeFilter, setToolTypeFilter] = useState<string[]>([])
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [expandedToolUses, setExpandedToolUses] = useState<Set<string>>(new Set())
  const [expandedSearchResults, setExpandedSearchResults] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // --- API Calls ---

  const scanDirectory = useCallback(async (dir?: string) => {
    const scanDir = dir || directoryPath
    setScanning(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/scan?dir=${encodeURIComponent(scanDir)}`
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Scan failed (${res.status})`)
      }
      const data: ScanResponse = await res.json()
      setProjects(data.projects)
      setStats(data.stats)
      setViewMode('dashboard')
      setSelectedConversation(null)
      setConversationData(null)
    } catch (err: any) {
      setError(err.message || 'Failed to scan directory')
    } finally {
      setScanning(false)
    }
  }, [directoryPath])

  const loadConversation = useCallback(async (filePath: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/conversation?file=${encodeURIComponent(filePath)}`
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to load conversation (${res.status})`)
      }
      const data: ConversationResponse = await res.json()
      setConversationData(data.conversation)
      setSelectedConversation(filePath)
      setViewMode('conversation')
      setExpandedToolUses(new Set())
    } catch (err: any) {
      setError(err.message || 'Failed to load conversation')
    } finally {
      setLoading(false)
    }
  }, [])

  const performSearch = useCallback(
    async (query: string, tools: string[]) => {
      if (!query.trim()) {
        setSearchResults([])
        setSearchTotalMatches(0)
        setSearchTime(0)
        return
      }
      setSearching(true)
      try {
        const params = new URLSearchParams({
          dir: directoryPath,
          q: query,
        })
        if (tools.length > 0) {
          params.set('tool', tools.join(','))
        }
        const res = await fetch(`/api/search?${params.toString()}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Search failed (${res.status})`)
        }
        const data: SearchResponse = await res.json()
        setSearchResults(data.results)
        setSearchTotalMatches(data.totalMatches)
        setSearchTime(data.searchTime)
        setExpandedSearchResults(new Set())
      } catch (err: any) {
        setError(err.message || 'Search failed')
      } finally {
        setSearching(false)
      }
    },
    [directoryPath]
  )

  // --- Effects ---

  // Auto-scan on mount
  useEffect(() => {
    scanDirectory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Debounced search
  useEffect(() => {
    if (viewMode !== 'search') return
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      performSearch(searchQuery, toolTypeFilter)
    }, 500)
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [searchQuery, toolTypeFilter, viewMode, performSearch])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setViewMode('search')
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
      // Escape to close expanded items or go back
      if (e.key === 'Escape') {
        if (expandedToolUses.size > 0) {
          setExpandedToolUses(new Set())
        } else if (expandedSearchResults.size > 0) {
          setExpandedSearchResults(new Set())
        } else if (viewMode === 'conversation') {
          setViewMode('dashboard')
          setConversationData(null)
          setSelectedConversation(null)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [expandedToolUses, expandedSearchResults, viewMode])

  // --- Event Handlers ---

  const handleScan = useCallback(() => {
    scanDirectory()
  }, [scanDirectory])

  const handleScanKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') scanDirectory()
    },
    [scanDirectory]
  )

  const toggleProject = useCallback((projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }, [])

  const toggleToolUse = useCallback((toolUseId: string) => {
    setExpandedToolUses((prev) => {
      const next = new Set(prev)
      if (next.has(toolUseId)) {
        next.delete(toolUseId)
      } else {
        next.add(toolUseId)
      }
      return next
    })
  }, [])

  const toggleSearchResult = useCallback((id: string) => {
    setExpandedSearchResults((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleToolFilter = useCallback((toolType: string) => {
    setToolTypeFilter((prev) =>
      prev.includes(toolType)
        ? prev.filter((t) => t !== toolType)
        : [...prev, toolType]
    )
  }, [])

  const goBack = useCallback(() => {
    setViewMode('dashboard')
    setConversationData(null)
    setSelectedConversation(null)
    setExpandedToolUses(new Set())
  }, [])

  // --- Build tool result map for conversation view ---
  const toolResultMap = new Map<string, ExtractedToolResult>()
  if (conversationData) {
    for (const msg of conversationData.messages) {
      for (const result of msg.toolResults) {
        toolResultMap.set(result.toolUseId, result)
      }
    }
  }

  // --- Computed ---
  const totalConversations = projects.reduce(
    (sum, p) => sum + p.conversations.length,
    0
  )

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="flex flex-col h-screen bg-everforest-bg0 text-everforest-fg overflow-hidden">
      {/* ===== TOP BAR ===== */}
      <header className="shrink-0 bg-everforest-bg1 border-b border-everforest-bg3">
        {/* Row 1: Title + directory input */}
        <div className="flex items-center gap-3 px-4 py-2">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-1.5 rounded hover:bg-everforest-bg2 transition-colors text-everforest-grey1"
            title="Toggle sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Title */}
          <div className="flex items-center gap-2 shrink-0">
            <Terminal className="w-5 h-5 text-everforest-green" />
            <h1 className="text-lg font-bold text-everforest-fg hidden sm:block">
              Claude Code Explorer
            </h1>
            <h1 className="text-lg font-bold text-everforest-fg sm:hidden">
              CCE
            </h1>
          </div>

          {/* Directory input + Scan */}
          <div className="flex items-center gap-2 flex-1 min-w-0 ml-4">
            <div className="flex-1 min-w-0 relative">
              <FolderOpen className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-everforest-grey0" />
              <input
                ref={dirInputRef}
                type="text"
                value={directoryPath}
                onChange={(e) => setDirectoryPath(e.target.value)}
                onKeyDown={handleScanKeyDown}
                placeholder="~/.claude/projects"
                className="w-full bg-everforest-bg-dim border border-everforest-bg3 rounded-md pl-9 pr-3 py-1.5 text-sm font-mono text-everforest-fg placeholder:text-everforest-grey0 focus:outline-none focus:border-everforest-green focus:ring-1 focus:ring-everforest-green/30 transition-colors"
              />
            </div>
            <button
              onClick={handleScan}
              disabled={scanning}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
                scanning
                  ? 'bg-everforest-bg3 text-everforest-grey1 cursor-not-allowed'
                  : 'bg-everforest-green text-everforest-bg-dim hover:bg-everforest-aqua'
              )}
            >
              {scanning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Scan
            </button>
          </div>
        </div>

        {/* Row 2: View mode tabs */}
        <div className="flex items-center gap-1 px-4 pb-1">
          <button
            onClick={() => setViewMode('dashboard')}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 text-sm rounded-md transition-colors',
              viewMode === 'dashboard'
                ? 'bg-everforest-bg3 text-everforest-fg font-medium'
                : 'text-everforest-grey1 hover:bg-everforest-bg2 hover:text-everforest-fg'
            )}
          >
            <BarChart3 className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => {
              setViewMode('search')
              setTimeout(() => searchInputRef.current?.focus(), 50)
            }}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 text-sm rounded-md transition-colors',
              viewMode === 'search'
                ? 'bg-everforest-bg3 text-everforest-fg font-medium'
                : 'text-everforest-grey1 hover:bg-everforest-bg2 hover:text-everforest-fg'
            )}
          >
            <Search className="w-4 h-4" />
            Search Tools
          </button>
          {viewMode === 'conversation' && (
            <button
              onClick={goBack}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-sm rounded-md bg-everforest-bg3 text-everforest-fg font-medium"
            >
              <MessageSquare className="w-4 h-4" />
              Conversation
            </button>
          )}
          <span className="ml-auto text-xs text-everforest-grey0 hidden sm:inline">
            Ctrl+K to search
          </span>
        </div>
      </header>

      {/* ===== BODY: Sidebar + Main ===== */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ----- SIDEBAR ----- */}
        <aside
          className={cn(
            'shrink-0 bg-everforest-bg1 border-r border-everforest-bg3 flex flex-col transition-all duration-200 overflow-hidden',
            sidebarOpen ? 'w-72' : 'w-0',
            // On mobile, overlay
            'max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-30 max-lg:top-[90px]',
            !sidebarOpen && 'max-lg:hidden'
          )}
        >
          {/* Sidebar header */}
          <div className="px-3 py-2 border-b border-everforest-bg3 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-everforest-grey0">
              Projects
            </span>
            <span className="text-xs text-everforest-grey0 font-mono">
              {projects.length}
            </span>
          </div>

          {/* Project list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {projects.length === 0 && !scanning && (
              <div className="p-4 text-center text-sm text-everforest-grey0">
                No projects found.
                <br />
                Scan a directory to get started.
              </div>
            )}
            {scanning && (
              <div className="p-4 flex items-center justify-center text-everforest-grey1">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Scanning...
              </div>
            )}
            {projects.map((project) => {
              const isExpanded = expandedProjects.has(project.id)
              return (
                <div key={project.id}>
                  {/* Project header */}
                  <button
                    onClick={() => toggleProject(project.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-everforest-bg2 transition-colors group"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-everforest-grey0 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-everforest-grey0 shrink-0" />
                    )}
                    <FolderOpen className="w-4 h-4 text-everforest-yellow shrink-0" />
                    <span className="text-sm text-everforest-fg truncate flex-1 font-medium">
                      {project.name}
                    </span>
                    <span className="text-[10px] text-everforest-grey0 font-mono shrink-0">
                      {project.conversations.length}
                    </span>
                  </button>

                  {/* Conversations list */}
                  {isExpanded && (
                    <div className="ml-4 border-l border-everforest-bg3">
                      {project.conversations
                        .sort((a, b) => b.lastModified - a.lastModified)
                        .map((conv) => {
                          const isSelected =
                            selectedConversation === conv.filePath
                          return (
                            <button
                              key={conv.id}
                              onClick={() => loadConversation(conv.filePath)}
                              className={cn(
                                'w-full flex items-start gap-2 px-3 py-2 text-left transition-colors',
                                isSelected
                                  ? 'bg-everforest-bg3 border-r-2 border-r-everforest-green'
                                  : 'hover:bg-everforest-bg2'
                              )}
                            >
                              <FileText
                                className={cn(
                                  'w-3.5 h-3.5 mt-0.5 shrink-0',
                                  isSelected
                                    ? 'text-everforest-green'
                                    : 'text-everforest-grey0'
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <div
                                  className={cn(
                                    'text-xs font-mono truncate',
                                    isSelected
                                      ? 'text-everforest-fg'
                                      : 'text-everforest-grey2'
                                  )}
                                >
                                  {conv.id.substring(0, 12)}...
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-everforest-grey0">
                                    {formatFileDate(conv.lastModified)}
                                  </span>
                                  <span className="text-[10px] text-everforest-grey0">
                                    {formatFileSize(conv.size)}
                                  </span>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Sidebar footer - stats */}
          <div className="shrink-0 border-t border-everforest-bg3 px-3 py-2 space-y-1">
            <div className="flex items-center gap-2 text-xs text-everforest-grey0">
              <FileText className="w-3.5 h-3.5" />
              <span>{totalConversations} conversations</span>
            </div>
            {stats && (
              <div className="flex items-center gap-2 text-xs text-everforest-grey0">
                <Wrench className="w-3.5 h-3.5" />
                <span>{stats.totalToolUses.toLocaleString()} tool uses</span>
              </div>
            )}
          </div>
        </aside>

        {/* Click-outside to close sidebar on mobile */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 z-20 bg-black/40"
            style={{ top: '90px' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ----- MAIN CONTENT ----- */}
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {/* Error banner */}
          {error && (
            <div className="shrink-0 bg-everforest-bg-red border-b border-everforest-red/30 px-4 py-2 flex items-center gap-3">
              <span className="text-sm text-everforest-red flex-1">{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-everforest-red/70 hover:text-everforest-red transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleScan}
                className="text-xs px-2 py-1 rounded bg-everforest-bg2 text-everforest-fg hover:bg-everforest-bg3 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="shrink-0 bg-everforest-bg-dim border-b border-everforest-bg3 px-4 py-2 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-everforest-green" />
              <span className="text-sm text-everforest-grey1">
                Loading conversation...
              </span>
            </div>
          )}

          {/* ===== DASHBOARD VIEW ===== */}
          {viewMode === 'dashboard' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {stats ? (
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Stats cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard
                      label="Projects"
                      value={stats.totalProjects}
                      icon={<FolderOpen className="w-6 h-6" />}
                    />
                    <StatCard
                      label="Conversations"
                      value={stats.totalConversations}
                      icon={<FileText className="w-6 h-6" />}
                    />
                    <StatCard
                      label="Tool Uses"
                      value={stats.totalToolUses.toLocaleString()}
                      icon={<Wrench className="w-6 h-6" />}
                    />
                  </div>

                  {/* Tool type distribution */}
                  <div className="bg-everforest-bg1 border border-everforest-bg3 rounded-lg p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-everforest-grey1 mb-4 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Tool Type Distribution
                    </h2>
                    <div className="space-y-2">
                      {Object.entries(stats.toolTypeCounts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([name, count]) => (
                          <ToolBar
                            key={name}
                            name={name}
                            count={count}
                            maxCount={Math.max(
                              ...Object.values(stats.toolTypeCounts)
                            )}
                          />
                        ))}
                    </div>
                  </div>

                  {/* Recent projects */}
                  <div className="bg-everforest-bg1 border border-everforest-bg3 rounded-lg p-5">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-everforest-grey1 mb-4 flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" />
                      Projects ({projects.length})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {projects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => {
                            toggleProject(project.id)
                            if (!expandedProjects.has(project.id)) {
                              setSidebarOpen(true)
                            }
                          }}
                          className="text-left bg-everforest-bg2 hover:bg-everforest-bg3 border border-everforest-bg3 rounded-lg p-3 transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <FolderOpen className="w-4 h-4 text-everforest-yellow shrink-0" />
                            <span className="text-sm font-medium text-everforest-fg truncate">
                              {project.name}
                            </span>
                          </div>
                          <div className="text-xs text-everforest-grey0">
                            {project.conversations.length} conversation
                            {project.conversations.length !== 1 && 's'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Terminal className="w-16 h-16 text-everforest-bg4 mb-4" />
                  <h2 className="text-xl font-bold text-everforest-fg mb-2">
                    Claude Code Explorer
                  </h2>
                  <p className="text-sm text-everforest-grey1 max-w-md mb-6">
                    Browse and search your Claude Code conversation logs.
                    Enter the path to your Claude projects directory and click
                    Scan to get started.
                  </p>
                  {scanning && (
                    <div className="flex items-center gap-2 text-everforest-green">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Scanning directory...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== CONVERSATION VIEW ===== */}
          {viewMode === 'conversation' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {conversationData ? (
                <>
                  {/* Conversation header */}
                  <div className="shrink-0 bg-everforest-bg1 border-b border-everforest-bg3 px-4 py-3">
                    <div className="flex items-center gap-3 mb-2">
                      <button
                        onClick={goBack}
                        className="p-1 rounded hover:bg-everforest-bg2 transition-colors text-everforest-grey1"
                        title="Back to dashboard"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-everforest-fg">
                            {conversationData.meta.projectName}
                          </span>
                          {conversationData.sessionInfo.gitBranch && (
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-everforest-bg-green text-everforest-green">
                              {conversationData.sessionInfo.gitBranch}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-everforest-grey0 mt-0.5 flex-wrap">
                          {conversationData.sessionInfo.cwd && (
                            <span className="font-mono truncate max-w-xs" title={conversationData.sessionInfo.cwd}>
                              {conversationData.sessionInfo.cwd}
                            </span>
                          )}
                          <span>
                            {conversationData.messages.length} messages
                          </span>
                          <span>
                            {conversationData.totalToolUses} tool uses
                          </span>
                          {conversationData.messages[0]?.timestamp && (
                            <span>
                              {new Date(
                                conversationData.messages[0].timestamp
                              ).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                    <div className="max-w-3xl mx-auto space-y-4">
                      {conversationData.messages.map((message) => (
                        <MessageCard
                          key={message.index}
                          message={message}
                          expandedToolUses={expandedToolUses}
                          onToggleToolUse={toggleToolUse}
                          toolResultMap={toolResultMap}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  {loading ? (
                    <div className="flex items-center gap-2 text-everforest-grey1">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading conversation...
                    </div>
                  ) : (
                    <span className="text-everforest-grey0">
                      Select a conversation from the sidebar.
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== SEARCH VIEW ===== */}
          {viewMode === 'search' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Search input + filters */}
              <div className="shrink-0 bg-everforest-bg1 border-b border-everforest-bg3 px-4 py-3 space-y-3">
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-everforest-grey0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tool uses... (e.g., ssh, .config, npm install)"
                    className="w-full bg-everforest-bg-dim border border-everforest-bg3 rounded-lg pl-10 pr-10 py-2.5 text-sm font-mono text-everforest-fg placeholder:text-everforest-grey0 focus:outline-none focus:border-everforest-green focus:ring-1 focus:ring-everforest-green/30 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-everforest-grey0 hover:text-everforest-fg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Tool type filter pills */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="w-3.5 h-3.5 text-everforest-grey0 shrink-0" />
                  {FILTER_TOOL_TYPES.map((toolType) => {
                    const isActive = toolTypeFilter.includes(toolType)
                    const color = getToolColor(toolType)
                    return (
                      <button
                        key={toolType}
                        onClick={() => toggleToolFilter(toolType)}
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-full transition-all duration-200',
                          isActive
                            ? 'font-semibold'
                            : 'hover:opacity-80'
                        )}
                        style={{
                          backgroundColor: isActive ? color + '33' : 'transparent',
                          color: isActive ? color : DEFAULT_TOOL_COLOR,
                          border: `1px solid ${isActive ? color + '66' : DEFAULT_TOOL_COLOR + '44'}`,
                        }}
                      >
                        {getToolIcon(toolType)}
                        {toolType}
                      </button>
                    )
                  })}
                  {toolTypeFilter.length > 0 && (
                    <button
                      onClick={() => setToolTypeFilter([])}
                      className="text-xs text-everforest-grey0 hover:text-everforest-fg transition-colors underline ml-1"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Search metadata */}
                {(searchResults.length > 0 || searching) && (
                  <div className="flex items-center gap-3 text-xs text-everforest-grey0">
                    {searching ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Searching...
                      </span>
                    ) : (
                      <>
                        <span>
                          {searchTotalMatches.toLocaleString()} match
                          {searchTotalMatches !== 1 && 'es'}
                        </span>
                        <span className="opacity-40">|</span>
                        <span>{searchTime}ms</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Search results */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                <div className="max-w-3xl mx-auto space-y-3">
                  {searching && searchResults.length === 0 && (
                    <div className="flex items-center justify-center py-12 text-everforest-grey1">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Searching...
                    </div>
                  )}

                  {!searching && searchQuery && searchResults.length === 0 && (
                    <div className="text-center py-12">
                      <Search className="w-10 h-10 text-everforest-bg4 mx-auto mb-3" />
                      <p className="text-sm text-everforest-grey1">
                        No results found for &quot;{searchQuery}&quot;
                      </p>
                      {toolTypeFilter.length > 0 && (
                        <p className="text-xs text-everforest-grey0 mt-1">
                          Try removing some tool type filters.
                        </p>
                      )}
                    </div>
                  )}

                  {!searchQuery && !searching && (
                    <div className="text-center py-12">
                      <Search className="w-10 h-10 text-everforest-bg4 mx-auto mb-3" />
                      <p className="text-sm text-everforest-grey1">
                        Search across all tool uses in your conversations.
                      </p>
                      <p className="text-xs text-everforest-grey0 mt-1">
                        Try searching for file paths, commands, patterns, or
                        any text that appeared in tool inputs.
                      </p>
                    </div>
                  )}

                  {searchResults.map((result, idx) => {
                    const key = `${result.conversationId}-${result.toolUse.toolUseId}-${idx}`
                    return (
                      <SearchResultCard
                        key={key}
                        result={result}
                        isExpanded={expandedSearchResults.has(key)}
                        onToggle={() => toggleSearchResult(key)}
                        onOpenConversation={() =>
                          loadConversation(result.conversationPath)
                        }
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
