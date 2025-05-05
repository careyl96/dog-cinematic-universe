import { InteractionContextType, SlashCommandBuilder } from 'discord.js'

export default {
  data: new SlashCommandBuilder()
    .setName('disablevoicecommands')
    .setDescription('Disables voice commands')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: any) {
    await interaction.client.setVoiceCommands(false)
  },
}
