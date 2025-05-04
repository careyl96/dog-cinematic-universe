type VideoRequest = {
  url: string
  videoId: string | null
  userId: string | null
  title: string
}

type GroupedRequests = {
  [userId: string]: {
    [videoId: string]: {
      title: string
      requestCount: number
    }
  }
}

const seedMusicHistory = async () => {
  const musicBotChannel = client.channels.cache.get(
    TEXT_CHANNELS.MUSIC_BOT
  ) as TextChannel

  const messages = await fetchMessages(musicBotChannel, 600)
  createJsonForAllUsers(groupRequestsByUser(filterAndFormatMessages(messages)))
}

export const fetchMessages = async (
  channel: any,
  limit: number = 100
): Promise<Message[]> => {
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

const extractIdFromMention = (mention: string): string | null => {
  const match = mention.match(/<@([0-9]+)>/)
  return match ? match[1] : null
}

export const filterAndFormatMessages = (
  messages: Message[]
): VideoRequest[] => {
  return messages
    .filter((message) => {
      return (
        message.author.username === 'dog cinematic universe' &&
        message.embeds.length === 1 &&
        message.embeds[0].data?.description?.includes('Requested by: ')
      )
    })
    .map((message) => {
      const data = message.embeds[0].data
      return {
        url: data.url,
        videoId: extractYouTubeIdFromUrl(data.url),
        userId: extractIdFromMention(data.description),
        title: data.title,
      }
    })
}

const groupRequestsByUser = (requests: VideoRequest[]): GroupedRequests => {
  const userRequests: GroupedRequests = {}

  requests.forEach(({ url, videoId, userId, title }) => {
    if (!userId || !videoId) return
    if (!userRequests[userId]) {
      userRequests[userId] = {}
    }

    const videoKey = String(videoId)

    if (!userRequests[userId][videoKey]) {
      userRequests[userId][videoKey] = { title, requestCount: 1 }
    } else {
      userRequests[userId][videoKey].requestCount++
    }
  })

  return userRequests
}

import fs from 'fs'
import { client } from '..'
import { PATH, TEXT_CHANNELS } from '../constants'
import { Message, TextChannel } from 'discord.js'
import { extractYouTubeIdFromUrl } from './youtubeHelpers/youtubeFormatterHelpers'

export const createJsonForUser = (userId: string, data: any) => {
  const filePath = `${PATH.MUSIC_BOT_HISTORY}/${userId}.json`
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`JSON file created for user: ${userId} at ${filePath}`)
}

const createJsonForAllUsers = (groupedRequests: GroupedRequests) => {
  Object.keys(groupedRequests).forEach((userId) => {
    const userData = groupedRequests[userId]
    createJsonForUser(userId, userData)
  })
}
