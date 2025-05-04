import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { skip } from '../../helpers/playerFunctions'

export default {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skips track')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: any) {
    await skip(interaction.user.id)
  },
}
