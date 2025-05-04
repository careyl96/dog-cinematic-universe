import { REST, Routes } from 'discord.js'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { PATH } from './src/constants'

dotenv.config()

console.log('deploy commands called')
const commands: any[] = []
const foldersPath = PATH.COMMANDS
const commandFolders = fs.readdirSync(foldersPath)

const loadCommands = async () => {
  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder)
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith('.ts'))

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file)
      const command = await (await import(`${filePath}`)).default
      if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON())
      } else {
        console.log(
          `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
        )
      }
    }
  }
}

// Deploy commands
const deployCommands = async () => {
  try {
    await loadCommands() // Ensure commands are loaded before deploying

    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    )

    const rest = new REST().setToken(process.env.DISCORD_TOKEN!)
    const data: any = await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID!,
        process.env.DISCORD_GUILD_ID!
      ),
      { body: commands }
    )

    console.log(data)
    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    )
  } catch (error) {
    console.error(error)
  }
}

const clearCommands = async () => {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN!)
  try {
    // Target global commands by using `Routes.applicationCommands` (no guild ID)
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      { body: [] } // Clears all guild commands
    )

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID!,
        process.env.DISCORD_GUILD_ID!
      ),
      { body: [] } // Clears all guild commands
    )
    console.log('Successfully deleted all guild commands.')
  } catch (error) {
    console.error('!!! Failed to clear commands:', error)
  }
}

// Run the deployment process
deployCommands()
// clearCommands()
