import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { createErrorEmbed } from '../../helpers/embedHelpers'
import { client } from '../..'
import { removeFromQueue } from '../../helpers/playerFunctions'
import { trackCtrl } from '../../backend/controllers/Controllers'

export default {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Blacklist a song')
    .addIntegerOption((option) =>
      option
        .setName('queueitem')
        .setMaxValue(10)
        .setDescription('Item in queue to blacklist (0 = current track)')
        .setRequired(true)
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction: any) {
    const session = client.guildSessions.get(interaction.guildId)
    const userId = interaction.user.id
    const queueItemIndex = interaction.options.getInteger('queueitem') || 0

    try {
      const currentlyPlaying = session.musicPlayer.currentlyPlaying
      const queue = session.musicPlayer.queue
      if (currentlyPlaying) queue.unshift(currentlyPlaying)

      const itemToBlacklist = queue[queueItemIndex].video

      if (queueItemIndex === 0) {
        session.musicPlayer.skip(userId)
      } else {
        removeFromQueue({ session, videoId: itemToBlacklist.id })
      }
      const blacklistedItem = await trackCtrl.blacklistById(itemToBlacklist.id)
      console.log(blacklistedItem)

      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle('Blacklisted item:').setDescription(`- ${itemToBlacklist.title}`)],
        flags: MessageFlags.Ephemeral,
      })
    } catch (err) {
      console.error('Error reading or parsing existing blacklisted_music.json:', err)
      interaction.reply(
        createErrorEmbed({
          errorMessage: 'Error blacklisting item',
          flags: MessageFlags.Ephemeral,
        }) as any
      )
    }
  },
}
