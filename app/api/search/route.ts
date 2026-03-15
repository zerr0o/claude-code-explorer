import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { parseConversationFile, getToolUseSearchText, cleanProjectName } from '@/lib/parser'
import type { ConversationMeta, ToolSearchResult, SearchResponse } from '@/lib/types'

function expandTilde(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1))
  }
  if (p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(2))
  }
  return p
}

/**
 * Scan a directory and return all .jsonl file paths with their project info.
 */
async function findAllJsonlFiles(
  baseDir: string
): Promise<{ filePath: string; projectDirName: string; projectName: string }[]> {
  const results: { filePath: string; projectDirName: string; projectName: string }[] = []

  let entries
  try {
    entries = await fs.readdir(baseDir, { withFileTypes: true })
  } catch {
    return results
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const projectDirName = entry.name
    const projectPath = path.join(baseDir, projectDirName)
    const projectName = cleanProjectName(projectDirName)

    let projectEntries
    try {
      projectEntries = await fs.readdir(projectPath, { withFileTypes: true })
    } catch {
      continue
    }

    for (const pEntry of projectEntries) {
      if (pEntry.isDirectory()) continue
      if (!pEntry.name.endsWith('.jsonl')) continue

      results.push({
        filePath: path.join(projectPath, pEntry.name),
        projectDirName,
        projectName,
      })
    }
  }

  return results
}

/**
 * Extract a match context snippet from searchable text.
 * Finds the line containing the query and truncates to ~200 chars.
 */
function extractMatchContext(searchText: string, query: string): string {
  const queryLower = query.toLowerCase()
  const lines = searchText.split(/[\n\r]/)

  // First try to find a line containing the query
  for (const line of lines) {
    if (line.toLowerCase().includes(queryLower)) {
      const trimmed = line.trim()
      if (trimmed.length <= 200) return trimmed
      // Find the query position and show context around it
      const idx = trimmed.toLowerCase().indexOf(queryLower)
      const start = Math.max(0, idx - 80)
      const end = Math.min(trimmed.length, idx + query.length + 80)
      let snippet = trimmed.slice(start, end)
      if (start > 0) snippet = '...' + snippet
      if (end < trimmed.length) snippet = snippet + '...'
      return snippet
    }
  }

  // If no line match, search the whole text
  const idx = searchText.toLowerCase().indexOf(queryLower)
  if (idx === -1) return searchText.slice(0, 200)

  const start = Math.max(0, idx - 80)
  const end = Math.min(searchText.length, idx + query.length + 80)
  let snippet = searchText.slice(start, end).replace(/[\n\r]+/g, ' ')
  if (start > 0) snippet = '...' + snippet
  if (end < searchText.length) snippet = snippet + '...'
  return snippet
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const dirParam = url.searchParams.get('dir')
    const query = url.searchParams.get('q')
    const toolFilter = url.searchParams.get('tool')

    if (!query) {
      return NextResponse.json(
        { error: 'Missing required parameter: q' },
        { status: 400 }
      )
    }

    const baseDir = dirParam
      ? expandTilde(decodeURIComponent(dirParam))
      : path.join(os.homedir(), '.claude', 'projects')

    const startTime = performance.now()
    const queryLower = query.toLowerCase()

    // Parse tool filter into a set
    const toolTypes = toolFilter
      ? new Set(toolFilter.split(',').map((t) => t.trim()))
      : null

    // Find all JSONL files
    const jsonlFiles = await findAllJsonlFiles(baseDir)

    const results: ToolSearchResult[] = []

    for (const { filePath, projectDirName, projectName } of jsonlFiles) {
      let content: string
      try {
        content = await fs.readFile(filePath, 'utf-8')
      } catch {
        continue
      }

      const fileName = path.basename(filePath)
      const conversationId = fileName.replace(/\.jsonl$/, '')

      // Check for subagents
      const parentDir = path.dirname(filePath)
      const subagentsDir = path.join(parentDir, conversationId, 'subagents')
      let hasSubagents = false
      try {
        const subStat = await fs.stat(subagentsDir)
        hasSubagents = subStat.isDirectory()
      } catch {
        // No subagents directory
      }

      let fileStat
      try {
        fileStat = await fs.stat(filePath)
      } catch {
        continue
      }

      const meta: ConversationMeta = {
        id: conversationId,
        fileName,
        filePath,
        projectId: projectDirName,
        projectName,
        size: fileStat.size,
        lastModified: fileStat.mtimeMs,
        hasSubagents,
      }

      const conversation = parseConversationFile(content, meta)

      // Search through all tool uses in this conversation
      for (const message of conversation.messages) {
        for (const toolUse of message.toolUses) {
          // Apply tool type filter
          if (toolTypes && !toolTypes.has(toolUse.name)) continue

          const searchText = getToolUseSearchText(toolUse)

          if (searchText.toLowerCase().includes(queryLower)) {
            const matchContext = extractMatchContext(searchText, query)

            results.push({
              toolUse,
              conversationId,
              conversationPath: filePath,
              projectName,
              timestamp: toolUse.timestamp || message.timestamp,
              matchContext,
            })
          }
        }
      }
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0
      return timeB - timeA
    })

    const searchTime = performance.now() - startTime

    const response: SearchResponse = {
      results,
      totalMatches: results.length,
      searchTime: Math.round(searchTime),
    }

    return NextResponse.json(response)
  } catch (err: any) {
    console.error('Search error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
