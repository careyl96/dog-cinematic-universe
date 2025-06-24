import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { removeFromQueue } from '../../helpers/playerFunctions'
import { client } from '../..'

export default {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Removes items in queue')
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((option) =>
      option.setName('start').setDescription('Item to start removing from (default is last item)').setRequired(false)
    )
    .addIntegerOption((option) =>
      option.setName('end').setDescription('Last item to remove (optional)').setRequired(false)
    ),

  async execute(interaction: any) {
    const session = client.guildSessions.get(interaction.guildId)
    const start = interaction.options.getInteger('start') || session.musicPlayer.queue.length
    const end = interaction.options.getInteger('end')
    await removeFromQueue({ session, start, end, interaction })
  },
}
