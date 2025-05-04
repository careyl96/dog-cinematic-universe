import dotenv from 'dotenv'
import { Message, TextChannel } from 'discord.js'
import { client } from '..'

dotenv.config()

export const fetchMessages = async (channel: any, limit: number = 100): Promise<Message[]> => {
  let messages: Message[] = []
  let lastId: string | null = null

  while (messages.length < limit) {
    const fetchOptions: any = { limit: Math.min(limit - messages.length, 100) }
    if (lastId) {
      fetchOptions.before = lastId
    }

    const fetched = await channel.messages.fetch(fetchOptions)
    if (fetched.size === 0) break

    messages.push(...fetched.values())
    lastId = fetched.last()?.id || null
  }

  return messages
}

export const shuffle = (array: any) => {
  let currentIndex = array.length

  // While there remain elements to shuffle...
  while (currentIndex != 0) {
    // Pick a remaining element...
    let randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--

    // And swap it with the current element.
    ;[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
  }
  return array
}

export const emoji = ({ name, id }: { name: string; id: string }): string => {
  return `<:${name}:${id}>`
}

export const removeSkipReactionsFromBot = async (
  channel: TextChannel,
  botUserId: string,
  limit: number = 100
): Promise<void> => {
  const messages: Message[] = await fetchMessages(channel, limit)

  for (const message of messages) {
    const reaction = message.reactions.cache.get('⏭️')
    if (reaction) {
      try {
        await reaction.users.remove(botUserId)
      } catch (err) {
        console.error(`Failed to remove ⏭️ from message ${message.id}:`, err)
      }
    }
  }
}

export const getGuildMember = async (userId: string) => {
  try {
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID!)
    const member = await guild.members.fetch(userId)
    return member
  } catch (error) {
    console.error('Failed to fetch guild member:', error)
    return null
  }
}
