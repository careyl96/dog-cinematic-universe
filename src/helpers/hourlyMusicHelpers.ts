import { TextChannel } from 'discord.js'
import { client } from '..'
import { animalCrossingMusic, BOT_USER_ID, TEXT_CHANNELS } from '../constants'
import { play } from '../helpers/playerFunctions'

export const playHourlyMusic = async () => {
  const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID!)
  const user = await guild.members.fetch(BOT_USER_ID)

  const now = new Date()
  const hour = now.getHours()
  const channel = client.channels.cache.get(TEXT_CHANNELS.MUSIC_BOT) as TextChannel

  console.log(`🎵 It's now ${hour}:00 — checking for track...`)
  const trackUrl = animalCrossingMusic[hour]

  if (trackUrl && channel) {
    if (!client.connection) return console.error('Dog not connected to voice channel')
    await play({ user, query: trackUrl, triggeredByBot: true, saveToHistory: false })
  } else {
    console.warn(`No track for hour ${hour} or channel missing`)
  }
}
