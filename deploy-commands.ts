import dotenv from 'dotenv'
import { guildCtrl } from './src/backend/controllers/Controllers'
import { AppDataSource } from './src/backend/db/data-source'
import { deployCommandsToGuild } from './src/helpers/guildHelpers'

dotenv.config()

AppDataSource.initialize().then(async () => {
  try {
    const allGuilds = await guildCtrl.getAll()

    for (const guild of allGuilds) {
      try {
        await deployCommandsToGuild(guild.id)
      } catch (err) {
        console.error(`❌ Failed to deploy to guild ${guild.id}:`, err)
      }
    }
  } catch (error) {
    console.error('‼️ Error during deployment:', error)
  }
})
