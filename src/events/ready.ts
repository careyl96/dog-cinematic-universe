import { Events } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { fetchModels } from '../helpers/voiceCommandHelpers/voiceCommandHelpers'

import cron from 'node-cron'
import { playHourlyMusic } from '../helpers/hourlyMusicHelpers'
import { client } from '..'
import { fetchMessages } from '../helpers/otherHelpers'
import { BOT_USER_ID, TEXT_CHANNELS } from '../constants'
import { getVideoDataFromMessage } from '../helpers/embedHelpers'
import { createOrUpdateUserMusicHistory, createOrUpdateUsersLikedMusic } from '../helpers/musicDataHelpers'

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: ClientWithCommands) {
    await client.init()
    // console.log(`Ready! Logged in as ${client.user!.tag}`)
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    📣  DOG IS NOW RUNNING  📣                    ║
╚══════════════════════════════════════════════════════════════════╝
      `)
    await fetchModels()
    await client.migrateToMostPopulatedVoiceChannelOrDisconnect()

    cron.schedule('0 0 * * * *', playHourlyMusic)
    console.log('\n* ════════════════════════════════════════════════════════════════ *\n')
  },
}

const checkMemoryUsage = () => {
  setInterval(() => {
    const memoryUsage = process.memoryUsage()

    console.log(`Heap Used: ${Math.round(memoryUsage.heapUsed / 1000000).toFixed(2)} MB`)
    console.log(`RSS: ${Math.round(memoryUsage.rss / 1000000).toFixed(2)} MB`)
  }, 5000)
}

// removes all embeds from the music bot channel that were sent by the bot itself
async function cleanChannelMessages(): Promise<void> {
  const musicBotChannel = client.channels.cache.get(TEXT_CHANNELS.MUSIC_BOT)
  const messages = await fetchMessages(musicBotChannel, 1000)

  for (const message of messages) {
    if (
      message.embeds.length > 0 &&
      message.embeds.some((embed: any) => embed.description?.includes(`Requested by: <@1330353040288514048>`))
    ) {
      try {
        console.log(message.embeds[0].description)
        await message.delete()
        // console.log(`Deleted message ID: ${message.id}`)
      } catch (error) {
        console.warn(`Failed to delete message ID ${message.id}:`, error)
      }
    }
  }

  console.log('Channel cleanup complete.')
}

// removes all embeds from the music bot channel that were sent by the bot itself
async function populateMusicHistory(): Promise<void> {
  const musicBotChannel = client.channels.cache.get(TEXT_CHANNELS.MUSIC_BOT)
  const messages = await fetchMessages(musicBotChannel, 5000)

  const musicHistory: any = {}
  for (const message of messages) {
    if (message.embeds.length > 0) {
      try {
        const videoData = getVideoDataFromMessage(message)
        if (videoData) {
          const videoId = videoData.id
          if (!musicHistory[videoId]) {
            musicHistory[videoId] = {
              ...videoData,
              requestCount: 1,
            }
          } else {
            musicHistory[videoId].requestCount += 1
          }
        }
      } catch (error) {
        console.warn(`Failed to add message ID ${message.id}:`, error)
      }
    }
  }

  createOrUpdateUserMusicHistory(BOT_USER_ID, musicHistory)

  console.log('Channel cleanup complete.')
}
