import { Events } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'

import { client } from '..'
import { fetchMessages } from '../helpers/otherHelpers'
import { BOT_USER_ID, TEXT_CHANNELS } from '../constants'
import { extractVideoDataFromMessage } from '../helpers/embedHelpers'
import { trackCtrl } from '../backend/controllers/Controllers'
import yts from 'yt-search'
import { formatYTSFromIdSearch } from '../helpers/youtubeHelpers/ytsHelpers'

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
    // await fetchModels()
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

