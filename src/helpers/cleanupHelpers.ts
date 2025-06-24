// helpers to clean up stale data/errors/etc.

import { client } from '..'
import { TEXT_CHANNELS } from '../constants'
import { fetchMessages } from './otherHelpers'

// removes music embeds from the music bot channel (edit condition yourself)
export const cleanChannelMessages = async (count: number = 0): Promise<void> => {
  const musicBotTextChannel = client.channels.cache.get(TEXT_CHANNELS.MUSIC_BOT)
  const messages = await fetchMessages(musicBotTextChannel, count)

  for (const message of messages) {
    if (
      message.embeds.length > 0 &&
      message.embeds.some((embed: any) => embed.description?.includes(`Requested by: <@118585025905164291>`))
    ) {
      try {
        await message.delete()
        // console.log(`Deleted message ID: ${message.id}`)
      } catch (error) {
        console.warn(`Failed to delete message ID ${message.id}:`, error)
      }
    }
  }

  console.log('Channel cleanup complete.')
}
