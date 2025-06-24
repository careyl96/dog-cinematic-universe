import { ChatInputCommandInteraction, InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { stop } from '../../helpers/playerFunctions'
import { client } from '../..'

export default {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pauses audio player')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: ChatInputCommandInteraction) {
    const session = client.guildSessions.get(interaction.guildId)
    await stop(session)
  },
}
