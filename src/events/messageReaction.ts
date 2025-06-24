import { Events } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { BOT_USER_ID, TEXT_CHANNELS } from '../constants'
import { extractVideoDataFromMessage, NowPlayingEmbedState } from '../helpers/embedHelpers'
import { removeFromQueue } from '../helpers/playerFunctions'
import { playlistCtrl, trackCtrl } from '../backend/controllers/Controllers'
import { GuildSession } from '../GuildSession'

// UNUSED AS OF 5/21/2025
// Raw instead of MessageReactionAdd/Remove because it doesn't work for cached messages
// Handle embed music controls (message reactions)
export default {
  name: Events.Raw,
  once: false,
  async execute(client: ClientWithCommands, session: GuildSession, packet: any) {
    if (
      packet.d.user_id === BOT_USER_ID ||
      packet.d.channel_id !== TEXT_CHANNELS.MUSIC_BOT ||
      (packet.t !== 'MESSAGE_REACTION_ADD' && packet.t !== 'MESSAGE_REACTION_REMOVE')
    )
      return
    const userId = packet.d.user_id
    const guildId = packet.d.guild_id

    const { musicPlayer } = session
    const message = await session.musicBotTextChannel.messages.fetch(packet.d.message_id)

    const videoData: Track = extractVideoDataFromMessage(message)
    if (!videoData) return

    const playerState: NowPlayingEmbedState = musicPlayer.embedManager.embedState
    if (packet.t === 'MESSAGE_REACTION_ADD') {
      if (packet.d.emoji.name === '❤️') {
        const newFavorite = await playlistCtrl.addFavorite(userId, videoData.id)
        console.log('Favorited track:', newFavorite)
        return
      }
      if (packet.d.emoji.name === '🚫') {
        const currentlyPlaying = musicPlayer.embedManager.track
        if (videoData.title === currentlyPlaying?.title) {
          if (
            playerState === NowPlayingEmbedState.Playing ||
            playerState === NowPlayingEmbedState.Paused ||
            playerState === NowPlayingEmbedState.Loading
          ) {
            musicPlayer.skip(userId)
          }
        }
        const blacklistedTrack = await trackCtrl.blacklistById(videoData.id)
        console.log('Blacklisted tracK: ', blacklistedTrack)
        return
      }
      if (packet.d.emoji.name === '⏭️') {
        if (
          playerState === NowPlayingEmbedState.Playing ||
          playerState === NowPlayingEmbedState.Paused ||
          playerState === NowPlayingEmbedState.Loading
        ) {
          musicPlayer.skip(userId)
        }
        return
      }
      if (packet.d.emoji.name === '🔁') {
        const currentlyPlaying = musicPlayer.embedManager.track
        if (videoData.title === currentlyPlaying?.title) {
          musicPlayer.forcePlay({
            query: videoData.url,
            userId,
            overrideCurrentEmbed: true,
          })

          const replayReaction = musicPlayer.embedManager.message.reactions.cache.get('🔁')
          if (replayReaction) {
            replayReaction.users.cache.forEach((user) => {
              if (user.id !== BOT_USER_ID) {
                replayReaction.users.remove(user.id).catch(console.error)
              }
            })
          }
          const skipReaction = musicPlayer.embedManager.message.reactions.cache.get('⏭️')
          if (skipReaction) {
            skipReaction.users.cache.forEach((user) => {
              if (user.id !== BOT_USER_ID) {
                skipReaction.users.remove(user.id).catch(console.error)
              }
            })
          }
        } else {
          musicPlayer.enqueue({
            videosToQueue: videoData,
            userId,
            queueInPosition: 0,
          })
        }
        return
      }
    }

    if (packet.t === 'MESSAGE_REACTION_REMOVE') {
      if (packet.d.emoji.name === '❤️') {
        const removedUserFavorite = await playlistCtrl.removeFavorite(userId, videoData.id)
        console.log('Removed user favorite:', removedUserFavorite)
        return
      }
      if (packet.d.emoji.name === '🚫') {
        const unBlacklistedTrack = await trackCtrl.unBlacklistById(videoData.id)
        console.log('Unblacklisted track: ', unBlacklistedTrack)
        return
      }
      if (packet.d.emoji.name === '🔁') {
        removeFromQueue({ session, videoId: videoData.id })
        return
      }
    }
  },
}
