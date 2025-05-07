import fs from 'fs'
import path from 'path'
import { EmbedBuilder, GuildMember } from 'discord.js'
import { client } from '..'
import { fetchYoutubeVideosFromUrlOrQuery } from './youtubeHelpers/youtubeHelpers'
import { AudioPlayerStatus } from '@discordjs/voice'
import { BOT_USER_ID, PATH } from '../constants'
import { getGuildMember } from './otherHelpers'
import { shuffle } from './otherHelpers'
import { createYoutubeUrlFromId, FormattedYoutubeVideo } from './youtubeHelpers/youtubeFormatterHelpers'
import { getUserMusicHistory } from './musicDataHelpers'
import { getRandomKeys } from '../commands/utility/roulette'

// play music using MusicPlayer
export const play = async (options: {
  user: GuildMember
  query: string
  interaction?: any
  force?: boolean
  triggeredByBot?: boolean
  queueInPosition?: number
}) => {
  const { user, query, force = false, interaction, triggeredByBot = false, queueInPosition } = options
  try {
    if (!query) return console.log('##### No query provided for play command.')

    // have bot join voice channel of user who called command
    const isVoiceConnectionEstablished = await client.ensureVoiceConnection(user, interaction)
    if (!isVoiceConnectionEstablished) return

    if (force) {
      await client.musicPlayer?.forcePlay({
        query,
        userId: user.id,
        interaction,
      })
    } else {
      // triggered by bot occurs when hourly music is played
      if (triggeredByBot && client.musicPlayer?.player.state.status === 'playing') return
      await client.musicPlayer?.play({ query, userId: user.id, interaction, queueInPosition })
    }
  } catch (err) {
    if (triggeredByBot) {
      console.error(err)
    } else {
      throw err
    }
  }
}

type QueueOptions = {
  user: GuildMember
  query: string | string[]
  interaction?: any
  saveHistory: boolean
}
export const queue = async ({ user, query, interaction, saveHistory = true }: QueueOptions) => {
  if (!query) return

  try {
    const isVoiceConnectionEstablished = await client.ensureVoiceConnection(user, interaction)
    if (!isVoiceConnectionEstablished) return

    // Function to handle both single query (string) and multiple queries (multiple only compatible with array of youtube urls)
    const enqueueVideos = async (queries: string | string[]) => {
      if (typeof queries === 'string') {
        queries = [queries]
      }

      const videos = []
      for (const query of queries) {
        const video = (await fetchYoutubeVideosFromUrlOrQuery({
          urlOrQuery: query,
          interaction,
        })) as FormattedYoutubeVideo
        if (video) videos.push(video)
      }
      await client.musicPlayer!.enqueue({
        videosToQueue: videos,
        userId: user.id,
        interaction,
        saveHistory,
      })
    }

    await enqueueVideos(query)
  } catch (err) {
    throw err
  }
}

export const shuffleQueue = async (userId: string) => {
  try {
    await client.musicPlayer!.shuffle(userId)
  } catch (err) {
    throw err
  }
}
export const removeFromQueue = async ({
  start = 1,
  end,
  videoId,
  interaction,
}: {
  start?: number
  end?: number
  videoId?: string
  interaction?: any
}) => {
  if (videoId) {
    const index = client.musicPlayer.queue.findIndex((item) => item.video.id === videoId)
    if (index !== -1) {
      client.musicPlayer.queue.splice(index, 1)
    }
    client.musicPlayer.sendOrUpdateQueueEmbed()
    return interaction && interaction.deleteReply()
  }

  if (start < 1 || start > client.musicPlayer.queue.length) {
    return interaction && interaction.deleteReply()
  }

  const removedItems = client.musicPlayer.queue.splice(start - 1, end ? end - start + 1 : 1)

  client.musicPlayer.sendOrUpdateQueueEmbed()

  if (interaction) {
    const reply = end
      ? `${removedItems.map((item) => `- ${item.video.title}`).join('\n')}`
      : `- ${removedItems[0].video.title}`

    await interaction.followUp({
      embeds: [new EmbedBuilder().setTitle('Removed items:').setDescription(reply)],
    })
  }
}
export const stop = async () => {
  try {
    if (client.player.state.status === AudioPlayerStatus.Playing) {
      client.player.stop()
    } else {
      await client.musicPlayer!.pause()
    }
  } catch (err) {
    throw err
  }
}
export const unpause = async () => {
  try {
    if (client.player.state.status === AudioPlayerStatus.Paused) {
      client.player.unpause()
    } else {
      await client.musicPlayer!.unpause()
    }
  } catch (err) {
    throw err
  }
}
export const skip = async (userId: string) => {
  try {
    if (client.player.state.status === AudioPlayerStatus.Playing) {
      client.player.stop()
    } else {
      await client.musicPlayer!.skip(userId)
    }
  } catch (err) {
    throw err
  }
}
export const roulette = async ({
  userId,
  userIdFilter,
  count = 1,
}: {
  userId: string
  userIdFilter?: string
  count: number
}) => {
  const user = await getGuildMember(userId)
  const rawBlacklist = fs.readFileSync(path.join(PATH.USER_DATA, `${BOT_USER_ID}/blacklisted_music.json`), 'utf-8')
  const blacklist = JSON.parse(rawBlacklist)

  const userMusicHistory = getUserMusicHistory(userIdFilter || BOT_USER_ID)
  let youtubeUrls = getRandomKeys(userMusicHistory, count)
    .filter((videoId) => !blacklist.includes(videoId))
    .map((videoId) => userMusicHistory[videoId].url || createYoutubeUrlFromId(videoId))

  youtubeUrls = shuffle([...new Set(youtubeUrls)]).slice(0, Math.min(count, 50))

  await queue({
    user,
    query: youtubeUrls,
    saveHistory: false,
  })
}
