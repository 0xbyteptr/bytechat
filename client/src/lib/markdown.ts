// Simple markdown renderer for chat messages
export function renderMarkdown(text: string): string {
  if (!text) return ''
  
  let html = text
  
  // Escape HTML to prevent XSS
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Code blocks (triple backticks)
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="code-block"><code class="language-${lang || 'plaintext'}">${code.trim()}</code></pre>`
  })
  
  // Inline code (single backticks)
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
  
  // Bold (double asterisks or underscores)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>')
  
  // Italic (single asterisk or underscore)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>')
  
  // Strikethrough (double tildes)
  html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>')
  
  // Spoiler (double pipes)
  html = html.replace(/\|\|([^|]+)\|\|/g, '<span class="spoiler">$1</span>')
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
  
  // Auto-link URLs
  html = html.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
  
  // Mentions (@username)
  html = html.replace(/@(\w+(?:\.\w+)*)/g, '<span class="mention">@$1</span>')
  
  // Line breaks
  html = html.replace(/\n/g, '<br>')
  
  return html
}

export function stripMarkdown(text: string): string {
  if (!text) return ''
  
  return text
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\|\|([^|]+)\|\|/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

export function hasMarkdown(text: string): boolean {
  if (!text) return false
  
  const markdownPatterns = [
    /```[\s\S]*?```/,
    /`[^`]+`/,
    /\*\*[^*]+\*\*/,
    /__[^_]+__/,
    /\*[^*]+\*/,
    /_[^_]+_/,
    /~~[^~]+~~/,
    /\|\|[^|]+\|\|/,
    /\[[^\]]+\]\([^)]+\)/
  ]
  
  return markdownPatterns.some(pattern => pattern.test(text))
}
