import { Events, Guild } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'

export default {
  name: Events.GuildDelete,
  once: false,
  async execute(client: ClientWithCommands, _session: null, guild: Guild) {
    console.log(`Removed from guild: ${guild.name} (${guild.id})`)

    // Clean up session and any related resources
    if (client.guildSessions.has(guild.id)) {
      client.guildSessions.get(guild.id).cleanup()
      client.guildSessions.delete(guild.id)
    }
  },
}
