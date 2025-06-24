import { Events, Guild } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { guildCtrl } from '../backend/controllers/Controllers'
import { GuildSession } from '../GuildSession'

export default {
  name: Events.GuildCreate,
  once: false,
  async execute(client: ClientWithCommands, _session: GuildSession | null, guild: Guild) {
    console.log(`Joined new guild: ${guild.name} (${guild.id})`)

    let guildData = await guildCtrl.getById(guild.id)
    if (!guildData) {
      guildData = await guildCtrl.upsert({ id: guild.id, name: guild.name || 'Unknown Guild' })
    }

    if (!client.guildSessions.has(guild.id)) {
      const session = await GuildSession.create({ guild: guildData })
      client.guildSessions.set(guild.id, session)
    }
  },
}
