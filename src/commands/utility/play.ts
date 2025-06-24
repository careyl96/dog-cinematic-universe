import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { play } from '../../helpers/playerFunctions'
import { BOT_USER_ID } from '../../constants'
import { client } from '../..'

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Queues/plays something from youtube')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option.setName('query').setDescription('YouTube link or search query').setRequired(true)
    )
    .addBooleanOption((option) => option.setName('force').setDescription('Skip current song').setRequired(false))
    .addBooleanOption((option) => option.setName('stealth').setDescription('sneaky beaky').setRequired(false)),
  async execute(interaction: any) {
    const session = client.guildSessions.get(interaction.guildId)
    const userId = interaction.user.id
    const query = interaction.options.getString('query')!
    const force = interaction.options.getBoolean('force') ?? false
    const stealth = interaction.options.getBoolean('stealth') ?? false

    await play({
      session,
      userId: stealth ? BOT_USER_ID : userId,
      query,
      force,
      saveToHistory: true,
      interaction,
    })
  },
}
