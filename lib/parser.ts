// ============================================================
// Claude Code Conversation JSONL Parser
// ============================================================

import {
  ConversationMeta,
  ParsedConversation,
  ParsedMessage,
  SessionInfo,
  ExtractedToolUse,
  ExtractedToolResult,
} from './types'

/** Raw JSONL line structure from Claude Code conversation logs */
interface RawJsonlLine {
  type: string
  message?: {
    role?: string
    content?: string | any[]
    model?: string
    id?: string
  }
  summary?: string
  timestamp?: string
  uuid?: string
  sessionId?: string
  gitBranch?: string
  cwd?: string
  version?: string
  parentUuid?: string
  isSidechain?: boolean
  [key: string]: any
}

/**
 * Parse a single JSONL line into a structured object.
 * Returns null for lines that should be skipped (progress, file-history-snapshot, etc.)
 */
function parseJsonlLine(line: string): RawJsonlLine | null {
  try {
    const data = JSON.parse(line) as RawJsonlLine
    return data
  } catch {
    return null
  }
}

/**
 * Extract session info from the first meaningful line of a conversation
 */
function extractSessionInfo(lines: RawJsonlLine[]): SessionInfo {
  const info: SessionInfo = {}
  for (const line of lines) {
    if (line.sessionId) info.sessionId = line.sessionId
    if (line.gitBranch) info.gitBranch = line.gitBranch
    if (line.cwd) info.cwd = line.cwd
    if (line.version) info.version = line.version
    if (info.sessionId) break
  }
  return info
}

/**
 * Extract tool uses from an assistant message content array
 */
function extractToolUses(content: any, messageIndex: number, timestamp?: string): ExtractedToolUse[] {
  const toolUses: ExtractedToolUse[] = []

  if (!Array.isArray(content)) return toolUses

  for (const item of content) {
    if (item?.type === 'tool_use') {
      const toolUse: ExtractedToolUse = {
        toolUseId: item.id || '',
        name: item.name || 'unknown',
        input: item.input || {},
        timestamp,
        messageIndex,
      }

      // Extract searchable fields based on tool type
      const input = item.input || {}
      if (input.file_path) toolUse.filePath = input.file_path
      if (input.command) toolUse.command = input.command
      if (input.pattern) toolUse.searchPattern = input.pattern
      if (input.description) toolUse.description = input.description
      if (input.url) toolUse.url = input.url

      toolUses.push(toolUse)
    }
  }

  return toolUses
}

/**
 * Extract tool results from a user message content array
 */
function extractToolResults(content: any): ExtractedToolResult[] {
  const results: ExtractedToolResult[] = []

  if (!Array.isArray(content)) return results

  for (const item of content) {
    if (item?.tool_use_id) {
      results.push({
        toolUseId: item.tool_use_id,
        content: item.content,
        isError: item.is_error === true,
      })
    }
  }

  return results
}

/**
 * Extract text content from a message content field
 */
function extractTextContent(content: any): string {
  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    return content
      .filter((item: any) => item?.type === 'text' && typeof item.text === 'string')
      .map((item: any) => item.text)
      .join('\n')
  }

  return ''
}

/**
 * Parse a full JSONL file content string into a ParsedConversation
 */
export function parseConversationFile(
  content: string,
  meta: ConversationMeta
): ParsedConversation {
  const rawLines = content.trim().split('\n')
  const parsedLines: RawJsonlLine[] = []

  for (const line of rawLines) {
    const parsed = parseJsonlLine(line)
    if (parsed) parsedLines.push(parsed)
  }

  const sessionInfo = extractSessionInfo(parsedLines)
  const messages: ParsedMessage[] = []
  let totalToolUses = 0

  for (let i = 0; i < parsedLines.length; i++) {
    const line = parsedLines[i]

    // Skip non-message types
    if (!['user', 'assistant', 'summary'].includes(line.type)) continue

    const timestamp = line.timestamp

    if (line.type === 'summary') {
      messages.push({
        index: i,
        type: 'summary',
        timestamp,
        textContent: line.summary || '',
        toolUses: [],
        toolResults: [],
      })
      continue
    }

    if (!line.message) continue

    const messageContent = line.message.content
    const textContent = extractTextContent(messageContent)
    const toolUses = line.type === 'assistant'
      ? extractToolUses(messageContent, i, timestamp)
      : []
    const toolResults = line.type === 'user'
      ? extractToolResults(messageContent)
      : []

    totalToolUses += toolUses.length

    // Skip assistant messages that are only thinking blocks (no text, no tool uses)
    if (line.type === 'assistant' && !textContent && toolUses.length === 0) {
      continue
    }

    messages.push({
      index: i,
      type: line.type,
      timestamp,
      textContent,
      toolUses,
      toolResults,
    })
  }

  return {
    meta,
    messages,
    sessionInfo,
    totalToolUses,
  }
}

/**
 * Quick count of tool uses in a JSONL file without full parsing.
 * Reads the file content and counts tool_use entries.
 */
export function countToolUsesInFile(content: string): { total: number; byType: Record<string, number> } {
  const byType: Record<string, number> = {}
  let total = 0

  const lines = content.trim().split('\n')
  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      if (data.type === 'assistant' && data.message?.content && Array.isArray(data.message.content)) {
        for (const item of data.message.content) {
          if (item?.type === 'tool_use' && item.name) {
            total++
            byType[item.name] = (byType[item.name] || 0) + 1
          }
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  return { total, byType }
}

/**
 * Clean a project directory name into a human-readable project name.
 * The directory name is the original path with path separators replaced by dashes,
 * and drive separators replaced by double-dashes.
 * E.g. "C--Users-vhspe-Documents-DevTest-BoldBrushCreator" -> "DevTest / BoldBrushCreator"
 */
export function cleanProjectName(dirName: string): string {
  // Split on '--' to separate drive letter from rest of path
  const parts = dirName.split('--')
  const pathPart = parts.slice(1).join('--')

  // Try to find 'Documents-' and take everything after it
  const docIndex = pathPart.indexOf('Documents-')
  const suffix = docIndex !== -1
    ? pathPart.substring(docIndex + 'Documents-'.length)
    : pathPart

  if (!suffix) return dirName

  // Replace first dash with ' / ' for readability (category / project)
  const firstDash = suffix.indexOf('-')
  if (firstDash !== -1) {
    return suffix.substring(0, firstDash) + ' / ' + suffix.substring(firstDash + 1)
  }

  return suffix
}

/**
 * Get searchable text for a tool use (for search functionality).
 * Combines all relevant fields into a single searchable string.
 */
export function getToolUseSearchText(toolUse: ExtractedToolUse): string {
  const parts: string[] = [toolUse.name]

  if (toolUse.filePath) parts.push(toolUse.filePath)
  if (toolUse.command) parts.push(toolUse.command)
  if (toolUse.searchPattern) parts.push(toolUse.searchPattern)
  if (toolUse.description) parts.push(toolUse.description)
  if (toolUse.url) parts.push(toolUse.url)

  // Also include key input fields as text
  const input = toolUse.input || {}
  if (input.content && typeof input.content === 'string') parts.push(input.content)
  if (input.old_string && typeof input.old_string === 'string') parts.push(input.old_string)
  if (input.new_string && typeof input.new_string === 'string') parts.push(input.new_string)
  if (input.query && typeof input.query === 'string') parts.push(input.query)
  if (input.glob && typeof input.glob === 'string') parts.push(input.glob)
  if (input.path && typeof input.path === 'string') parts.push(input.path)

  return parts.join(' ')
}
