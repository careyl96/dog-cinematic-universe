import fs from 'node:fs'
import path from 'path'
import dotenv from 'dotenv'
import { REST, Routes } from 'discord.js'
import { PATH } from './src/constants'
import { guildCtrl } from './src/backend/controllers/Controllers'
import { AppDataSource } from './src/backend/db/data-source'

dotenv.config()

AppDataSource.initialize().then(() => {
  const commands: any[] = []
  const foldersPath = PATH.COMMANDS
  const commandFolders = fs.readdirSync(foldersPath)

  const loadCommands = async () => {
    for (const folder of commandFolders) {
      const commandsPath = path.join(foldersPath, folder)
      const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.ts'))

      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file)
        const command = await (await import(`${filePath}`)).default
        if ('data' in command && 'execute' in command) {
          commands.push(command.data.toJSON())
        } else {
          console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`)
        }
      }
    }
  }

  // Deploy to all guilds
  const deployCommands = async () => {
    try {
      await loadCommands()
      const rest = new REST().setToken(process.env.DISCORD_TOKEN!)
      const allGuilds = await guildCtrl.getAll()

      for (const guild of allGuilds) {
        try {
          const data: any = await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, guild.id), {
            body: commands,
          })

          console.log(`✅ Successfully deployed ${data.length} commands to guild ${guild.id}`)
        } catch (err) {
          console.error(`❌ Failed to deploy to guild ${guild.id}:`, err)
        }
      }
    } catch (error) {
      console.error('‼️ Error during deployment:', error)
    }
  }

  // Run deployment
  deployCommands()
  // clearCommands() // optional
})
