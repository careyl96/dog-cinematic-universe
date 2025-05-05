// ignore all warnings
process.on('warning', (warning) => {})

import dotenv from 'dotenv'
import { Collection, Events, GatewayIntentBits, MessageFlags } from 'discord.js'
import fs from 'node:fs'
import path from 'path'
import { ClientWithCommands } from './ClientWithCommands'
import { PATH } from './constants'
import { createErrorEmbed } from './helpers/embedHelpers'

dotenv.config()

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

const foldersPath = PATH.COMMANDS
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
const eventsPath = PATH.EVENTS
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

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const interactionClient = interaction.client as ClientWithCommands
  const command = interactionClient.commands.get(interaction.commandName)
  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`)
    return
  }

  try {
    if (
      interaction.commandName === 'tts' ||
      interaction.commandName === 'play' ||
      // temp
      interaction.commandName === 'cache' ||
      interaction.commandName === 'noncached' ||
      // /temp
      interaction.commandName === 'playprev' ||
      interaction.commandName === 'groq'
    ) {
      await interaction.deferReply()
    }

    if (interaction.commandName === 'remove') {
      await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
      })
    }

    if (
      interaction.commandName === 'stop' ||
      interaction.commandName === 'skip' ||
      interaction.commandName === 'shuffle' ||
      interaction.commandName === 'pause' ||
      interaction.commandName === 'roulette' ||
      interaction.commandName === 'enablevoicecommands' ||
      interaction.commandName === 'disablevoicecommands' ||
      interaction.commandName === 'unpause'
    ) {
      await interaction.deferReply()
      await interaction.deleteReply()
    }

    await command.execute(interaction)
  } catch (error: any) {
    let errorMessage = `${error?.message}` || 'Something went very wrong oopsie woopsie woof report to Carey'

    if (interaction.replied || interaction.deferred) {
      console.log('index.ts error:', error)
      await interaction.followUp(
        createErrorEmbed({
          errorMessage: errorMessage,
          flags: MessageFlags.Ephemeral,
        }) as any
      )
    } else {
      console.log('index.ts replied error:', error)
      await interaction.reply(
        createErrorEmbed({
          errorMessage: errorMessage,
          flags: MessageFlags.Ephemeral,
        }) as any
      )
    }
  }
})

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN)
