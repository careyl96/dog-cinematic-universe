import Groq from 'groq-sdk'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import dotenv from 'dotenv'
import { createErrorEmbed } from '../helpers/embeds'
import { PATH } from '../constants'
import { sanitizeInputText } from '../helpers/formatterHelpers'

dotenv.config()

// Define the interface for a chat message
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatCompletionOptions {
  message: string
  model: string
  userId: string
}

export const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

export const createChatCompletion = async ({
  message,
  model,
  userId,
}: ChatCompletionOptions) => {
  let chatBotResponse = ''
  try {
    const messageHistory = getMessageHistory(userId)

    messageHistory.push({ role: 'user', content: sanitizeInputText(message) })

    const context = [
      {
        role: 'system',
        content:
          'You are a helpful assistant but sparsely throw in the word "woof" in your responses',
      },
      ...messageHistory,
    ] as any

    const chatCompletion = await client.chat.completions
      .create({
        model,
        messages: context,
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

    if (chatCompletion) {
      chatBotResponse =
        chatCompletion?.choices[0]?.message.content
          ?.replace(/<think>/g, '**<think>**')
          .replace(/<\/think>/g, '**</think>**') || ''
      messageHistory.push({
        role: 'assistant',
        content: chatBotResponse.replace(/<think>.*?<\/think>/gs, ''),
      })
    }

    saveConversation(userId, messageHistory)
  } catch (err) {
    console.error(err)
  }

  return chatBotResponse
}

// Function to save conversation history
const saveConversation = (
  userId: string,
  messageHistory: ChatMessage[]
): void => {
  const filePath = `${PATH.CHAT_HISTORY}/${userId}.txt`

  // Append to file if it exists, otherwise create a new one
  writeFileSync(filePath, JSON.stringify(messageHistory))
}

const getMessageHistory = (userId: string) => {
  let messageHistory: ChatMessage[] = []

  const messageHistoryFilePath = `${PATH.CHAT_HISTORY}/${userId}.txt`
  if (existsSync(messageHistoryFilePath)) {
    const fileMessageHistory = readFileSync(messageHistoryFilePath, 'utf-8')
    messageHistory = fileMessageHistory ? JSON.parse(fileMessageHistory) : []
    messageHistory =
      trimConversationHistoryToFitModelContextLimit(messageHistory)
  } else {
    console.log(
      `##### Groq message context does not exist for user: ${userId}, skipping read.`
    )
  }

  return messageHistory
}

const trimConversationHistoryToFitModelContextLimit = (
  conversation: ChatMessage[],
  wordLimit: number = 2000
): ChatMessage[] => {
  if (conversation.length === 0) return []
  let selectedConvo: ChatMessage[] = []
  let totalWords = 0

  // Process messages from oldest to newest
  for (let message of [...conversation].reverse()) {
    let words = message.content.split(/\s+/) // Split content into words
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
