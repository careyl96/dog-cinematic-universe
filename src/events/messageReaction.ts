import { Events, TextChannel } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { BOT_USER_ID, TEXT_CHANNELS } from '../constants'
import { createOrUpdateSongBlacklist, createOrUpdateUsersLikedMusic } from '../helpers/musicDataHelpers'
import { getVideoDataFromMessage, NowPlayingEmbedState } from '../helpers/embedHelpers'
import { FormattedYoutubeVideo } from '../helpers/youtubeHelpers/youtubeFormatterHelpers'
import { removeFromQueue } from '../helpers/playerFunctions'

// Raw instead of MessageReactionAdd/Remove because it doesn't work for cached messages
// Handle embed music controls (message reactions)
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

    const playerState: NowPlayingEmbedState = client.musicPlayer.nowPlayingEmbedInfo.state
    if (packet.t === 'MESSAGE_REACTION_ADD') {
      if (packet.d.emoji.name === '❤️') {
        createOrUpdateUsersLikedMusic(userId, { [videoData.id]: videoData })
        return
      }
      if (packet.d.emoji.name === '🚫') {
        const currentlyPlaying = client.musicPlayer.currentlyPlaying?.video
        if (videoData.title === currentlyPlaying?.title) {
          if (
            playerState === NowPlayingEmbedState.Playing ||
            playerState === NowPlayingEmbedState.Paused ||
            playerState === NowPlayingEmbedState.Loading
          ) {
            client.musicPlayer.skip(userId)
          }
        }
        createOrUpdateSongBlacklist(videoData.id)
        return
      }
      if (packet.d.emoji.name === '⏭️') {
        if (
          playerState === NowPlayingEmbedState.Playing ||
          playerState === NowPlayingEmbedState.Paused ||
          playerState === NowPlayingEmbedState.Loading
        ) {
          client.musicPlayer.skip(userId)
        }
        return
      }
      if (packet.d.emoji.name === '🔁') {
        const currentlyPlaying = client.musicPlayer.currentlyPlaying?.video
        if (videoData.title === currentlyPlaying?.title) {
          client.musicPlayer.forcePlay({
            query: videoData.url,
            userId,
            overrideCurrentEmbed: true,
            saveToHistory: true,
          })

          const replayReaction = client.musicPlayer.nowPlayingEmbedInfo.message.reactions.cache.get('🔁')
          if (replayReaction) {
            replayReaction.users.cache.forEach((user) => {
              if (user.id !== BOT_USER_ID) {
                replayReaction.users.remove(user.id).catch(console.error)
              }
            })
          }
          const skipReaction = client.musicPlayer.nowPlayingEmbedInfo.message.reactions.cache.get('⏭️')
          if (skipReaction) {
            skipReaction.users.cache.forEach((user) => {
              if (user.id !== BOT_USER_ID) {
                skipReaction.users.remove(user.id).catch(console.error)
              }
            })
          }
        } else {
          console.log(videoData)
          client.musicPlayer.enqueue({
            videosToQueue: videoData,
            userId: userId,
            queueInPosition: 0,
            saveToHistory: false,
          })
        }
        return
      }
    }

    if (packet.t === 'MESSAGE_REACTION_REMOVE') {
      if (packet.d.emoji.name === '❤️') {
        createOrUpdateUsersLikedMusic(userId, videoData.id)
        return
      }
      if (packet.d.emoji.name === '🚫') {
        createOrUpdateSongBlacklist(videoData.id, true)
        return
      }
      if (packet.d.emoji.name === '🔁') {
        removeFromQueue({ videoId: videoData.id })
        return
      }
    }
  },
}
