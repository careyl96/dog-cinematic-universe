import { Events, TextChannel } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { fetchModels } from '../helpers/voiceCommandHelpers/voiceCommandHelpers'
import { client } from '..'
import { BOT_USER_ID, TEXT_CHANNELS } from '../constants'
import { play } from '../helpers/playerFunctions'
import { getCurrentTimestamp } from '../helpers/formatterHelpers'

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: ClientWithCommands) {
    await client.init()
    console.log(`Ready! Logged in as ${client.user!.tag}`)

    await fetchModels()
    await playHourlyMusic()
    // checkMemoryUsage()
  },
}

const checkMemoryUsage = () => {
  setInterval(() => {
    const memoryUsage = process.memoryUsage()

    console.log(
      `Heap Used: ${Math.round(memoryUsage.heapUsed / 1000000).toFixed(2)} MB`
    )
    console.log(`RSS: ${Math.round(memoryUsage.rss / 1000000).toFixed(2)} MB`)
  }, 5000)
}

const playHourlyMusic = async () => {
  const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID!)
  const user = await guild.members.fetch(BOT_USER_ID)

  const hours: Record<number, string> = {
    0: 'https://youtube.com/watch?v=qDnrdeNDRio',
    1: 'https://youtube.com/watch?v=LjrMm_6zmNo',
    2: 'https://youtube.com/watch?v=oPCkJqbTpaA',
    3: 'https://youtube.com/watch?v=0Gpa29MRPys',
    4: 'https://youtube.com/watch?v=ROpWMf0Md6g',
    5: 'https://youtube.com/watch?v=_qSyWo0Tm4U',
    6: 'https://youtube.com/watch?v=lS0XGL2rWTI',
    7: 'https://youtube.com/watch?v=rdVBS1lHDC4',
    8: 'https://youtube.com/watch?v=QIx22FB3FXo',
    9: 'https://youtube.com/watch?v=7Rf6gOt_LdY',
    10: 'https://youtube.com/watch?v=hkP1kOKF2Yk',
    11: 'https://youtube.com/watch?v=AKXMNP23BnA',
    12: 'https://youtube.com/watch?v=KJp488yN3VM',
    13: 'https://youtube.com/watch?v=yWWoDrUZq04',
    14: 'https://youtube.com/watch?v=gD4Hh115gOk',
    15: 'https://youtube.com/watch?v=uhnNzw4x7sE',
    16: 'https://youtube.com/watch?v=cLBhI_9njKw',
    17: 'https://youtube.com/watch?v=vc1zlXMyZow',
    18: 'https://youtube.com/watch?v=WH_rj-YzzXI',
    19: 'https://youtube.com/watch?v=AK5mUK5IQvs',
    20: 'https://youtube.com/watch?v=du10VZTTZp8',
    21: 'https://youtube.com/watch?v=HxXOrY_DtVw',
    22: 'https://youtube.com/watch?v=zANebE1wNjw',
    23: 'https://youtube.com/watch?v=5hVFsARLcV0',
  }

  const playMusicForHour = async () => {
    const now = new Date()
    const hour = now.getHours()
    const channel = client.channels.cache.get(
      TEXT_CHANNELS.MUSIC_BOT
    ) as TextChannel
    const trackUrl = hours[hour]

    console.log(
      `🕒 It's now ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}!`
    )

    if (trackUrl && channel) {
      await play({ user, query: trackUrl, triggeredByBot: true })
    } else {
      console.warn(`No track for hour ${hour} or channel missing`)
    }
  }

  const scheduleNextHour = () => {
    const now = new Date()
    const nextHour = new Date(now)
    nextHour.setHours(now.getHours() + 1, 0, 0, 0)

    const msToNextHour = nextHour.getTime() - now.getTime()

    const minutes = Math.floor(msToNextHour / 60000)
    const seconds = Math.floor((msToNextHour % 60000) / 1000)
    console.log(
      getCurrentTimestamp(),
      `Scheduling next hourly music in ${minutes}m ${seconds}s`
    )

    setTimeout(async () => {
      await playMusicForHour()
      setInterval(playMusicForHour, 60 * 60 * 1000)
    }, msToNextHour)
  }

  scheduleNextHour()
}
