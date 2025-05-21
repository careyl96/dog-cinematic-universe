import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { play } from '../../helpers/playerFunctions'

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Queues/plays something from youtube')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option.setName('query').setDescription('YouTube link or search query').setRequired(true)
    )
    .addBooleanOption((option) => option.setName('force').setDescription('Skip current song').setRequired(false)),
  async execute(interaction: any) {
    const user = await interaction.guild!.members.fetch(interaction.user.id)
    const query = interaction.options.getString('query')!
    const force = interaction.options.getBoolean('force') ?? false

    await play({
      user,
      query,
      force,
      saveToHistory: true,
      interaction,
    })
  },
}
