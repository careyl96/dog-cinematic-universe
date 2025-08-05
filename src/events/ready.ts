import { Events } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import axios from 'axios'

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
    // await transcriptionServerHealthCheck()
    console.log('\n* ════════════════════════════════════════════════════════════════ *\n')
  },
}

const checkMemoryUsage = () => {
  setInterval(() => {
    const memoryUsage = process.memoryUsage()

    console.log(`Heap Used: ${Math.round(memoryUsage.heapUsed / 1000000).toFixed(2)} MB`)
    console.log(`RSS: ${Math.round(memoryUsage.rss / 1000000).toFixed(2)} MB`)
  }, 5000)
}

const transcriptionServerHealthCheck = async () => {
  try {
    const response = await axios.get('http://localhost:8080/health')
    console.log('✅ Health check:', response.data)
  } catch (err: any) {
    console.error('❌ Health check failed:', err.message)
  }
}
