import axios from 'axios'
import https from 'https'
import dotenv from 'dotenv'
import { getMessageHistory, client as groqClient, saveConversation } from '../../groq/groq'
import { playTTSAudio } from '../../commands/utility/tts'
import { chunkifyText, cleanMarkdown, getCharacterCount, sanitizeInputText } from '../formatterHelpers'
import { BOT_USER_ID, TEXT_CHANNELS } from '../../constants'
import { client } from '../..'
import { TextChannel } from 'discord.js'
import { createGroqEmbed, createRawEmbed } from '../embedHelpers'
import { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions'

dotenv.config()

export type GroqIntent = {
  intent: string
  original_query: string
  count: string
}

// const AGENT_MODEL = 'llama-3.1-8b-instant'
const AGENT_MODEL = 'gemma2-9b-it'

export const analyzeIntent = async (query: string): Promise<GroqIntent> => {
  try {
    // Jank fix for the word "cue" being used in the query
    query = query.replace(/\bcue\b/g, 'queue')

    let botContext = getMessageHistory(BOT_USER_ID)
    const messageHistory: ChatCompletionMessageParam[] = []
    messageHistory.push({ role: 'user', content: sanitizeInputText(query) })

    // Handle the API call to groqClient with proper error handling
    let chatCompletion
    try {
      chatCompletion = await groqClient.chat.completions.create({
        model: AGENT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a music player assistant. Only respond with a JSON object formatted as:
            {
              "intent": "intent",
              "original_query": ${query},
              "count": "count"
            }
            
            Valid intents: 'play', 'play_after', 'play_next', 'queue', 'stop', 'unpause', 'skip', 'cancel', 'roulette', 'question', 'elaborate', 'unknown'.
            
            Rules:
            - If the input is a single word and matches an intent, set the intent to match.
            - If the first word matches an intent, remove the first word from 'original_query'
            - If the input includes phrases like "some music", "anything", "whatever", "random song", or similar, and does not specify a particular artist, genre, or track, set the intent to roulette.
            - Prioritize this rule over matching "play" as an intent.
            - If the input contains multiple uses of "cancel" or "nevermind", set intent to cancel.
            - If the input starts with a question word (who, what, when, where, why, how, which, whose, whom), set intent to question.
            - If the input says "play after this" or "play this after", use intent play_after.
            - If the user to play some music (e.g. "some music", "surprise me", "play anything") and does not appear to be specific, set intent to roulette.
            - If the query mentions a number (like "5 random songs"), extract it as count. If not, set count to 1.
            - If both "play" and "queue" are mentioned, prioritize queue over play, unless play_after matched earlier.
            - Always ensure "original_query" is a string, even if empty.
            - "count" should be an empty string unless specified by the user (e.g., "play 3 songs").
            - If the user asks for "a couple", "a few", "some" or "random songs" (plural), set count to 5.
            
            Example Queries:
            - "Play some jazz" → intent: play
            - "Queue up Taylor Swift" → intent: queue
            - "Play Bohemian Rhapsody next" → intent: play_next
            - "Play me a random song" → intent: roulette
            - "Give me 3 random songs" → intent: roulette
            - "Queue up 3 random songs" → intent: roulette
            - "Skip this song" → intent: skip
            
            Do NOT respond with anything except the raw JSON. No formatting, no explanation.`,
          },
          ...messageHistory,
        ],
      })
    } catch (err: any) {
      console.error('Error during the API call to groqClient:', err)
      throw new Error('Failed to process the query with groqClient.')
    }

    // Validate and sanitize the response
    const groqResponse = chatCompletion?.choices[0]?.message.content?.replace(/<think>.*?<\/think>/gs, '')

    if (!groqResponse) {
      throw new Error('Invalid or empty response from groqClient.')
    }

    let parsedResponse: GroqIntent
    try {
      parsedResponse = JSON.parse(groqResponse)
    } catch (parseError) {
      console.error('Error parsing response JSON:', parseError)
      throw new Error('Failed to parse the response from groqClient.')
    }

    // Optional: Save successful intents to message history
    messageHistory.push({
      role: 'assistant',
      content: groqResponse,
    })

    botContext = [...botContext, ...messageHistory]

    // saveConversation(BOT_USER_ID, botContext)
    return parsedResponse
  } catch (error) {
    throw error
  }
}

export const masterVoiceAgent = async (query: string, intent: string, userId: string) => {
  const botContext = getMessageHistory(BOT_USER_ID)
  botContext.push({ role: 'user', content: sanitizeInputText(query) })

  let detailedResponse = ''
  let colloquialResponse = ''

  try {
    // Call to external service to get a detailed response
    if (intent !== 'elaborate') {
      try {
        detailedResponse = await perplexicaWebSearchAgent(query)
        const groqOutputChannel = (await client.channels.fetch(TEXT_CHANNELS.GROQ_OUTPUT)) as TextChannel
        await sendEmbeddedGroqOutputToChannel({
          textChannel: groqOutputChannel,
          query,
          response: detailedResponse,
          userId,
        })
      } catch (error) {
        console.error('Error in perplexicaWebSearchAgent:', error)
        throw new Error('Failed to get a detailed response from perplexicaWebSearchAgent.')
      }
    }
    // Call to colloquial agent to transform detailed response
    try {
      const originalQuery = query
      colloquialResponse = await colloquialAgent(originalQuery, detailedResponse)
    } catch (error) {
      console.error('Error in colloquialAgent:', error)
      throw new Error('Failed to transform detailed response to colloquial.')
    }

    let content = ''
    if (detailedResponse) {
      content += `detailed response: ${detailedResponse}\n\n`
    }
    if (colloquialResponse) {
      content += `colloquial response: ${colloquialResponse}`

      botContext.push({
        role: 'assistant',
        content,
      })
      // Save the conversation to history
      saveConversation(BOT_USER_ID, botContext)

      // Play TTS audio for colloquial response
      try {
        await playTTSAudio(colloquialResponse)
      } catch (audioError) {
        console.error('Error in playTTSAudio:', audioError)
      }
    } else {
      // Fallback if colloquial response is empty
      await playTTSAudio('Sorry, I could not find an answer to your question. Woof.')
    }
  } catch (err: any) {
    console.error('Error in masterVoiceAgent:', err)
    // Handle any other unforeseen errors
    await playTTSAudio('Sorry, something went wrong while processing your request.')
  }
}

export const perplexicaWebSearchAgent = async (query: any, optimizationMode: 'speed' | 'balanced' = 'speed') => {
  console.log('🔍🌎 Performing web search with Perplexica:', query)

  const agent = new https.Agent({
    rejectUnauthorized: false, // Ignore SSL errors
  })

  const config = {
    httpsAgent: agent,
    timeout: 5 * 1000, // 5 seconds timeout
    chatModel: {
      provider: 'groq',
      name: AGENT_MODEL,
    },
    optimizationMode,
    focusMode: 'webSearch',
    query: query,
    systemInstructions: `
    You are a culturally aware AI assistant, highly familiar with memes, slang, and pop culture references across the internet. 
    If the user input contains typos, spelling errors, or misheard transcriptions, do not ask for clarification.
    Instead, intelligently infer and proceed with the most likely intended query based on context, cultural knowledge, and common usage.
    Prioritize user intent over literal input.
    `,
    stream: false,
  }

  try {
    // Send POST request to the Perplexica API
    const searchResults = await axios.post(`${process.env.PERPLEXICA_API}/api/search`, config)

    // Validate the response
    if (!searchResults || !searchResults.data || !searchResults.data.message) {
      throw new Error('Invalid response from Perplexica API.')
    }

    // Clean and format the message
    const formattedMessage = cleanMarkdown(searchResults.data.message)
    console.log('Perplexica response: \n')
    console.log(formattedMessage)
    return formattedMessage
  } catch (err: any) {
    // Handle different types of errors (network, response, timeout)
    if (err.code === 'ECONNABORTED') {
      console.error('Error: The request to Perplexica API timed out.')
    } else if (err.response) {
      // If the error is from the server (e.g., status 500)
      console.error('Error in Perplexica API response:', err.response.data || err.response.status)
    } else if (err.request) {
      // If no response was received from the server
      console.error('Error: No response received from Perplexica API:', err.request)
    } else {
      // General error handling
      console.error('An unknown error occurred while calling Perplexica API:', err.message)
    }

    // Fallback: Return a default or empty response in case of failure
    return 'Sorry, I couldn’t fetch the search results at the moment. Please try again later.'
  }
}

export const colloquialAgent = async (originalQuery: string, detailedResponse: string) => {
  let colloquialResponse = ''

  let botContext = getMessageHistory(BOT_USER_ID)
  botContext.push({ role: 'user', content: sanitizeInputText(originalQuery) })

  try {
    const chatCompletion = await groqClient.chat.completions.create({
      model: AGENT_MODEL,
      messages: [
        {
          role: 'system',
          content: `
          No matter what, do not say "colloquial response: " or "detailed response: "
          The user does not have knowledge of the input you are provided with
${detailedResponse && `give an answer to the user based on this information: ${detailedResponse}`}
You are an AI that takes the result from a web searching agent and processes it for a user.
Respond as though you are a human, not an AI.
Give more detail if the user asks for it directly (e.g., "tell me more," "go in-depth," "give details", "give a detailed answer").
Use informal language and avoid technical terms unless necessary.
If unsure or unable to find relevant info, respond bluntly and concisely. Keep it direct with no extra explanations.
Example response: "I'm not sure what that is"
Do not give your opinion on the topic
Don't add your own conclusion to the repsonse
Do not start your response with "I think" or "I believe"
Sparsely add woof to the end of your responses
`,
        },
        ...botContext,
      ],
    })

    // Validate response format
    if (chatCompletion && chatCompletion.choices && chatCompletion.choices[0]?.message?.content) {
      // Clean the response (remove unnecessary tags)
      colloquialResponse = chatCompletion.choices[0].message.content.replace(/<think>.*?<\/think>/gs, '')
    } else {
      console.error('Invalid response structure from Groq API:', chatCompletion)
      colloquialResponse = 'Sorry, I couldn’t process your request at the moment.'
    }
  } catch (err: any) {
    console.error('Error in colloquialAgent:', err)

    // Fallback response in case of error
    colloquialResponse = 'Sorry, I couldn’t process your request at the moment.'
  }

  // Return the processed response or fallback message
  console.log(
    '-------------------------------------------------------------------------------------------------------------------\n-------------------------------------------------------------------------------------------------------------------\n'
  )
  return colloquialResponse
}

export const sendEmbeddedGroqOutputToChannel = async ({
  textChannel,
  query,
  response,
  userId,
}: {
  textChannel: TextChannel
  query: string
  response: string
  userId: string
}) => {
  if (getCharacterCount(response) <= 4096) {
    await textChannel.send(
      createGroqEmbed({
        query,
        userId,
        response,
      })
    )
  } else {
    await textChannel.send(
      createGroqEmbed({
        query,
        userId,
        response: '',
      })
    )

    const chunkedResponse = chunkifyText(response).map((chunk: string) => createRawEmbed(chunk))

    for (let chunk of chunkedResponse) {
      await textChannel.send({
        embeds: [chunk],
      })
    }
  }
}
