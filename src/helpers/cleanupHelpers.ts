// helpers to clean up stale data/errors/etc.

import fs from 'fs'
import { client } from '..'
import { BOT_USER_ID, PATH, TEXT_CHANNELS } from '../constants'
import { fetchMessages } from './otherHelpers'
import path from 'path'
import { extractYouTubeIdFromUrl } from './youtubeHelpers/youtubeFormatterHelpers'

// removes music embeds from the music bot channel (edit condition yourself)
export const cleanChannelMessages = async (count: number = 0): Promise<void> => {
  const musicBotChannel = client.channels.cache.get(TEXT_CHANNELS.MUSIC_BOT)
  const messages = await fetchMessages(musicBotChannel, count)

  for (const message of messages) {
    if (
      message.embeds.length > 0 &&
      message.embeds.some((embed: any) => embed.description?.includes(`Requested by: <@118585025905164291>`))
    ) {
      try {
        await message.delete()
        // console.log(`Deleted message ID: ${message.id}`)
      } catch (error) {
        console.warn(`Failed to delete message ID ${message.id}:`, error)
      }
    }
  }

  console.log('Channel cleanup complete.')
}

// currently only removing from bot user music_queue_history
export const purgeUnavailableTracks = async () => {
  const dirPath = path.join(PATH.USER_DATA, BOT_USER_ID)
  const filePath = path.join(dirPath, 'music_queue_history.json')

  // Ensure the directory exists
  fs.mkdirSync(dirPath, { recursive: true })

  // Write the file
  let existingData: any = {}

  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      existingData = JSON.parse(fileContent)
    } catch (err) {
      console.error('Error reading or parsing existing music_queue_history.json:', err)
    }
  }

  const musicBotChannel = client.channels.cache.get(TEXT_CHANNELS.MUSIC_BOT)
  const messages = await fetchMessages(musicBotChannel, 100)
  for (const message of messages) {
    if (
      message.embeds.length > 0 &&
      message.embeds.some((embed: any) => embed.description?.includes(`Video unavailable`))
    ) {
      try {
        const unavailableVideoId = extractYouTubeIdFromUrl(message.embeds[0].description.split(': ')[1].trim())
        delete existingData[unavailableVideoId]
      } catch (error) {
        console.warn(`Failed to delete message ID ${message.id}:`, error)
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf-8')
}

// old function to clean up bot reactions in music bot channel
export const removeSkipReactionsFromBot = async (
  channel: TextChannel,
  botUserId: string,
  limit: number = 100
): Promise<void> => {
  const messages: Message[] = await fetchMessages(channel, limit)

  for (const message of messages) {
    const reaction = message.reactions.cache.get('⏭️')
    if (reaction) {
      try {
        await reaction.users.remove(botUserId)
      } catch (err) {
        console.error(`Failed to remove ⏭️ from message ${message.id}:`, err)
      }
    }
  }
}

export const removeUncachedAudioFiles = () => {
  const jsonFilePath = path.join(PATH.AUDIO_FILES.GENERATED.YOUTUBE.DEFAULT, 'cache.json')
  const cacheDirPath = path.join(PATH.AUDIO_FILES.GENERATED.YOUTUBE.CACHE)

  // Read JSON file
  const rawData = fs.readFileSync(jsonFilePath, 'utf-8')
  const jsonData = JSON.parse(rawData)

  // Get valid keys from JSON
  const jsonKeys = new Set(Object.keys(jsonData))

  // Read all files in cache folder
  const cacheFiles = fs.readdirSync(cacheDirPath)

  // Remove any .ogg file that doesn't have a corresponding key in the JSON
  for (const file of cacheFiles) {
    if (!file.endsWith('.ogg')) continue

    const baseName = path.basename(file, '.ogg')
    if (!jsonKeys.has(baseName)) {
      const filePath = path.join(cacheDirPath, file)
      fs.unlinkSync(filePath)
      console.log(`Deleted: ${file}`)
    }
  }

  console.log('Cleanup complete.')
}
