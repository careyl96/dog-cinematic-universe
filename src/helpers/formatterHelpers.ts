export const getCharacterCount = (text: string): number => {
  return text.length
}

export const chunkifyText = (text: string, maxCharactersPerChunk = 4096) => {
  if (!text) return []

  // Step 1: Tokenize while preserving spaces and newlines
  const tokens = text.match(/(?:[^\s]+|\s+|\n+)/g) || []

  let chunks = []
  let currentChunk = ''

  for (let token of tokens) {
    // Check if adding this token would exceed the max chunk size based on character count
    if ((currentChunk + token).length > maxCharactersPerChunk) {
      // Try to preserve paragraph structure (split at paragraphs or significant breaks)
      if (/\n\s*\n/.test(token) || (/\n/.test(currentChunk) && /\n/.test(token))) {
        chunks.push(currentChunk.trim())
        currentChunk = token // Start a new chunk
      } else {
        chunks.push(currentChunk.trim())
        currentChunk = token
      }
    } else {
      currentChunk += token
    }
  }

  // Add the last chunk if it's non-empty
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

export const sanitizeInputText = (text: string) => {
  if (typeof text !== 'string') return ''

  // Regex to match URLs
  const urlRegex = /\b(?:https?:\/\/|www\.)\S+\b/g

  // Extract all URLs
  const urls = text.match(urlRegex) || []

  // Temporarily replace URLs with placeholders
  let index = 0
  text = text.replace(urlRegex, () => `__URL_PLACEHOLDER_${index++}__`)

  // Sanitize the non-URL text
  text = text
    .replace(/\0/g, '') // Remove null bytes
    .replace(/\s+/g, ' ')
    .trim() // Normalize whitespace
    .replace(/\\/g, '\\\\') // Escape backslashes
    .replace(/"/g, '\\"') // Escape quotes

  // Restore URLs
  urls.forEach((url, i) => {
    text = text.replace(`__URL_PLACEHOLDER_${i}__`, url)
  })

  return text
}

export const removePunctuation = (text: string) => {
  return text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
}

export const isSingleWord = (text: string): boolean => {
  // Trim the text to remove leading and trailing whitespace
  text = text.trim()
  // Check if the text contains any whitespace characters
  return !/\s/.test(text)
}

export const getCurrentTimestamp = () => {
  const now = new Date(Date.now())

  return now.toLocaleTimeString('en-US', {
    hourCycle: 'h24',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export const stripTimeFromTitle = (title: string): string => {
  return title.replace(/\s*-\s*\(\d+:\d+\)\s*$/, '').trim()
}

export const flattenCommandList = (commands: Record<string, string[]>): string[] => {
  return Object.values(commands).flat()
}

export const cleanMarkdown = (text: string): string => {
  return text
    .replace(/^#{1,6}\s*(.+)$/gm, '\n\n**$1**') // Replace headers (## or ### etc.) with bold text (e.g., **Header**)
    .replace(/\[\d+(?:,\s*\d+)*\]/g, '') // Remove inline references like [1, 2, 3]
    .replace(/\n{3,}/g, '\n\n') // Clean up excessive newlines
    .trim() // Trim leading/trailing whitespace
}

export const removeFirstIntentWord = (sentence: string, intents: string[]) => {
  if (!sentence) return sentence

  const words = sentence.trim().split(/\s+/)
  if (words.length === 0) return sentence

  // Check if the first word matches any intent
  if (intents.includes(words[0].toLowerCase())) {
    words.shift() // Remove the first word
  }

  return words.join(' ')
}
