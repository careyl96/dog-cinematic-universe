import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { createChatCompletion } from '../../groq/groq'
import { createGroqEmbed, createRawEmbed } from '../../helpers/embeds'
import { chunkifyText, getCharacterCount } from '../../helpers/formatterHelpers'

export default {
  data: new SlashCommandBuilder()
    .setName('groq')
    .setDescription('ChatGPT but not')
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Ask me a question')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('model')
        .setDescription('Choose a language model (default: qwen-qwq-32b)')
        .addChoices([
          { name: 'qwen-qwq-32b', value: 'qwen-qwq-32b' },
          { name: 'qwen-2.5-coder-32b', value: 'qwen-2.5-coder-32b' },
          { name: 'llama3-70b-8192', value: 'llama3-70b-8192' },
          {
            name: 'deepseek-r1-distill-llama-70b',
            value: 'deepseek-r1-distill-llama-70b',
          },
        ])
        .setRequired(false)
    ),
  async execute(interaction: any) {
    const query = interaction.options.getString('query')!
    const model = interaction.options.getString('model') || 'qwen-qwq-32b'
    const userId = interaction.user.id

    const response =
      (await createChatCompletion({ message: query, model, userId })) ||
      'Error :('

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

      const chunkedResponse = chunkifyText(response).map((chunk: string) =>
        createRawEmbed(chunk)
      )

      for (let chunk of chunkedResponse) {
        await interaction.channel.send({
          embeds: [chunk],
        })
      }
    }
  },
}
