import {
  InteractionContextType,
  SlashCommandBuilder,
} from 'discord.js'
import { playPrev } from '../../helpers/playerFunctions'

export default {
  data: new SlashCommandBuilder()
    .setName('playprev')
    .setDescription('Plays previously played track')
    .setContexts(InteractionContextType.Guild),
  async execute(interaction: any) {
    await playPrev(interaction)
  },
}
