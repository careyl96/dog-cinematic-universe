import {
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js'
import { remove } from '../../helpers/playerFunctions'

export default {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Removes items in queue')
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((option) =>
      option
        .setName('start')
        .setDescription('Item to start removing from (default is last item)')
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('end')
        .setDescription('Last item to remove (optional)')
        .setRequired(false)
    ),

  async execute(interaction: any) {
    const start =
      interaction.options.getInteger('start') ||
      interaction.client.musicPlayer.queue.length
    const end = interaction.options.getInteger('end')
    await remove(start, end, interaction)
  },
}
