// ignore all warnings
process.on('warning', (warning) => {})

import dotenv from 'dotenv'
import { Collection, GatewayIntentBits } from 'discord.js'
import fs from 'node:fs'
import path from 'path'
import { ClientWithCommands } from './ClientWithCommands'
import { PlaylistManager } from './PlaylistManager'

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

export const playlistManager = new PlaylistManager()

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
setClientCommands()

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
      client.on(event.name, (...args) => event.execute(client, ...args))
    }
  }
}
setEventListeners()

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN)
