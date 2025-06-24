import path from 'path'
import { readdir, stat, unlink } from 'fs/promises'
import dotenv from 'dotenv'
import { Message } from 'discord.js'
import { client } from '..'
import { MAX_AUDIO_FILES, VOICE_CHANNEL_IDS } from '../constants'

dotenv.config()

export const fetchMessages = async (channel: any, limit: number = 100): Promise<Message[]> => {
  let messages: Message[] = []
  let lastId: string | null = null

  while (messages.length < limit) {
    const fetchOptions: any = { limit: Math.min(limit - messages.length, 100) }
    if (lastId) {
      fetchOptions.before = lastId
    }

    const fetched = await channel.messages.fetch(fetchOptions)
    if (fetched.size === 0) break

    messages.push(...fetched.values())
    lastId = fetched.last()?.id || null
  }

  return messages
}

export const shuffle = (array: any) => {
  let currentIndex = array.length

  // While there remain elements to shuffle...
  while (currentIndex != 0) {
    // Pick a remaining element...
    let randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--

    // And swap it with the current element.
    ;[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
  }
  return array
}

export const pickRandomItemsFromList = (array: any[], count: number = 0) => {
  return shuffle(array).slice(0, count)
}

export const getGuildMember = async (userId: string, guildId: string) => {
  try {
    const guild = await client.guilds.fetch(guildId)
    const member = await guild.members.fetch(userId)
    return member
  } catch (error) {
    console.error('Failed to fetch guild member:', error)
    return null
  }
}

/**
 * Maintains a sliding window of the most recent audio files in a folder.
 * Deletes the oldest files if the limit is exceeded.
 */
export const enforceFileLimit = async (folder: string): Promise<void> => {
  interface FileStat {
    file: string
    mtime: Date
  }

  try {
    // Read all files in the folder
    const allFiles: string[] = await readdir(folder)

    // Only keep .ogg files
    const oggFiles = allFiles.filter((file) => path.extname(file).toLowerCase() === '.ogg')

    const fileStats: FileStat[] = await Promise.all(
      oggFiles.map(async (file): Promise<FileStat> => {
        const fullPath = path.join(folder, file)
        const stats = await stat(fullPath)
        return { file: fullPath, mtime: stats.mtime }
      })
    )

    // Sort by modified time (oldest first)
    fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime())

    // Delete oldest files if over the limit
    while (fileStats.length >= MAX_AUDIO_FILES) {
      const toDelete = fileStats.shift()
      if (toDelete) {
        await unlink(toDelete.file)
        console.log(`Enforcing cached audio file limit: deleted old .ogg file: ${toDelete.file}`)
      }
    }
  } catch (err) {
    console.error('Failed to enforce .ogg file limit:', err)
  }
}

export const findLastPhraseIndex = (words: string[], phraseWords: string[]): number => {
  for (let i = words.length - phraseWords.length; i >= 0; i--) {
    let matched = true
    for (let j = 0; j < phraseWords.length; j++) {
      if (words[i + j] !== phraseWords[j]) {
        matched = false
        break
      }
    }
    if (matched) return i
  }
  return -1
}

export const getRandomKeys = (obj: Record<string, any>): string[] => {
  // Get all keys of the object
  const keys = Object.keys(obj)

  // Shuffle the keys array using Fisher-Yates algorithm
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[keys[i], keys[j]] = [keys[j], keys[i]] // Swap the elements
  }

  // Return the first `n` keys from the shuffled array
  return keys
}
