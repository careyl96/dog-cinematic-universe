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
import Websocket from 'ws'
import { handleUserSpeaking } from './helpers/voiceCommandHelpers/voiceCommandHelpers'

interface GuildSessionOptions {
  guild: Guild
  musicBotTextChannel: TextChannel | null
  voiceChannel?: VoiceBasedChannel | null
  connection?: VoiceConnection | null
}

// One session per discord server
export class GuildSession {
  guild: Guild
  musicBotTextChannel: TextChannel | null
  voiceChannel: VoiceBasedChannel | null
  activeSpeakers: Map<string, any>
  ws: Websocket | null

  connection: VoiceConnection | null
  musicPlayer: YoutubeMusicPlayer | null
  userStates: UserStateManager | null

  private idleTimeout: NodeJS.Timeout | null = null

  private constructor({ guild, musicBotTextChannel, voiceChannel, connection }: GuildSessionOptions) {
    this.guild = guild
    this.musicBotTextChannel = musicBotTextChannel ?? null
    this.voiceChannel = voiceChannel ?? null
    this.activeSpeakers = new Map()
    this.ws = null

    this.connection = connection ?? null
    this.musicPlayer = null
    this.userStates = new UserStateManager()

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
    return this.userStates.get(userId)
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

      const voiceChannelToJoin = await client.channels.fetch(voiceChannelId)
      if (!voiceChannelToJoin || !(voiceChannelToJoin instanceof VoiceChannel)) {
        throw new Error('Provided channel is not a valid voice channel.')
      }

      const connection = joinVoiceChannel({
        channelId: voiceChannelToJoin.id,
        guildId: this.guild.id,
        adapterCreator: voiceChannelToJoin.guild.voiceAdapterCreator,
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
          try {
            connection.destroy()
          } catch {}
        }
      })

      await entersState(connection, VoiceConnectionStatus.Ready, 10_000)

      this.voiceChannel = voiceChannelToJoin
      this.connection = connection
      this.initWebSocketConnection()

      this.connection.receiver.speaking.on('start', (userId: string) => {
        handleUserSpeaking(this, userId)
      })

      return true
    } catch (error) {
      console.error(`[Voice] Failed to join voice channel in guild ${this.guild.id}:`, error)
      return false
    }
  }

  initWebSocketConnection() {
    if (this.ws && this.ws.readyState === Websocket.OPEN) return

    this.ws = new Websocket('ws://localhost:5025')

    this.ws.on('open', () => {
      console.log(`🔗 WebSocket connected to Python server`)
    })

    this.ws.on('message', (data, isBinary) => {
      if (isBinary) return

      try {
        const result = JSON.parse(data.toString())
        const { user: userId, text, is_final } = result

        if (is_final) {
          console.log(`[${userId}]: ${text}`)
        } else if (text) {
          process.stdout.write(`[${userId}][partial] ${text} \r`)
        }
      } catch (err) {
        console.error(`❌ Failed to parse WebSocket message:`, err)
      }
    })

    this.ws.on('close', () => {
      console.log(`❌ WebSocket closed`)
      this.ws = null
    })

    this.ws.on('error', (err: any) => {
      console.error(`⚠️ WebSocket error:`, err.code)
    })
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
              await this.cleanup()
            }
          } catch (error) {
            console.error(`Error fetching channel ${mostUsersChannel}:`, error)
          }
        }, 5 * 60_000)
      }
    }
  }

  async cleanup() {
    console.log(`🧹💨✨ Disconnecting/cleaning up bot from ${this.guild.id}`)
    try {
      await this.musicPlayer.setAutoplay(false)
      await this.musicPlayer.clearQueue()
      await this.musicPlayer.skip()
      this.voiceChannel = null
      this.stopIdleTimer()
      this.connection?.destroy()
      this.activeSpeakers = new Map()
      this.ws.close()
    } catch (err) {}
    this.connection = null
  }
}
