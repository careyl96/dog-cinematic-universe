// ignore all warnings
process.on('warning', (warning) => {})

import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'path'
import { Collection, GatewayIntentBits } from 'discord.js'
import { ClientWithCommands } from './ClientWithCommands'
import { AppDataSource } from './backend/db/data-source'
import { guildCtrl } from './backend/controllers/Controllers'
import { GuildSession } from './GuildSession'

dotenv.config()
const __dirname = path.resolve()

// everything in this file is a slightly modified version of the discord bot initialization tutorial

// Create a new client instance
export const client = new ClientWithCommands({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  commands: new Collection(),
})

const foldersPath = path.join(__dirname, 'src/commands')
const commandFolders = fs.readdirSync(foldersPath)

const setClientCommands = async () => {
  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder)
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.ts'))

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file)
      const command = await (await import(`${filePath}`)).default
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command)
      } else {
        console.error(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`)
      }
    }
  }
}

// get events
const eventsPath = path.join(__dirname, 'src/events')
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.ts'))

const setEventListeners = async () => {
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file)
    const event = await (await import(`${filePath}`)).default

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args))
    } else {
      const extractGuildInfoFromArgs = (args: any[]): { id: string | null; name: string | null } => {
        for (const arg of args) {
          const id = arg?.guild?.id ?? arg?.guildId
          const name = arg?.guild?.name ?? null

          if (id) {
            return { id, name }
          }
        }
        return { id: null, name: null }
      }
      const handler = async (...args: any[]) => {
        const { id: guildId, name: guildName } = extractGuildInfoFromArgs(args)

        let session = null
        let guild = await guildCtrl.getById(guildId)
        if (!guild) {
          guild = await guildCtrl.upsert({ id: guildId, name: guildName || 'Unknown Guild' })
        }

        session = client.guildSessions.get(guildId)
        if (!session) {
          session = await GuildSession.create({ guild })
          client.guildSessions.set(guildId, session)
        }

        await event.execute(client, session, ...args)
      }

      if (event.name === 'raw') {
        client.on(event.name, async (packet) => {
          const guildId = packet.d.guild_id
          const guildName: string = null

          if (!guildId) return

          let guild = await guildCtrl.getById(guildId)
          if (!guild) {
            guild = await guildCtrl.upsert({ id: guildId, name: guildName || 'Unknown Guild' })
          }

          let session = client.guildSessions.get(guildId)
          if (!session) {
            session = await GuildSession.create({ guild })
            client.guildSessions.set(guildId, session)
          }

          await event.execute(client, session, packet)
        })
      } else {
        client.on(event.name, handler)
      }
    }
  }
}

AppDataSource.initialize()
  .then(() => {
    setClientCommands()
    setEventListeners()
  })
  .catch((error) => {
    console.error('Error during Data Source initialization:', error)
  })

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN)
