import { EmbedBuilder, MessageFlags } from 'discord.js'
import { client } from '..'
import { fetchYoutubeVideosFromUrlOrQuery, FormattedYoutubeVideo } from './youtubeHelpers/youtubeHelpers'
import { AudioPlayerStatus } from '@discordjs/voice'
import { pickRandomItemsFromList } from './otherHelpers'
import { createYoutubeUrlFromId, UncompressedTrack, uncompressTrack } from './youtubeHelpers/youtubeFormatterHelpers'
import { QueueItem } from '../MusicPlayer'
import { trackCtrl } from '../backend/controllers/Controllers'
import { GuildSession } from '../GuildSession'
import { Track } from '../backend/entities/Track'
import { ExtendedTrack } from '../EmbedStateManager'

type PlayOptions = {
  session?: GuildSession
  userId: string
  guildId: string
  query: string
  force?: boolean
  triggeredByBot?: boolean
  queueInPosition?: number
  interaction?: any
}

export const play = async ({
  session,
  userId,
  query,
  force = false,
  triggeredByBot = false,
  queueInPosition,
  interaction,
}: PlayOptions) => {
  try {
    if (!query) return console.log('##### No query provided for play command.')

    if (!session || !session.musicPlayer) {
      interaction && !interaction.replied && interaction.editReply({ content: `Something went wrong!` })
      return
    }

    const isVoiceConnectionEstablished = await session.ensureVoiceConnection(userId)
    if (!isVoiceConnectionEstablished) {
      interaction &&
        !interaction.replied &&
        interaction.editReply({ content: `⚠️ You must join a voice channel first!` })
      return
    }

    const { musicPlayer } = session

    if (force) {
      await musicPlayer.forcePlay({ query, userId, interaction })
    } else {
      if (triggeredByBot && musicPlayer.player.state.status === AudioPlayerStatus.Playing) return
      await musicPlayer.enqueue({ query, userId, queueInPosition, interaction })
    }
  } catch (err) {
    console.error(`Error in play(): ${err}`)
    if (!triggeredByBot && interaction) {
      await interaction.followUp({
        content: 'An error occurred while trying to play music.',
        ephemeral: true,
      })
    }
  }
}

type QueueOptions = {
  session: GuildSession
  userId: string
  query: string | string[]
  interaction?: any
  saveToHistory: boolean
  roulette?: boolean
}

export const queue = async ({ session, userId, query, interaction }: QueueOptions) => {
  try {
    if (!query || !session || !session.musicPlayer) return

    const isVoiceConnectionEstablished = await session.ensureVoiceConnection(userId)
    if (!isVoiceConnectionEstablished) {
      interaction &&
        !interaction.replied &&
        interaction.editReply({ content: `⚠️ You must join a voice channel first!` })
      return
    }

    const videos = []
    const queries = typeof query === 'string' ? [query] : query

    for (const q of queries) {
      const video = await fetchYoutubeVideosFromUrlOrQuery({ session, urlOrQuery: q, interaction })
      if (video && !Array.isArray(video)) videos.push(video)
    }

    await session.musicPlayer.enqueue({
      videosToQueue: videos,
      userId,
      interaction,
    })
  } catch (err) {
    console.error(`Error in queue(): ${err}`)
    if (interaction) {
      await interaction.followUp({
        content: 'An error occurred while queuing videos.',
        ephemeral: true,
      })
    }
  }
}

export const shuffleQueue = async (session: GuildSession) => {
  try {
    if (!session || !session.musicPlayer) return
    await session.musicPlayer.shuffle()
  } catch (err) {
    console.error(`Error in shuffleQueue(): ${err}`)
  }
}

export const removeFromQueue = async ({
  session,
  start = 1,
  end,
  videoId,
  interaction,
}: {
  session: GuildSession
  start?: number
  end?: number
  videoId?: string
  interaction?: any
}) => {
  try {
    if (!session || !session.musicPlayer) return
    const { musicPlayer } = session

    if (videoId) {
      const index = musicPlayer.queue.findIndex((item) => item.video.id === videoId)
      if (index !== -1) musicPlayer.queue.splice(index, 1)
      return interaction?.deleteReply()
    }

    if (!musicPlayer.queue || start < 1 || start > musicPlayer.queue.length) {
      return interaction?.deleteReply()
    }

    const removedItems: QueueItem[] = musicPlayer.queue.splice(start - 1, end ? end - start + 1 : 1)

    if (interaction) {
      const reply = removedItems.map((item) => `- [${item.video.title}](${item.video.url})`).join('\n')
      await interaction.followUp({
        embeds: [new EmbedBuilder().setTitle('Removed items:').setDescription(reply)],
        flags: MessageFlags.Ephemeral,
      })
    }
  } catch (err) {
    console.error(`Error in removeFromQueue(): ${err}`)
    if (interaction) {
      await interaction.followUp({
        content: 'Failed to remove item(s) from the queue.',
        ephemeral: true,
      })
    }
  }
}

export const stop = async (session: GuildSession) => {
  try {
    if (!session || !session.musicPlayer) return
    await session.musicPlayer?.pause()
  } catch (err) {
    console.error(`Error in stop(): ${err}`)
  }
}

export const unpause = async (session: GuildSession) => {
  try {
    if (!session || !session.musicPlayer) return
    await session.musicPlayer.unpause()
  } catch (err) {
    console.error(`Error in unpause(): ${err}`)
  }
}

export const skip = async (session: GuildSession, userId: string) => {
  try {
    if (!session || !session.musicPlayer) return
    await session.musicPlayer.skip(userId)
  } catch (err) {
    console.error(`Error in skip(): ${err}`)
  }
}

export const getRandomVideos = async ({
  count = 1,
}: {
  session: GuildSession
  count?: number
}): Promise<ExtendedTrack[]> => {
  try {
    const allTracks = await trackCtrl.getAllNonBlacklisted()
    const selectedTracks = pickRandomItemsFromList(allTracks, count)

    const results: ExtendedTrack[] = []

    for (const track of selectedTracks) {
      if (track.title && track.duration && track.liveBroadcastContent) {
        results.push(track)
      }
    }

    return results
  } catch (err) {
    console.error(`Error in getRandomVideos(): ${err}`)
    return []
  }
}
