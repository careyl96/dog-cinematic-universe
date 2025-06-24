import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { shuffleQueue } from '../../helpers/playerFunctions'
import { client } from '../..'

export default {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffles the queue')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: any) {
    const session = client.guildSessions.get(interaction.guildId)
    await shuffleQueue(session, interaction.user.id)
  },
}
