import {
  AudioPlayerStatus,
  entersState,
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
} from '@discordjs/voice'
import { YoutubeMusicPlayer } from './MusicPlayer'
import { TextChannel, VoiceBasedChannel, VoiceChannel } from 'discord.js'
import { client } from '.'
import { Guild } from './backend/entities/Guild'
import { getGuildMember } from './helpers/otherHelpers'
import { getMostPopulatedVoiceChannels } from './helpers/voiceConnectionHelpers'
import { UserStateManager } from './UserStateManager'

interface GuildSessionOptions {
  guild: Guild
  musicBotTextChannel: TextChannel | null
  voiceChannel?: VoiceBasedChannel | null
  connection?: VoiceConnection | null
}

export class GuildSession {
  guild: Guild
  musicBotTextChannel: TextChannel | null
  voiceChannel: VoiceBasedChannel | null
  connection: VoiceConnection | null
  musicPlayer: YoutubeMusicPlayer | null
  userState: UserStateManager | null

  private idleTimeout: NodeJS.Timeout | null = null

  private constructor({ guild, musicBotTextChannel, voiceChannel, connection }: GuildSessionOptions) {
    this.guild = guild
    this.musicBotTextChannel = musicBotTextChannel ?? null
    this.voiceChannel = voiceChannel ?? null

    this.connection = connection ?? null
    this.musicPlayer = null
    this.userState = new UserStateManager()

    this.idleTimeout = null
  }

  static async create({
    guild,
    voiceChannel,
    connection,
  }: {
    guild: Guild
    connection?: VoiceConnection | null
    voiceChannel?: VoiceBasedChannel | null
  }): Promise<GuildSession> {
    const musicBotTextChannel = (await client.channels.fetch(guild.musicBotTextChannel)) as TextChannel
    const session = new GuildSession({ guild, musicBotTextChannel, voiceChannel, connection })

    const musicPlayer = new YoutubeMusicPlayer({
      session,
      connection,
    })
    session.musicPlayer = musicPlayer

    return session
  }

  getUserState = (userId: string) => {
    return this.userState.get(userId)
  }

  // bot disconnects after 5 minutes of inactivity
  startIdleTimer = async () => {
    if (!this.idleTimeout) {
      this.idleTimeout = setTimeout(async () => {
        try {
          const session = client.guildSessions.get(this.guild.id)
          if (session) {
            session.cleanup()
          }
        } catch (err) {}
      }, 5 * 60000)
    }
  }
  stopIdleTimer = () => {
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout)
      this.idleTimeout = null
    }
  }

  async updateVoiceConnection(newVoiceChannel: VoiceChannel, connection: VoiceConnection) {
    this.voiceChannel = newVoiceChannel
    this.connection = connection
  }

  async joinVoiceChannel(voiceChannelId: string): Promise<boolean> {
    try {
      if (this.voiceChannel?.id === voiceChannelId && this.connection?.joinConfig.channelId === voiceChannelId) {
        console.log('Joining same voice channel')
        return true
      }

      if (this.connection) {
        this.connection.destroy()
        this.connection = null
      }

      const fetchedChannel = await client.channels.fetch(voiceChannelId)
      if (!fetchedChannel || !(fetchedChannel instanceof VoiceChannel)) {
        throw new Error('Provided channel is not a valid voice channel.')
      }

      const connection = joinVoiceChannel({
        channelId: fetchedChannel.id,
        guildId: this.guild.id,
        adapterCreator: fetchedChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false,
      })

      // Handle connection errors
      connection.on('error', (error) => {
        console.error(`🎤 Voice connection error in guild ${this.guild.id}:`, error)
      })

      // Handle disconnects with a graceful reconnection fallback
      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
          ])
        } catch {
          connection.destroy()
        }
      })

      await entersState(connection, VoiceConnectionStatus.Ready, 10_000)

      await this.updateVoiceConnection(fetchedChannel, connection)
      return true
    } catch (error) {
      console.error(`[Voice] Failed to join voice channel in guild ${this.guild.id}:`, error)
      return false
    }
  }

  async ensureVoiceConnection(userId: string): Promise<boolean> {
    try {
      const user = await getGuildMember(userId, this.guild.id)
      const userChannel = user?.voice?.channel
      if (userChannel) {
        return await this.joinVoiceChannel(userChannel.id)
      }

      const { mostNonBotUsersChannel, mostUsersChannel } = await getMostPopulatedVoiceChannels(this.guild.id)
      const fallbackChannelId = mostNonBotUsersChannel ?? mostUsersChannel

      if (!fallbackChannelId) return false
      return await this.joinVoiceChannel(fallbackChannelId)
    } catch (error) {
      console.error(`[Voice] Failed to ensure voice connection:`, error)
      return false
    }
  }

  async migrateToMostPopulatedVoiceChannelOrDisconnect() {
    const { mostUsersChannel, mostNonBotUsersChannel } = await getMostPopulatedVoiceChannels(this.guild.id)

    if (mostNonBotUsersChannel && this.connection !== null) {
      await this.joinVoiceChannel(mostNonBotUsersChannel)
      return
    }

    if (!mostNonBotUsersChannel && mostUsersChannel) {
      if (this.musicPlayer.player.state.status === AudioPlayerStatus.Idle) {
        this.cleanup()
      } else {
        setTimeout(async () => {
          try {
            const updatedChannel = (await client.channels.fetch(mostUsersChannel)) as any
            if (updatedChannel?.members.size === 1) {
              this.cleanup()
            }
          } catch (error) {
            console.error(`Error fetching channel ${mostUsersChannel}:`, error)
          }
        }, 5 * 60_000)
      }
    }
  }

  cleanup() {
    console.log(`🧹💨✨ Disconnecting/cleaning up bot from ${this.guild.id}`)
    this.voiceChannel = null
    this.stopIdleTimer()
    try {
      this.connection?.destroy()
    } catch (err) {}
    this.connection = null
  }
}
