import { EntityManager } from 'typeorm'
import { BaseController } from './BaseController'
import { Guild } from '../entities/Guild'
import { client } from '../..'
import { ChannelType, Guild as DiscordGuild } from 'discord.js'

export class GuildController extends BaseController<Guild> {
  constructor(manager?: EntityManager) {
    super(Guild, manager)
  }

  async upsert({
    id,
    name,
    musicBotTextChannel,
  }: {
    id: string
    name?: string
    musicBotTextChannel?: string
  }): Promise<Guild> {
    const guild = await this.repo.findOneBy({ id })

    if (guild) {
      if (name) guild.name = name
      if (musicBotTextChannel) guild.musicBotTextChannel = musicBotTextChannel
      return this.repo.save(guild)
    }

    return this.repo.save(
      this.repo.create({
        id,
        name,
        musicBotTextChannel,
      })
    )
  }

  async getById(guildId: string): Promise<Guild | null> {
    return this.repo.findOneBy({ id: guildId })
  }

  async getAll(): Promise<Guild[]> {
    return this.repo.find()
  }

  async getVoiceChannelsByGuildId(guildId: string): Promise<string[] | null> {
    let discordGuild: DiscordGuild | undefined

    discordGuild = client.guilds.cache.get(guildId)

    if (!discordGuild) {
      try {
        discordGuild = await client.guilds.fetch(guildId)
      } catch (error) {
        console.error(`Could not fetch guild with ID ${guildId}:`, error)
        return null
      }
    }

    const channels = await discordGuild.channels.fetch()

    return channels
      .filter((channel) => channel?.type === ChannelType.GuildVoice || channel?.type === ChannelType.GuildStageVoice)
      .map((channel) => channel!.id)
  }

  async delete(guildId: string): Promise<Guild | null> {
    const guild = await this.repo.findOneBy({ id: guildId })
    if (!guild) return null

    await this.repo.delete(guildId)
    return guild
  }

  async findOneByOrFail(criteria: Partial<Guild>): Promise<Guild> {
    const guild = await this.repo.findOneBy(criteria)
    if (!guild) {
      throw new Error(`Guild not found with criteria: ${JSON.stringify(criteria)}`)
    }
    return guild
  }
}
