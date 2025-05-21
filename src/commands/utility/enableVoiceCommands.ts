import { InteractionContextType, SlashCommandBuilder } from 'discord.js'

export default {
  data: new SlashCommandBuilder()
    .setName('enablevoicecommands')
    .setDescription('Enables voice commands')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: any) {
    await interaction.client.setVoiceCommands(true)
  },
}
