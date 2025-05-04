import { Events } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { fetchModels } from '../helpers/voiceCommandHelpers/voiceCommandHelpers'

import cron from 'node-cron'
import { playHourlyMusic } from '../helpers/hourlyMusicHelpers'
import { client } from '..'
import { fetchMessages } from '../helpers/otherHelpers'
import { TEXT_CHANNELS } from '../constants'

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
    // const user = await getGuildMember(client, process.env.DISCORD_GUILD_ID!, 118585025905164291)
    // client.runSpokenCommand(user, 'can you elaborate on that?')
    // await perplexicaWebSearchAgent(`I'm making a discord bot that streams audio from a youtube stream using youtube-dl-exec, is there any way I can choose the timestamp at which the stream should start`)
    // await analyzeIntent('roulette 500')
    // checkMemoryUsage()
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
