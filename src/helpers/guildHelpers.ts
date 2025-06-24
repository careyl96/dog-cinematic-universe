// src/utils/deployCommandsToGuild.ts
import fs from 'node:fs'
import path from 'path'
import { REST, Routes, RESTPostAPIApplicationCommandsJSONBody } from 'discord.js'
import { PATH } from '../constants'
import dotenv from 'dotenv'

dotenv.config()

export const deployCommandsToGuild = async (guildId: string): Promise<void> => {
  const commands: RESTPostAPIApplicationCommandsJSONBody[] = []
  const foldersPath = PATH.COMMANDS
  const commandFolders = fs.readdirSync(foldersPath)

  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder)
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.ts') || file.endsWith('.js'))

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file)
      const command = await (await import(filePath)).default
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON())
      } else {
        console.warn(`[WARNING] Command at ${filePath} missing "data" or "execute".`)
      }
    }
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN!)
  try {
    const data = await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, guildId), {
      body: commands,
    })
    console.log(`✅ Deployed ${Array.isArray(data) ? data.length : 0} commands to guild ${guildId}`)
  } catch (err) {
    console.error(`❌ Failed to deploy commands to guild ${guildId}:`, err)
  }
}
