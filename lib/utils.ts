import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function formatFileDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function generateFileId(): string {
  return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Decodes JSON-escaped strings, handling both single and double escaping
 * @param value - The value to decode
 * @returns The decoded value, or the original if decoding fails
 */
export function decodeJsonString(value: unknown): unknown {
  if (typeof value !== 'string') return value
  
  // Check if the string contains common escape sequences
  if (!/\\[nrt"\\]/.test(value)) return value
  
  try {
    // First attempt: decode as a JSON string
    const decoded = JSON.parse(`"${value}"`)
    
    // Check if the result is still escaped (double-encoding case)
    if (typeof decoded === 'string' && /\\[nrt"\\]/.test(decoded)) {
      try {
        // Second attempt: decode again for double-escaped content
        return JSON.parse(`"${decoded}"`)
      } catch {
        return decoded
      }
    }
    
    return decoded
  } catch {
    // If the string starts and ends with quotes, it might be a full JSON string
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        return JSON.parse(value)
      } catch {
        return value
      }
    }
    return value
  }
}

/**
 * Normalizes content to markdown format, handling various input types
 * @param input - The content to normalize (string, array, or object)
 * @returns Markdown-formatted string
 */
export function normalizeToMarkdown(input: unknown): string {
  // First, try to decode if it's a JSON-encoded string
  const decoded = decodeJsonString(input)
  
  // Handle different content types
  if (typeof decoded === 'string') {
    return decoded
  }
  
  if (Array.isArray(decoded)) {
    // This will be handled by processMessageContent in the component
    return ''
  }
  
  if (decoded && typeof decoded === 'object') {
    return '```json\n' + JSON.stringify(decoded, null, 2) + '\n```'
  }
  
  return ''
}

/**
 * Extracts heredoc content from CLI commands
 * @param command - The command string that may contain a heredoc
 * @returns Object with the command and extracted heredoc content
 */
export function extractHeredocContent(command: string): {
  command: string
  heredocContent?: string
} {
  // Match heredoc patterns like $(cat <<'EOF' ... EOF)
  const heredocMatch = command.match(/\$\(cat\s*<<\s*'?(\w+)'?\s*\n([\s\S]*?)\n\1\s*\)/)
  
  if (heredocMatch) {
    const heredocContent = heredocMatch[2]
    const commandWithoutHeredoc = command.replace(heredocMatch[0], '[HEREDOC CONTENT]')
    
    return {
      command: commandWithoutHeredoc,
      heredocContent: decodeJsonString(heredocContent) as string
    }
  }
  
  return { command }
}

/**
 * Detects the language for syntax highlighting based on file extension
 * @param filePath - The file path to analyze
 * @returns The language identifier for code blocks
 */
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'py': 'python',
    'rs': 'rust',
    'go': 'go',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'rb': 'ruby',
    'php': 'php',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'sh': 'bash',
    'bash': 'bash',
    'zsh': 'bash',
    'fish': 'bash',
    'ps1': 'powershell',
    'json': 'json',
    'jsonl': 'json',
    'xml': 'xml',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'md': 'markdown',
    'mdx': 'markdown',
    'yml': 'yaml',
    'yaml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'conf': 'conf',
    'txt': 'text',
    'sql': 'sql',
    'dockerfile': 'dockerfile',
    'makefile': 'makefile',
    'cmake': 'cmake',
    'gradle': 'gradle',
    'r': 'r',
    'R': 'r',
    'm': 'matlab',
    'jl': 'julia',
    'lua': 'lua',
    'vim': 'vim',
    'diff': 'diff',
    'patch': 'diff'
  }
  
  return languageMap[ext || ''] || 'text'
}

/**
 * Formats tool input for better readability
 * @param input - The tool input object
 * @param toolName - The name of the tool being used
 * @returns Formatted markdown string
 */
