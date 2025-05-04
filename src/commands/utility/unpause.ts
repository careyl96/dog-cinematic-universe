import {
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js'
import { unpause } from '../../helpers/playerFunctions'

export default {
  data: new SlashCommandBuilder()
    .setName('unpause')
    .setDescription('Unpauses audio player')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: any) {
    unpause()
  },
}
