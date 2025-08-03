import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js'
import { client } from '../..'

export default {
  data: new SlashCommandBuilder()
    .setName('clearqueue')
    .setDescription('Clears audio queue')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: ChatInputCommandInteraction) {
    const session = client.guildSessions.get(interaction.guildId)
    try {
      const queueWasCleared = await session.musicPlayer?.clearQueue()

      let queueEmbed = new EmbedBuilder().setColor(0xffa200)
      if (queueWasCleared) {
        queueEmbed.setDescription('The queue has been cleared')
        await interaction.reply({ embeds: [queueEmbed] })
      } else {
        queueEmbed.setDescription('Nothing in queue')
        await interaction.reply({ embeds: [queueEmbed], flags: MessageFlags.Ephemeral })
      }
    } catch (err) {
      console.error(err)
    }
  },
}
