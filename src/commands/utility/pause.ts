import { ChatInputCommandInteraction, InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { stop } from '../../helpers/playerFunctions'

export default {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Pauses audio player')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await stop()
    } catch (err) {
      throw err
    }
  },
}
