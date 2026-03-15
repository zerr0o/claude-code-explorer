// ============================================================
// Claude Code Conversation Browser - Type Definitions
// ============================================================

/** A project directory containing conversation JSONL files */
export interface Project {
  id: string           // directory name (e.g., "C--Users-vhspe-Documents-DevTest-BoldBrushCreator")
  name: string         // cleaned name (e.g., "BoldBrushCreator")
  path: string         // full directory path
  conversations: ConversationMeta[]
}

/** Metadata about a conversation file (before full parsing) */
export interface ConversationMeta {
  id: string           // UUID from filename
  fileName: string     // filename (UUID.jsonl)
  filePath: string     // full file path
  projectId: string    // parent project id
  projectName: string  // cleaned project name
  size: number         // file size in bytes
  lastModified: number // file modification timestamp (ms)
  hasSubagents: boolean
}

/** Session metadata extracted from the first message */
export interface SessionInfo {
  sessionId?: string
  gitBranch?: string
  cwd?: string
  version?: string
}

/** An extracted tool use from an assistant message */
export interface ExtractedToolUse {
  toolUseId: string
  name: string
  input: Record<string, any>
  timestamp?: string
  messageIndex: number
  // Extracted searchable fields
  filePath?: string
  command?: string
  searchPattern?: string
  description?: string
  url?: string
}

/** A tool result from a user message */
export interface ExtractedToolResult {
  toolUseId: string
  content: any
  isError?: boolean
}

/** A parsed message with extracted tool uses and results */
export interface ParsedMessage {
  index: number
  type: 'user' | 'assistant' | 'summary' | string
  timestamp?: string
  textContent: string
  toolUses: ExtractedToolUse[]
  toolResults: ExtractedToolResult[]
}

/** A fully parsed conversation */
export interface ParsedConversation {
  meta: ConversationMeta
  messages: ParsedMessage[]
  sessionInfo: SessionInfo
  totalToolUses: number
}

/** A tool search result with context */
export interface ToolSearchResult {
  toolUse: ExtractedToolUse
  conversationId: string
  conversationPath: string
  projectName: string
  timestamp?: string
  matchContext: string
}

/** Dashboard statistics */
export interface DashboardStats {
  totalProjects: number
  totalConversations: number
  totalToolUses: number
  toolTypeCounts: Record<string, number>
}

// === API Response Types ===

export interface ScanResponse {
  projects: Project[]
  stats: DashboardStats
}

export interface ConversationResponse {
  conversation: ParsedConversation
}

export interface SearchResponse {
  results: ToolSearchResult[]
  totalMatches: number
  searchTime: number
}
