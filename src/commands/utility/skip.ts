import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { skip } from '../../helpers/playerFunctions'
import { client } from '../..'

export default {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skips track')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: any) {
    const session = client.guildSessions.get(interaction.guildId)
    await skip(session, interaction.user.id)
  },
}
