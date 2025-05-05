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
  return title.replace(/\s*-\s*\((\d{1,2}:)?\d{1,2}:\d{2}\)\s*$/, '').trim()
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

export const formatFramedCommand = (command: string, totalWidth: number = 100) => {
  const maxCommandLength = totalWidth - 2 // account for 1 space padding on each side

  // Truncate if needed
  let displayCommand = command
  if (command.length > maxCommandLength) {
    displayCommand = command.slice(0, maxCommandLength - 1) + '…'
  }

  const paddedCommand = ` ${displayCommand} `
  const paddedLength = paddedCommand.length

  const remaining = totalWidth - paddedLength
  const leftEquals = '='.repeat(Math.floor(remaining / 2))
  const rightEquals = '='.repeat(Math.ceil(remaining / 2)) // handles odd spacing better
  const border = '='.repeat(totalWidth)

  return `${border}\n${leftEquals}${paddedCommand}${rightEquals}\n${border}`
}

export const msToTimestamp = (ms: number): string => {
  const hours = Math.floor(ms / 3600000) // 1 hour = 3600000 ms
  const minutes = Math.floor((ms % 3600000) / 60000) // 1 minute = 60000 ms
  const seconds = Math.floor((ms % 60000) / 1000) // 1 second = 1000 ms

  // Create a string representation based on what's non-zero
  let timeString = ''

  if (hours > 0) {
    timeString += `${hours}:`
  }

  timeString += `${minutes.toString().padStart(hours > 0 ? 2 : 1, '0')}:${seconds.toString().padStart(2, '0')}`

  return timeString
}

export const timestampToISO = (timestamp: string) => {
  if (!timestamp) return
  const parts = timestamp.split(':').map(Number)
  let hours = 0,
    minutes = 0,
    seconds = 0

  if (parts.length === 3) {
    ;[hours, minutes, seconds] = parts
  } else if (parts.length === 2) {
    ;[minutes, seconds] = parts
  }

  let iso = 'PT'
  if (hours) iso += `${hours}H`
  if (minutes) iso += `${minutes}M`
  if (seconds) iso += `${seconds}S`
  return iso
}

export const isoToTimestamp = (isoDuration: string) => {
  if (!isoDuration) return null
  // Extract hours, minutes, and seconds using regex
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)

  if (!match) return ''

  let hours = match[1] ? parseInt(match[1]) : 0
  let minutes = match[2] ? parseInt(match[2]) : 0
  let seconds = match[3] ? parseInt(match[3]) : 0

  // Format time components with leading zeros where necessary
  let formattedTime = [
    hours > 0 ? hours : null, // Include hours only if it's greater than 0
    hours > 0 || minutes > 9 ? minutes.toString().padStart(2, '0') : minutes, // Keep two digits for minutes if hours exist
    seconds.toString().padStart(2, '0'), // Always keep two digits for seconds
  ]
    .filter((val) => val !== null)
    .join(':') // Remove null values

  return formattedTime
}

export const parseISODurationToMs = (duration: string): number => {
  if (!duration) return
  // Regex for ISO 8601 durations like "PT1H30M15S", "P1DT12H"
  const regex =
    /^P(?:([0-9.]+)Y)?(?:([0-9.]+)M)?(?:([0-9.]+)W)?(?:([0-9.]+)D)?(?:T(?:([0-9.]+)H)?(?:([0-9.]+)M)?(?:([0-9.]+)S)?)?$/

  const matches = duration.match(regex)

  if (!matches) {
    throw new Error('Invalid ISO 8601 duration format')
  }

  // Extract years, months, weeks, days, hours, minutes, and seconds
  const [, years = '0', months = '0', weeks = '0', days = '0', hours = '0', minutes = '0', seconds = '0'] = matches

  // Calculate the total time in milliseconds
  const msInYear = 365.25 * 24 * 60 * 60 * 1000 // Average year length in ms (accounting for leap years)
  const msInMonth = 30.44 * 24 * 60 * 60 * 1000 // Average month length in ms
  const msInWeek = 7 * 24 * 60 * 60 * 1000 // Week length in ms
  const msInDay = 24 * 60 * 60 * 1000 // Day length in ms
  const msInHour = 60 * 60 * 1000 // Hour length in ms
  const msInMinute = 60 * 1000 // Minute length in ms
  const msInSecond = 1000 // Second length in ms

  return (
    parseFloat(years) * msInYear +
    parseFloat(months) * msInMonth +
    parseFloat(weeks) * msInWeek +
    parseFloat(days) * msInDay +
    parseFloat(hours) * msInHour +
    parseFloat(minutes) * msInMinute +
    parseFloat(seconds) * msInSecond
  )
}

export const escapeDiscordMarkdown = (text: string) => {
  return text.replace(/\|\|/g, '|︱')
}

// rounds down to lowest 10
export const roundPercentage = (a: number, b: number): number => {
  if (!a || !b) return 0
  if (b === 0) {
    throw new Error('Division by zero is not allowed.')
  }

  // Calculate and always round down to nearest whole percent
  const percentage = Math.floor((a / b) * 100)

  return percentage
}

export const stripBackticks = (str: string): string => {
  if (!str) return str

  // Remove leading and trailing backticks if present
  return str.replace(/^`(.*?)`$/, '$1')
}

export const generateProgressBar = (percent: number, barLength = 10): string => {
  const filled = Math.floor((percent / 100) * barLength)
  const empty = barLength - filled

  return `［ ${'￭'.repeat(filled)}${'･'.repeat(empty)} ］`
}
