import { ChatInputCommandInteraction, EmbedBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { ClientWithCommands } from '../../ClientWithCommands'

export default {
  data: new SlashCommandBuilder()
    .setName('clearqueue')
    .setDescription('Clears audio queue')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as ClientWithCommands
    try {
      await client.musicPlayer?.clearQueue()

      const queueEmbed = new EmbedBuilder().setDescription('Queue has been cleared')
      await interaction.reply({ embeds: [queueEmbed] })
    } catch (err) {
      console.error(err)
    }
  },
}
