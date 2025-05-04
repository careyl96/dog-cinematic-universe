import { Events, VoiceState, VoiceChannel } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { getCurrentTimestamp } from '../helpers/formatterHelpers'

export default {
  name: Events.VoiceStateUpdate,
  once: false,
  async execute(
    client: ClientWithCommands,
    oldVoiceState: VoiceState,
    newVoiceState: VoiceState
  ) {
    client.listenForVoiceCommands()

    const member = newVoiceState.member || oldVoiceState.member
    const username = member?.user?.tag ?? 'Unknown User'
    const oldChannel = oldVoiceState.channel
    const newChannel = newVoiceState.channel

    // Ignore if user did not change channels and bot is already connected
    if (
      oldVoiceState.channelId === newVoiceState.channelId &&
      !!client.connection
    )
      return

    // Log user voice activity
    if (!oldChannel && newChannel) {
      console.log(`[${getCurrentTimestamp()}] ✅ ${username} joined "${newChannel.name}" ✅`)
    } else if (oldChannel && !newChannel) {
      console.log(`[${getCurrentTimestamp()}] ❌ ${username} disconnected" ❌`)
    } else if (oldChannel?.id !== newChannel?.id) {
      console.log(
        `[${getCurrentTimestamp()}] 👉 ${username} moved from "${oldChannel?.name}" to "${newChannel?.name}"`
      )
    }

    // Handle empty channel after someone leaves
    if (oldVoiceState.channelId && newVoiceState.channelId === null) {
      const channel = await client.channels.fetch(oldVoiceState.channelId)
      const members = (channel as VoiceChannel)?.members

      if (members && members.size === 1) {
        await client.migrateToMostPopulatedVoiceChannelOrDisconnect()
        return
      }
    }

    // Follow user to their new channel
    if (newVoiceState.channelId) {
      await client.joinVoiceChannel(newVoiceState.channelId)
    }
  },
}