export function formatToolInput(input: any, toolName?: string): string {
  if (!input) return ''
  
  // Decode the input if it's a string
  const decodedInput = decodeJsonString(input)
  
  // Special handling for ExitPlanMode and similar tools with plan/prompt fields
  if (typeof decodedInput === 'object' && decodedInput !== null) {
    // Check for Write tool (has file_path and content)
    if ('file_path' in decodedInput && 'content' in decodedInput) {
      const filePath = decodedInput.file_path as string
      const content = decodeJsonString(decodedInput.content) as string
      const language = getLanguageFromPath(filePath)
      
      let result = `**Writing to:** \`${filePath}\`\n\n`
      result += `\`\`\`${language}\n${content}\n\`\`\`\n`
      return result
    }
    
    // Check for Edit tool (has file_path, old_string, new_string)
    if ('file_path' in decodedInput && 'old_string' in decodedInput && 'new_string' in decodedInput) {
      const filePath = decodedInput.file_path as string
      const oldString = decodeJsonString(decodedInput.old_string) as string
      const newString = decodeJsonString(decodedInput.new_string) as string
      const language = getLanguageFromPath(filePath)
      
      let result = `**Editing:** \`${filePath}\`\n\n`
      
      // Show replace_all flag if present
      if ('replace_all' in decodedInput && decodedInput.replace_all) {
        result += `*Replacing all occurrences*\n\n`
      }
      
      result += `**Old:**\n\`\`\`${language}\n${oldString}\n\`\`\`\n\n`
      result += `**New:**\n\`\`\`${language}\n${newString}\n\`\`\`\n`
      return result
    }
    
    // Check for MultiEdit tool (has file_path and edits array)
    if ('file_path' in decodedInput && 'edits' in decodedInput && Array.isArray(decodedInput.edits)) {
      const filePath = decodedInput.file_path as string
      const language = getLanguageFromPath(filePath)
      
      let result = `**Multiple edits to:** \`${filePath}\`\n\n`
      result += `**${decodedInput.edits.length} edit${decodedInput.edits.length !== 1 ? 's' : ''}:**\n\n`
      
      decodedInput.edits.forEach((edit: any, index: number) => {
        result += `### Edit ${index + 1}${edit.replace_all ? ' (Replace All)' : ''}\n\n`
        const oldStr = decodeJsonString(edit.old_string || '') as string
        const newStr = decodeJsonString(edit.new_string || '') as string
        
        if (oldStr) {
          result += `**Old:**\n\`\`\`${language}\n${oldStr}\n\`\`\`\n\n`
        }
        result += `**New:**\n\`\`\`${language}\n${newStr}\n\`\`\`\n\n`
      })
      
      return result.trim()
    }
    
    // Check for Read tool (has file_path)
    if ('file_path' in decodedInput && !('content' in decodedInput) && !('old_string' in decodedInput)) {
      const filePath = decodedInput.file_path as string
      let result = `**Reading:** \`${filePath}\`\n`
      
      if ('offset' in decodedInput || 'limit' in decodedInput) {
        result += '\n**Parameters:**\n'
        if ('offset' in decodedInput) result += `- Starting at line: ${decodedInput.offset}\n`
        if ('limit' in decodedInput) result += `- Lines to read: ${decodedInput.limit}\n`
      }
      
      return result
    }
    
    // Check for Grep tool (has pattern)
    if ('pattern' in decodedInput && typeof decodedInput.pattern === 'string') {
      let result = `**Searching for:** \`${decodedInput.pattern}\`\n\n`
      
      if ('path' in decodedInput) result += `**In:** \`${decodedInput.path}\`\n`
      if ('glob' in decodedInput) result += `**File pattern:** \`${decodedInput.glob}\`\n`
      if ('type' in decodedInput) result += `**File type:** ${decodedInput.type}\n`
      if ('-i' in decodedInput && decodedInput['-i']) result += `*Case insensitive*\n`
      if ('output_mode' in decodedInput) result += `**Output mode:** ${decodedInput.output_mode}\n`
      
      return result
    }
    
    // Check for Glob tool (has pattern but not 'pattern' in grep sense)
    if ('pattern' in decodedInput && !('path' in decodedInput && 'glob' in decodedInput)) {
      let result = `**Finding files matching:** \`${decodedInput.pattern}\`\n`
      if ('path' in decodedInput) result += `**In directory:** \`${decodedInput.path}\`\n`
      return result
    }
    
    // Check for WebSearch/WebFetch
    if ('query' in decodedInput && typeof decodedInput.query === 'string') {
      return `**Search query:** "${decodedInput.query}"\n`
    }
    
    if ('url' in decodedInput && typeof decodedInput.url === 'string') {
      let result = `**Fetching:** ${decodedInput.url}\n`
      if ('prompt' in decodedInput && typeof decodedInput.prompt === 'string') {
        result += `\n**Analysis prompt:**\n${decodedInput.prompt}\n`
      }
      return result
    }
    
    // Check for plan field (ExitPlanMode)
    if ('plan' in decodedInput && typeof decodedInput.plan === 'string') {
      const decodedPlan = decodeJsonString(decodedInput.plan) as string
      return formatMarkdownContent(decodedPlan)
    }
    
    // Check for prompt field (Task tool)
    if ('prompt' in decodedInput && typeof decodedInput.prompt === 'string') {
      const decodedPrompt = decodeJsonString(decodedInput.prompt) as string
      let result = ''
      if ('description' in decodedInput && typeof decodedInput.description === 'string') {
        result += `**Task:** ${decodedInput.description}\n\n`
      }
      result += formatMarkdownContent(decodedPrompt)
      return result
    }
    
    // Check for command field (Bash tool)
    if ('command' in decodedInput && typeof decodedInput.command === 'string') {
      const command = decodeJsonString(decodedInput.command) as string
      const { command: cleanCommand, heredocContent } = extractHeredocContent(command)
      
      let result = `**Command:**\n\`\`\`bash\n${cleanCommand}\n\`\`\`\n\n`
      if (heredocContent) {
        result += `**Content:**\n${formatMarkdownContent(heredocContent)}\n`
      }
      if ('description' in decodedInput && typeof decodedInput.description === 'string') {
        result += `\n*${decodedInput.description}*\n`
      }
      return result
    }
    
    // For other objects, format as JSON but more readable
    return '```json\n' + JSON.stringify(decodedInput, null, 2) + '\n```'
  }
  
  // If it's a string, format it as markdown
  if (typeof decodedInput === 'string') {
    return formatMarkdownContent(decodedInput)
  }
  
  return '```json\n' + JSON.stringify(decodedInput, null, 2) + '\n```'
}

