import { ChatInputCommandInteraction, EmbedBuilder, InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { client } from '../..'

export default {
  data: new SlashCommandBuilder()
    .setName('clearqueue')
    .setDescription('Clears audio queue')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: ChatInputCommandInteraction) {
    const session = client.guildSessions.get(interaction.guildId)
    try {
      await session.musicPlayer?.clearQueue()

      const queueEmbed = new EmbedBuilder().setDescription('Queue has been cleared')
      await interaction.reply({ embeds: [queueEmbed] })
    } catch (err) {
      console.error(err)
    }
  },
}
