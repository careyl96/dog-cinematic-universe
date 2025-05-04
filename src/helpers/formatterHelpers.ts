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
      if (
        /\n\s*\n/.test(token) ||
        (/\n/.test(currentChunk) && /\n/.test(token))
      ) {
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

  // Remove null bytes
  text = text.replace(/\0/g, '')

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim()

  // Escape special characters (useful for JSON or certain file formats)
  text = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

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

export const shuffle = (array: any) => {
  let currentIndex = array.length

  // While there remain elements to shuffle...
  while (currentIndex != 0) {
    // Pick a remaining element...
    let randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--

    // And swap it with the current element.
    ;[array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ]
  }
  return array
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
