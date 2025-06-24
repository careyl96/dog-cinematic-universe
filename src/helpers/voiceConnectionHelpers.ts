import { ButtonInteraction, CacheType, MessageFlags } from 'discord.js'
import { client } from '..'
import { guildCtrl } from '../backend/controllers/Controllers'
import { GuildSession } from '../GuildSession'

export const getMostPopulatedVoiceChannels = async (
  guildId: string
): Promise<{
  mostUsersChannel: string | null
  mostNonBotUsersChannel: string | null
}> => {
  let channelWithMostUsers: string | null = null
  let channelWithMostUsersExcludingBot: string | null = null
  let maxUsers = 0
  let maxUsersExcludingBot = 0

  const voiceChannelIds = await guildCtrl.getVoiceChannelsByGuildId(guildId)
  for (const channelId of voiceChannelIds) {
    try {
      const voiceChannel = (await client.channels.fetch(channelId)) as any
      if (!voiceChannel) continue

      const users = voiceChannel.members
      const numUsers = users.size
      const nonBotUsers = users.filter((member: any) => !member.user.bot).size

      if (nonBotUsers > maxUsersExcludingBot) {
        maxUsersExcludingBot = nonBotUsers
        channelWithMostUsersExcludingBot = channelId
      }

      if (numUsers > maxUsers) {
        maxUsers = numUsers
        channelWithMostUsers = channelId
      }
    } catch (error) {
      console.error(`Error fetching channel ${channelId}:`, error)
    }
  }

  return {
    mostUsersChannel: channelWithMostUsers,
    mostNonBotUsersChannel: channelWithMostUsersExcludingBot,
  }
}

export const ensureVoiceConnectionOrReply = async (
  interaction: ButtonInteraction<CacheType>,
  session: GuildSession,
  userId: string,
  silent: boolean = false
) => {
  const voiceConnected = session.connection || (await session.ensureVoiceConnection(userId))
  if (!voiceConnected && !silent) {
    interaction.followUp({
      content: `⚠️ You must join a voice channel first!`,
      flags: MessageFlags.Ephemeral,
    })
  }
  return !!voiceConnected
}
