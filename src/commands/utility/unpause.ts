import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { unpause } from '../../helpers/playerFunctions'
import { client } from '../..'

export default {
  data: new SlashCommandBuilder()
    .setName('unpause')
    .setDescription('Unpauses audio player')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: any) {
    const session = client.guildSessions.get(interaction.guildId)
    await unpause(session)
  },
}
