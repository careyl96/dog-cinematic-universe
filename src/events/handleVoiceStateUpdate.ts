import { Events, VoiceState, VoiceChannel } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { BOT_USER_ID } from '../constants'
import { AudioPlayerStatus } from '@discordjs/voice'
import { getCurrentTimestamp } from '../helpers/formatterHelpers'
import { GuildSession } from '../GuildSession'
import { client } from '..'

export default {
  name: Events.VoiceStateUpdate,
  once: false,
  async execute(
    client: ClientWithCommands,
    session: GuildSession,
    oldVoiceState: VoiceState,
    newVoiceState: VoiceState
  ) {
    const member = newVoiceState.member ?? oldVoiceState.member
    const username = member?.user?.tag ?? 'Unknown User'

    // Ignore non-movement events
    if (oldVoiceState.channelId === newVoiceState.channelId) return

    const movedUserId = oldVoiceState.member?.user.id ?? newVoiceState.member?.user.id
    const isBot = movedUserId === BOT_USER_ID

    const someoneJoinedTheChannel = !oldVoiceState.channel && !!newVoiceState.channel
    const someoneLeftTheChannel = !!oldVoiceState.channel && !newVoiceState.channel
    const someoneMovedToANewChannel =
      !!oldVoiceState.channelId && !!newVoiceState.channelId && oldVoiceState.channelId !== newVoiceState.channelId

    // Fetch new channel only if channelId is valid
    const oldChannel: VoiceChannel = await fetchVoiceChannel(oldVoiceState.channelId)
    const newChannel: VoiceChannel = await fetchVoiceChannel(newVoiceState.channelId)

    if (someoneJoinedTheChannel) {
      if (!newChannel) return
      const members = newChannel.members

      // Auto-join bot if user is alone in channel, bot not connected, and music player paused
      if (
        members.size === 1 &&
        !session.connection &&
        session.musicPlayer?.player.state.status === AudioPlayerStatus.Paused
      ) {
        await session.joinVoiceChannel(newChannel.id)
        await session.musicPlayer.unpause()
        return
      }

      // If user joins a voice channel where bot is already connected and is paused, unpause
      const isBotInChannel = members.some((m) => m.user.id === BOT_USER_ID)
      if (session.voiceChannel?.id === newChannel.id && members.size === 2 && isBotInChannel) {
        await session.musicPlayer?.unpause()
        return
      }
    }

    if (someoneMovedToANewChannel) {
      if (isBot) {
        if (!newChannel) return
        await session.joinVoiceChannel(newChannel.id)

        const members = newChannel?.members
        const nonBotMembers = members.filter((m) => !m.user.bot)

        const isPaused = session.musicPlayer?.player.state.status === AudioPlayerStatus.Paused

        // 🔇 Pause if bot moved into an empty channel
        if (nonBotMembers.size === 0) {
          await session.musicPlayer.pause()
          return
        }

        // ▶️ Unpause if bot moved and was previously paused
        if (nonBotMembers.size > 0 && isPaused) {
          await session.musicPlayer.unpause()
          return
        }
      } else {
        if (!oldChannel) return
        const oldMembers = oldChannel.members
        const oldNonBotMembers = oldMembers.filter((m) => !m.user.bot)

        if (oldMembers.has(BOT_USER_ID) && oldNonBotMembers.size === 0) {
          await session.musicPlayer.pause()
        }

        if (!newChannel) return
        const newMembers = newChannel.members
        const newNonBotMembers = newMembers.filter((m) => !m.user.bot)

        if (newMembers.has(BOT_USER_ID) && newNonBotMembers.size === 1) {
          await session.musicPlayer.unpause()
          return
        }
      }
    }

    if (someoneLeftTheChannel && !isBot) {
      if (!oldChannel) return
      const members = oldChannel.members
      if (members.size === 1) {
        await session.musicPlayer.pause()
        await session.migrateToMostPopulatedVoiceChannelOrDisconnect()
      }
    }

    // -------------------- LOGGING --------------------

    if (someoneJoinedTheChannel) {
      console.log(`[${getCurrentTimestamp()}] ✅ ${username} joined "${newVoiceState.channel?.name}"`)
    } else if (someoneLeftTheChannel) {
      if (!member.user.bot) console.log(`[${getCurrentTimestamp()}] ❌ ${username} disconnected`)
    } else if (someoneMovedToANewChannel) {
      console.log(
        `[${getCurrentTimestamp()}] 👉 ${username} moved from "${oldVoiceState.channel?.name}" to "${newVoiceState.channel?.name}"`
      )
    }
  },
}

async function fetchVoiceChannel(channelId: string) {
  if (!channelId) return null
  try {
    const channel = await client.channels.fetch(channelId)
    return channel instanceof VoiceChannel ? channel : null
  } catch {
    return null
  }
}
