import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { countToolUsesInFile, cleanProjectName } from '@/lib/parser'
import type { Project, ConversationMeta, ScanResponse, DashboardStats } from '@/lib/types'

function expandTilde(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1))
  }
  if (p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(2))
  }
  return p
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const dirParam = url.searchParams.get('dir')
    const baseDir = dirParam
      ? expandTilde(decodeURIComponent(dirParam))
      : path.join(os.homedir(), '.claude', 'projects')

    // Verify the directory exists
    let dirStat
    try {
      dirStat = await fs.stat(baseDir)
    } catch {
      return NextResponse.json(
        { error: `Directory not found: ${baseDir}` },
        { status: 404 }
      )
    }
    if (!dirStat.isDirectory()) {
      return NextResponse.json(
        { error: `Not a directory: ${baseDir}` },
        { status: 400 }
      )
    }

    // Read all entries in the base directory
    const entries = await fs.readdir(baseDir, { withFileTypes: true })

    const projects: Project[] = []
    const stats: DashboardStats = {
      totalProjects: 0,
      totalConversations: 0,
      totalToolUses: 0,
      toolTypeCounts: {},
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const projectDirName = entry.name
      const projectPath = path.join(baseDir, projectDirName)
      const projectName = cleanProjectName(projectDirName)

      // Read project directory for .jsonl files (skip subagents/ subdirectory)
      let projectEntries
      try {
        projectEntries = await fs.readdir(projectPath, { withFileTypes: true })
      } catch {
        continue // Skip inaccessible directories
      }

      const conversations: ConversationMeta[] = []

      for (const pEntry of projectEntries) {
        // Skip directories (including subagents/)
        if (pEntry.isDirectory()) continue
        if (!pEntry.name.endsWith('.jsonl')) continue

        const filePath = path.join(projectPath, pEntry.name)

        let fileStat
        try {
          fileStat = await fs.stat(filePath)
        } catch {
          continue
        }

        // Check if a subagents directory exists for this conversation
        const conversationId = pEntry.name.replace(/\.jsonl$/, '')
        const subagentsDir = path.join(projectPath, conversationId, 'subagents')
        let hasSubagents = false
        try {
          const subStat = await fs.stat(subagentsDir)
          hasSubagents = subStat.isDirectory()
        } catch {
          // No subagents directory
        }

        // Quick count tool uses
        let toolCounts = { total: 0, byType: {} as Record<string, number> }
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          toolCounts = countToolUsesInFile(content)
        } catch {
          // Skip tool counting on read failure
        }

        const meta: ConversationMeta = {
          id: conversationId,
          fileName: pEntry.name,
          filePath: filePath,
          projectId: projectDirName,
          projectName: projectName,
          size: fileStat.size,
          lastModified: fileStat.mtimeMs,
          hasSubagents,
        }

        conversations.push(meta)

        // Accumulate stats
        stats.totalToolUses += toolCounts.total
        for (const [toolName, count] of Object.entries(toolCounts.byType)) {
          stats.toolTypeCounts[toolName] = (stats.toolTypeCounts[toolName] || 0) + count
        }
      }

      if (conversations.length > 0) {
        projects.push({
          id: projectDirName,
          name: projectName,
          path: projectPath,
          conversations,
        })

        stats.totalProjects++
        stats.totalConversations += conversations.length
      }
    }

    const response: ScanResponse = { projects, stats }
    return NextResponse.json(response)
  } catch (err: any) {
    console.error('Scan error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
