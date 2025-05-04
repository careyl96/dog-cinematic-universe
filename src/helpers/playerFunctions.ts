import { EmbedBuilder, GuildMember, MessageFlags } from 'discord.js'
import { client } from '..'
import { fetchYoutubeVideoFromUrlOrQuery } from './youtubeHelpers/youtubeHelpers'
import { AudioPlayerStatus } from '@discordjs/voice'
import { TEXT_CHANNELS } from '../constants'
import { fetchMessages, filterAndFormatMessages } from './seedMusicHistory'
import { shuffle } from './formatterHelpers'
import { FormattedYoutubeVideo } from './youtubeHelpers/youtubeFormatterHelpers'

// play music using MusicPlayer
export const play = async (options: {
  user: GuildMember
  query: string
  interaction?: any
  force?: boolean
  triggeredByBot?: boolean
}) => {
  const {
    user,
    query,
    force = false,
    interaction,
    triggeredByBot = false,
  } = options
  try {
    if (!query) return console.log('##### No query provided for play command.')

    // have bot join voice channel of user who called command
    const currentVoiceChannelId = user?.voice.channelId
    await client.joinVoiceChannel(currentVoiceChannelId, interaction)
    if (force) {
      await client.musicPlayer?.forcePlay({
        query,
        userId: user.id,
        interaction,
      })
    } else {
      if (
        triggeredByBot &&
        client.musicPlayer?.player.state.status === 'playing'
      )
        return
      await client.musicPlayer?.play({ query, userId: user.id, interaction })
    }
  } catch (err) {
    if (triggeredByBot) {
      console.error(err)
    } else {
      throw err
    }
  }
}

export const playPrev = async (interaction: any) => {
  await client.musicPlayer?.playPrev(interaction)
}

type QueueOptions = {
  user: GuildMember
  query: string | string[]
  interaction?: any
  saveHistory: boolean
}
export const queue = async ({
  user,
  query,
  saveHistory = true,
}: QueueOptions) => {
  if (!query) return

  try {
    /* -------------------------------------------------------------- */
    // Have the bot join the voice channel of the user who called the command
    const currentVoiceChannelId = user!.voice.channelId
    if (client.voiceChannel?.id !== currentVoiceChannelId) {
      await client.joinVoiceChannel(currentVoiceChannelId)
    }
    /* -------------------------------------------------------------- */

    // Function to handle both single query (string) and multiple queries (currently only using function for passing array of youtube urls)
    const enqueueVideos = async (queries: string | string[]) => {
      if (typeof queries === 'string') {
        queries = [queries]
      }

      const videos = []
      for (const query of queries) {
        const video = (await fetchYoutubeVideoFromUrlOrQuery({
          urlOrQuery: query,
        })) as FormattedYoutubeVideo
        videos.push(video)
      }
      await client.musicPlayer!.enqueue({
        videosToQueue: videos,
        userId: user.id,
        saveHistory,
      })
    }

    await enqueueVideos(query)
  } catch (err) {
    throw err
  }
}
export const remove = async (
  start: number,
  end?: number,
  interaction?: any
) => {
  if (start < 1 || start > client.musicPlayer.queue.length) return

  const removedItems = client.musicPlayer.queue.splice(
    start - 1,
    end ? end - start + 1 : 1
  )

  client.musicPlayer.sendOrUpdateQueueEmbed()

  if (interaction) {
    const reply = end
      ? `${removedItems.map((item) => `- ${item.video.title}`).join('\n')}`
      : `- ${removedItems[0].video.title}`

    await interaction.followUp({
      embeds: [
        new EmbedBuilder().setTitle('Removed items:').setDescription(reply),
      ],
    })
  }
}
export const stop = () => {
  try {
    if (client.player.state.status === AudioPlayerStatus.Playing) {
      client.player.stop()
    } else {
      client.musicPlayer!.pause()
    }
  } catch (err) {
    throw err
  }
}
export const unpause = () => {
  try {
    if (client.player.state.status === AudioPlayerStatus.Paused) {
      client.player.unpause()
    } else {
      client.musicPlayer!.unpause()
    }
  } catch (err) {
    throw err
  }
}
export const skip = (userId: string) => {
  try {
    if (client.player.state.status === AudioPlayerStatus.Playing) {
      client.player.stop()
    } else {
      client.musicPlayer!.skip(userId)
    }
  } catch (err) {
    throw err
  }
}
export const roulette = async (userId: string) => {
  const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID)
  const user = await guild.members.fetch(userId)

  const musicBotChannel = client.channels.cache.get(TEXT_CHANNELS.MUSIC_BOT)
  const messages = await fetchMessages(musicBotChannel, 300)
  let youtubeUrls = filterAndFormatMessages(messages).map(
    (videoInfo) => videoInfo.url
  )
  youtubeUrls = shuffle([...new Set(youtubeUrls)])[0]
  await queue({
    user,
    query: youtubeUrls,
    saveHistory: false,
  })
}
