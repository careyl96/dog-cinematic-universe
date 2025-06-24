import { ChatInputCommandInteraction, InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { stop } from '../../helpers/playerFunctions'
import { client } from '../..'

export default {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Pauses audio player')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: ChatInputCommandInteraction) {
    const session = client.guildSessions.get(interaction.guildId)
    try {
      await stop(session)
    } catch (err) {
      throw err
    }
  },
}
