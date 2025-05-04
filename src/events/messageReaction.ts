import { Events, TextChannel } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { BOT_USER_ID, TEXT_CHANNELS } from '../constants'
import { createOrUpdateSongBlacklist, createOrUpdateUsersLikedMusic } from '../helpers/musicDataHelpers'
import { getVideoDataFromMessage } from '../helpers/embedHelpers'

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
    if (message.author.id !== BOT_USER_ID) return

    const userId = packet.d.user_id

    const videoData = getVideoDataFromMessage(message)
    if (!videoData) return

    const playerState = message.embeds[0].data.author.name
    if (packet.t === 'MESSAGE_REACTION_ADD') {
      if (packet.d.emoji.name === '❤️') {
        createOrUpdateUsersLikedMusic(userId, { [videoData.id]: videoData })
      }
      if (packet.d.emoji.name === '🚫') {
        if (playerState === 'Now playing:' || playerState === 'Paused' || playerState === 'Loading...') {
          client.musicPlayer.skip(userId)
        }
        createOrUpdateSongBlacklist(videoData.id)
      }
      if (packet.d.emoji.name === '⏭️') {
        if (playerState === 'Now playing:' || playerState === 'Paused' || playerState === 'Loading...') {
          client.musicPlayer.skip(userId)
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
    }
  },
}
