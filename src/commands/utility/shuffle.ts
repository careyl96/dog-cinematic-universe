import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { shuffleQueue } from '../../helpers/playerFunctions'

export default {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffles the queue')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: any) {
    await shuffleQueue(interaction.user.id)
  },
}
