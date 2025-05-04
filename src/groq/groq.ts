import Groq from 'groq-sdk'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import dotenv from 'dotenv'
import { createErrorEmbed } from '../helpers/embedHelpers'
import { PATH } from '../constants'
import { sanitizeInputText } from '../helpers/formatterHelpers'
import { perplexicaWebSearchAgent } from '../helpers/voiceCommandHelpers/agents'
import { ChatCompletion, ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions'

dotenv.config()

// Define the interface for a chat message
interface ChatCompletionOptions {
  message: string
  model: string
  userId: string
}

export const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export const handleGroqSlashCommand = async ({ message, model, userId }: ChatCompletionOptions) => {
  let chatBotResponse = ''

  try {
    const messageHistory = getMessageHistory(userId)
    messageHistory.push({ role: 'user', content: sanitizeInputText(message) })

    const context = [
      {
        role: 'system',
        content: `
          You are a helpful assistant. You can call tools to help answer user questions.
          Always include the user's query exactly as they entered it in the "query" field.
        `,
      },
      ...messageHistory,
    ]

    const tools: Groq.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the web for information',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Exact user query string. Do not paraphrase or reformat.',
              },
            },
            required: ['query'],
          },
        },
      },
    ]

    const response = await client.chat.completions.create({
      model,
      messages: context as any,
      tools,
      tool_choice: {
        type: 'function',
        function: { name: 'web_search' },
      },
    })

    const responseMessage = response.choices[0].message
    const toolCalls = responseMessage.tool_calls

    console.log(response.choices[0])
    if (!toolCalls) {
      chatBotResponse = responseMessage.content || ''
      messageHistory.push({
        role: 'assistant',
        content: chatBotResponse,
      })
    } else {
      const availableFunctions = {
        web_search: perplexicaWebSearchAgent,
      }

      for (const toolCall of toolCalls) {
        try {
          const functionName = toolCall.function.name
          const functionToCall = availableFunctions[functionName as keyof typeof availableFunctions]

          if (!functionToCall) {
            throw new Error(`No function found for tool name: ${functionName}`)
          }

          const functionArgs = JSON.parse(toolCall.function.arguments)
          const functionResponse = await functionToCall(functionArgs.query, 'balanced')

          messageHistory.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: functionResponse,
          })
          chatBotResponse = functionResponse
        } catch (toolErr) {
          console.error(`Tool execution error: ${toolErr}`)
          messageHistory.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: 'There was an error processing the tool call.',
          })
        }
      }
    }

    saveConversation(userId, messageHistory)
  } catch (err: any) {
    console.error('Unhandled error in handleGroqSlashCommand:', err)

    if (err instanceof Groq.APIError) {
      createErrorEmbed({
        errorMessage: `Groq API Error:\nStatus: ${err.status}\nName: ${err.name}`,
      })
      console.error('Headers:', err.headers)
    } else {
      createErrorEmbed({
        errorMessage: 'An unexpected error occurred. Please try again later.',
      })
    }

    chatBotResponse = 'Sorry, something went wrong while processing your request.'
  }

  return chatBotResponse
}

// Function to save conversation history
export const saveConversation = (userId: string, messageHistory: ChatCompletionMessageParam[]): void => {
  const filePath = `${PATH.CHAT_HISTORY}/${userId}.json`

  // Append to file if it exists, otherwise create a new one
  writeFileSync(filePath, JSON.stringify(messageHistory))
}

export const getMessageHistory = (userId: string, wordLimit: number = 1000) => {
  let messageHistory: ChatCompletionMessageParam[] = []

  let messageHistoryFilePath = `${PATH.CHAT_HISTORY}/${userId}.json`
  if (existsSync(messageHistoryFilePath)) {
    const fileMessageHistory = readFileSync(messageHistoryFilePath, 'utf-8')
    messageHistory = fileMessageHistory ? JSON.parse(fileMessageHistory) : []
    messageHistory = trimConversationHistoryToFitModelContextLimit(messageHistory, wordLimit)
  } else {
    console.log(`##### Groq message context does not exist for user: ${userId}, skipping read.`)
  }

  return messageHistory
}

const trimConversationHistoryToFitModelContextLimit = (
  conversation: ChatCompletionMessageParam[],
  wordLimit: number = 2000
): ChatCompletionMessageParam[] => {
  if (conversation.length === 0) return []
  let selectedConvo: ChatCompletionMessageParam[] = []
  let totalWords = 0

  // Process messages from oldest to newest
  for (let message of [...conversation].reverse()) {
    let words = typeof message.content === 'string' ? message.content.split(/\s+/) : [] // Split content into words if it's a string
    let wordCount = words.length

    // If adding this message doesn't exceed the word limit, include it
    if (totalWords + wordCount <= wordLimit) {
      selectedConvo.push(message)
      totalWords += wordCount
    } else {
      break // Stop once we reach the word limit
    }
  }

  return selectedConvo.reverse()
}
