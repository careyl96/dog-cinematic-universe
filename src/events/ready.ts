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
    // await seedEmptyTracks()
    console.log('\n* ════════════════════════════════════════════════════════════════ *\n')
  },
}
// seed track data into db by fetching via yts
const seedTrack = async () => {
  const userId = '120031401948086272'
  const trackList: string[] = ['t6MRomiT6RU']
  for (const id of trackList) {
    try {
      const searchResult = await yts({ videoId: id })
      const upsertedTrack = await trackCtrl.upsert({
        ...formatYTSFromIdSearch(searchResult),
        firstPlayedBy: userId,
        userPlayCount: 1,
      })
      console.log(upsertedTrack)
    } catch (err) {}
  }
}

const seedEmptyTracks = async () => {
  const allTracks = (await trackCtrl.getAll()).filter((track) => track.title === null)
  for (const track of allTracks) {
    try {
      const searchResult = await yts({ videoId: track.id })
      const upsertedTrack = await trackCtrl.upsert(formatYTSFromIdSearch(searchResult))
      console.log(upsertedTrack)
    } catch (err) {
      console.log('error with', track.id)
      console.log(await trackCtrl.delete(track.id))
    }
  }
}

const checkMemoryUsage = () => {
  setInterval(() => {
    const memoryUsage = process.memoryUsage()

    console.log(`Heap Used: ${Math.round(memoryUsage.heapUsed / 1000000).toFixed(2)} MB`)
    console.log(`RSS: ${Math.round(memoryUsage.rss / 1000000).toFixed(2)} MB`)
  }, 5000)
}

// removes all embeds from the music bot channel that were sent by the bot itself
async function populateMusicHistory(): Promise<void> {
  const musicBotTextChannel = client.channels.cache.get(TEXT_CHANNELS.MUSIC_BOT)
  const messages = await fetchMessages(musicBotTextChannel, 5000)

  const musicHistory: any = {}
  for (const message of messages) {
    if (message.embeds.length > 0) {
      try {
        const videoData = extractVideoDataFromMessage(message)
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