/**
 * Formats markdown content with proper structure
 * @param content - The content string that may contain markdown
 * @returns Properly formatted markdown
 */
export function formatMarkdownContent(content: string): string {
  if (!content) return ''
  
  // Decode if needed
  const decoded = decodeJsonString(content) as string
  
  // Split by newlines and process
  const lines = decoded.split(/\\n|\n/)
  let formatted = ''
  let inCodeBlock = false
  
  for (const line of lines) {
    // Check for code block markers
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      formatted += line + '\n'
      continue
    }
    
    // Don't process lines inside code blocks
    if (inCodeBlock) {
      formatted += line + '\n'
      continue
    }
    
    // Handle headers
    if (line.match(/^#{1,6}\s+/)) {
      formatted += '\n' + line + '\n'
    }
    // Handle list items (bullets or numbers)
    else if (line.match(/^\s*[-*+]\s+/) || line.match(/^\s*\d+\.\s+/)) {
      formatted += line + '\n'
    }
    // Handle indented content (likely part of a list)
    else if (line.match(/^\s{2,}/) && line.trim()) {
      formatted += line + '\n'
    }
    // Handle empty lines
    else if (!line.trim()) {
      formatted += '\n'
    }
    // Regular text
    else {
      formatted += line + '\n'
    }
  }
  
  // Clean up excessive newlines
  return formatted.replace(/\n{3,}/g, '\n\n').trim()
}