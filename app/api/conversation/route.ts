import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'
import { parseConversationFile, cleanProjectName } from '@/lib/parser'
import type { ConversationMeta, ConversationResponse } from '@/lib/types'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const fileParam = url.searchParams.get('file')

    if (!fileParam) {
      return NextResponse.json(
        { error: 'Missing required parameter: file' },
        { status: 400 }
      )
    }

    const filePath = decodeURIComponent(fileParam)
    const normalizedPath = path.normalize(filePath)

    // Check if file exists
    let fileStat
    try {
      fileStat = await fs.stat(normalizedPath)
    } catch {
      return NextResponse.json(
        { error: `File not found: ${normalizedPath}` },
        { status: 404 }
      )
    }

    // Read and parse the file
    const content = await fs.readFile(normalizedPath, 'utf-8')

    // Build ConversationMeta from the file path
    const fileName = path.basename(normalizedPath)
    const conversationId = fileName.replace(/\.jsonl$/, '')
    const parentDir = path.dirname(normalizedPath)
    const projectDirName = path.basename(parentDir)
    const projectName = cleanProjectName(projectDirName)

    // Check for subagents directory
    const subagentsDir = path.join(parentDir, conversationId, 'subagents')
    let hasSubagents = false
    try {
      const subStat = await fs.stat(subagentsDir)
      hasSubagents = subStat.isDirectory()
    } catch {
      // No subagents directory
    }

    const meta: ConversationMeta = {
      id: conversationId,
      fileName,
      filePath: normalizedPath,
      projectId: projectDirName,
      projectName,
      size: fileStat.size,
      lastModified: fileStat.mtimeMs,
      hasSubagents,
    }

    const conversation = parseConversationFile(content, meta)

    const response: ConversationResponse = { conversation }
    return NextResponse.json(response)
  } catch (err: any) {
    console.error('Conversation parse error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
