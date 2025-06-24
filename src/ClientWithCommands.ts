import { VoiceConnection } from '@discordjs/voice'
import { Client, ClientOptions, Collection } from 'discord.js'
import { SpotifyManager } from './SpotifyManager'
import { GuildSession } from './GuildSession'

interface ExtendedOptions extends ClientOptions {
  connection?: VoiceConnection
  commands: Collection<string, any>
}
export class ClientWithCommands extends Client {
  public commands
  public spotify: SpotifyManager | null
  public guildSessions: Map<string, GuildSession>

  constructor(options: ExtendedOptions) {
    super(options)
    this.commands = options.commands
    this.spotify = new SpotifyManager()
    this.guildSessions = new Map()
  }

  async init() {
    // console.log('CLIENT INITIATED')
  }
}
