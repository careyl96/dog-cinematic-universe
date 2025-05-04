import { client as groqClient } from '../../../src/groq/groq'
import { playTTSAudio } from '../../commands/utility/tts'
import { createErrorEmbed } from '../embeds'
import Groq from 'groq-sdk'

// called when using voice command
export const askGroq = async (query: string) => {
  const chatCompletion = await groqClient.chat.completions
    .create({
      model: 'qwen-qwq-32b',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant but sparsely throw in the word "woof" in your responses. 
            If a simple question with limited context is asked, respond as succinctly as possible unless asked to elaborate.
            if asked for a choice make one.`,
        },
        {
          role: 'user',
          content: query,
        },
      ],
    })
    .catch(async (err) => {
      if (err instanceof Groq.APIError) {
        createErrorEmbed({
          errorMessage: `
            status: ${err.status} \n
            name: ${err.name}
            `,
        })
        console.error(err.status) // 400
        console.error(err.name) // BadRequestError
        console.error(err.headers) // {server: 'nginx', ...}
      } else {
        throw err
      }
    })

  const groqResponse =
    chatCompletion?.choices[0]?.message.content?.replace(
      /<think>.*?<\/think>/gs,
      ''
    ) || ''

  await playTTSAudio(groqResponse)
}
