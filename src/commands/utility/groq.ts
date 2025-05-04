import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { handleGroqSlashCommand } from '../../groq/groq'
import { createGroqEmbed, createRawEmbed } from '../../helpers/embedHelpers'
import { chunkifyText, getCharacterCount } from '../../helpers/formatterHelpers'
import { BOT_USER_ID } from '../../constants'

export default {
  data: new SlashCommandBuilder()
    .setName('groq')
    .setDescription('ChatGPT but not')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) => option.setName('query').setDescription('Ask me a question').setRequired(true))
    .addStringOption((option) =>
      option
        .setName('model')
        .setDescription('Choose a language model (default: llama-3.3-70b-versatile)')
        .addChoices([
          { name: 'qwen-qwq-32b', value: 'qwen-qwq-32b' },
          { name: 'llama-3.3-70b-versatile', value: 'llama-3.3-70b-versatile' },
          {
            name: 'deepseek-r1-distill-llama-70b',
            value: 'deepseek-r1-distill-llama-70b',
          },
          {
            name: 'deepseek-r1-distill-qwen-32b',
            value: 'deepseek-r1-distill-qwen-32b',
          },
        ])
        .setRequired(false)
    ),
  async execute(interaction: any) {
    const query = interaction.options.getString('query')!
    const model = interaction.options.getString('model') || 'llama-3.3-70b-versatile'
    const userId = interaction.user.id

    const response = (await handleGroqSlashCommand({ message: query, model, userId: BOT_USER_ID })) || 'Error :('

    // chunk response into multiple embeds since each embed can only have 4096 characters
    // https://discordjs.guide/popular-topics/embeds.html#embed-limits

    if (getCharacterCount(query + ' ' + response) <= 4096) {
      await interaction.followUp(
        createGroqEmbed({
          query,
          userId,
          response,
        })
      )
    } else {
      await interaction.followUp(
        createGroqEmbed({
          query,
          userId,
          response: '',
        })
      )

      const chunkedResponse = chunkifyText(response).map((chunk: string) => createRawEmbed(chunk))

      for (let chunk of chunkedResponse) {
        await interaction.channel.send({
          embeds: [chunk],
        })
      }
    }
  },
}
