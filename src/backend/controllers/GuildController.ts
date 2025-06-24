import { EntityManager } from 'typeorm'
import { BaseController } from './BaseController'
import { Guild } from '../entities/Guild'
import { client } from '../..'
import { ChannelType } from 'discord.js'

export class GuildController extends BaseController<Guild> {
  constructor(manager?: EntityManager) {
    super(Guild, manager)
  }

  async upsert({ id, name, musicBotTextChannel }: { id: string; name?: string; musicBotTextChannel?: string }): Promise<Guild> {
    let guild = await this.repo.findOneBy({ id })

    if (guild) {
      if (name) guild.name = name
      if (musicBotTextChannel) guild.musicBotTextChannel = musicBotTextChannel
    } else {
      guild = this.repo.create({
        id,
        name,
        musicBotTextChannel,
      })
    }

    return this.repo.save(guild)
  }

  async getById(guildId: string): Promise<Guild | null> {
    return this.repo.findOneBy({ id: guildId })
  }

  async getAll(): Promise<Guild[]> {
    return this.repo.find()
  }

  async getVoiceChannelsByGuildId(guildId: string) {
    let guild = client.guilds.cache.get(guildId)

    if (!guild) {
      try {
        guild = await client.guilds.fetch(guildId)
      } catch (error) {
        console.error(`Could not fetch guild with ID ${guildId}:`, error)
        return null
      }
    }

    const channels = await guild.channels.fetch()

    const voiceChannels = channels
      .filter((channel) => channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice)
      .map((channel) => channel.id)

    return voiceChannels
  }

  async delete(guildId: string): Promise<Guild | null> {
    const guild = await this.repo.findOneBy({ id: guildId })
    if (!guild) return null

    await this.repo.delete(guildId)
    return guild
  }
}
