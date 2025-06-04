import { Events, VoiceState, VoiceChannel } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { getCurrentTimestamp } from '../helpers/formatterHelpers'
import { BOT_USER_ID } from '../constants'

export default {
  name: Events.VoiceStateUpdate,
  once: false,
  async execute(client: ClientWithCommands, oldVoiceState: VoiceState, newVoiceState: VoiceState) {
    const member = newVoiceState.member ?? oldVoiceState.member
    const username = member?.user?.tag ?? 'Unknown User'

    const oldChannel = oldVoiceState.channel
    const newChannel = newVoiceState.channel

    // If user did not change channels and the bot is already connected, ignore
    if (oldVoiceState.channelId === newVoiceState.channelId && !!client.connection) return

    const someoneJoinedTheChannel = !oldChannel && !!newChannel
    const someoneLeftTheChannel = !!oldChannel && !newChannel
    const someoneMovedToANewChannel = oldChannel?.id !== newChannel?.id

    // Log user voice activity with timestamps
    if (someoneJoinedTheChannel) {
      console.log(`[${getCurrentTimestamp()}] ✅ ${username} joined "${newChannel?.name}"`)
    } else if (someoneLeftTheChannel) {
      if (!member.user.bot) console.log(`[${getCurrentTimestamp()}] ❌ ${username} disconnected`)
    } else if (someoneMovedToANewChannel) {
      console.log(`[${getCurrentTimestamp()}] 👉 ${username} moved from "${oldChannel?.name}" to "${newChannel?.name}"`)
    }
  },
}
