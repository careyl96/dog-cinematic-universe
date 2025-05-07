import { Events, TextChannel } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { BOT_USER_ID, TEXT_CHANNELS } from '../constants'
import { createOrUpdateSongBlacklist, createOrUpdateUsersLikedMusic } from '../helpers/musicDataHelpers'
import { getVideoDataFromMessage, NowPlayingEmbedState } from '../helpers/embedHelpers'
import { formatDuration, FormattedYoutubeVideo } from '../helpers/youtubeHelpers/youtubeFormatterHelpers'
import { removeFromQueue } from '../helpers/playerFunctions'

// Raw instead of MessageReactionAdd/Remove because it doesn't work for cached messages
export default {
  name: Events.Raw,
  once: false,
  async execute(client: ClientWithCommands, packet: any) {
    if (
      packet.d.user_id === BOT_USER_ID ||
      packet.d.channel_id !== TEXT_CHANNELS.MUSIC_BOT ||
      (packet.t !== 'MESSAGE_REACTION_ADD' && packet.t !== 'MESSAGE_REACTION_REMOVE')
    )
      return

    const musicBotChannel = client.channels.cache.get(TEXT_CHANNELS.MUSIC_BOT) as TextChannel
    const message = await musicBotChannel.messages.fetch(packet.d.message_id)

    const userId = packet.d.user_id

    const videoData: FormattedYoutubeVideo = getVideoDataFromMessage(message)
    if (!videoData) return
    videoData.duration = formatDuration(videoData.duration)

    const playerState: NowPlayingEmbedState = client.musicPlayer.nowPlayingEmbedInfo.state
    if (packet.t === 'MESSAGE_REACTION_ADD') {
      if (packet.d.emoji.name === '❤️') {
        createOrUpdateUsersLikedMusic(userId, { [videoData.id]: videoData })
      }
      if (packet.d.emoji.name === '🚫') {
        const currentlyPlaying = client.musicPlayer.currentlyPlaying?.video
        if (videoData.title === currentlyPlaying?.title) {
          if (playerState === 'playing' || playerState === 'paused' || playerState === 'loading') {
            client.musicPlayer.skip(userId)
          }
        }
        createOrUpdateSongBlacklist(videoData.id)
      }
      if (packet.d.emoji.name === '⏭️') {
        if (playerState === 'playing' || playerState === 'paused' || playerState === 'loading') {
          client.musicPlayer.skip(userId)
        }
      }
      if (packet.d.emoji.name === '🔁') {
        const currentlyPlaying = client.musicPlayer.currentlyPlaying?.video
        if (videoData.title === currentlyPlaying?.title) {
          client.musicPlayer.forcePlay({ query: videoData.url, userId, overrideCurrentEmbed: true })
        } else {
          client.musicPlayer.enqueue({
            videosToQueue: videoData,
            userId: userId,
            saveHistory: false,
            queueInPosition: 0,
          })
        }
      }
    }

    if (packet.t === 'MESSAGE_REACTION_REMOVE') {
      if (packet.d.emoji.name === '❤️') {
        createOrUpdateUsersLikedMusic(userId, videoData.id)
      }
      if (packet.d.emoji.name === '🚫') {
        createOrUpdateSongBlacklist(videoData.id, true)
      }
      if (packet.d.emoji.name === '🔁') {
        removeFromQueue({ videoId: videoData.id })
      }
    }
  },
}
