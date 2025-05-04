import { InteractionContextType, SlashCommandBuilder } from 'discord.js'

export default {
  data: new SlashCommandBuilder()
    .setName('enablevoicecommands')
    .setDescription('Enables voice commands')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: any) {
    interaction.client.setVoiceCommands(true)

    await interaction.reply({
      content: 'Voice commands enabled!',
    })
  },
}
