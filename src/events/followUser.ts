import { Events, VoiceState, VoiceChannel } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { getCurrentTimestamp } from '../helpers/formatterHelpers'
import { BOT_USER_ID } from '../constants'

export default {
  name: Events.VoiceStateUpdate,
  once: false,
  async execute(client: ClientWithCommands, oldVoiceState: VoiceState, newVoiceState: VoiceState) {
    client.listenForVoiceCommands()
    if (newVoiceState.member?.user.bot) return

    // ignore any event that is not a user moving
    if (oldVoiceState.channelId === newVoiceState.channelId) return

    if (newVoiceState.channelId) {
      if (client.voiceChannel?.id === newVoiceState.channelId) {
        const channel = await client.channels.fetch(newVoiceState.channelId)
        const members = (channel as VoiceChannel)?.members
        if (members && members.size === 2) {
          await client.musicPlayer?.unpause()
        }
      } else {
        await client.joinVoiceChannel(newVoiceState.channelId)
      }
    }

    const someoneLeftTheChannel = !!oldVoiceState.channel && !newVoiceState.channel
    const member = newVoiceState.member ?? oldVoiceState.member
    if (someoneLeftTheChannel && member.user.id !== BOT_USER_ID) {
      const channel = await client.channels.fetch(oldVoiceState.channelId)
      const members = (channel as VoiceChannel)?.members

      if (members && members.size === 1) {
        await client.migrateToMostPopulatedVoiceChannelOrDisconnect()
        return
      }
    }
  },
}
