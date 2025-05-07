import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  VoiceConnection,
} from '@discordjs/voice'
import {
  Client,
  ClientOptions,
  Collection,
  GuildMember,
  MessageFlags,
  TextChannel,
  VoiceBasedChannel,
  VoiceChannel,
} from 'discord.js'
import { createReadStream } from 'fs'
import { Readable } from 'stream'
import { COMMANDS, TEXT_CHANNELS, TRIGGER_PHRASES, TRIGGER_WORDS } from './constants'
import { play, stop, unpause, skip, roulette } from './helpers/playerFunctions'
import { YoutubeMusicPlayer } from './MusicPlayer'
import { clearAudioFolders } from './helpers/clearAudioFolders'
import { analyzeIntent, GroqIntent, masterVoiceAgent } from './helpers/voiceCommandHelpers/agents'
import { createErrorEmbed } from './helpers/embedHelpers'
import { parseCommandWordAndQuery, transcodeUserVoiceInput } from './helpers/voiceCommandHelpers/voiceCommandHelpers'
import {
  flattenCommandList,
  getCurrentTimestamp,
  isSingleWord,
  removeFirstIntentWord,
} from './helpers/formatterHelpers'

interface ExtendedOptions extends ClientOptions {
  connection?: VoiceConnection
  commands: Collection<string, any>
}

type PlayAudioFromFilePathOptions = {
  // not sure about type here
  audioFilePath: string | Readable
  temporarilyOverwriteAudio?: boolean
  force?: boolean
  user?: GuildMember
}

export class ClientWithCommands extends Client {
  public commands
  public connection?
  public voiceChannel?: VoiceBasedChannel | null
  public hasVoiceCommandsEnabled: boolean
  public activeSpeakers: Set<string>
  public player
  public temporaryPlayerQueue: AudioPlayer[]

  public musicPlayer: YoutubeMusicPlayer | null

  constructor(options: ExtendedOptions) {
    super(options)
    this.commands = options.commands
    this.connection = options.connection
    this.voiceChannel = null
    this.hasVoiceCommandsEnabled = false
    this.activeSpeakers = new Set()
    this.player = createAudioPlayer({
      behaviors: {
        maxMissedFrames: 50,
      },
    })
    this.temporaryPlayerQueue = []

    this.musicPlayer = null
  }

  async init() {
    clearAudioFolders()
    const musicTextChannel = (await this.channels.fetch(TEXT_CHANNELS.MUSIC_BOT)) as TextChannel

    this.musicPlayer = new YoutubeMusicPlayer({
      textChannel: musicTextChannel,
    })
  }

  subscribeToClientPlayer() {
    if (!this.connection) throw new Error('Dog is not in a voice channel.')
    if (this.connection?.state.status === 'ready' && this.connection?.state.subscription?.player === this.player) {
      console.log('##### Already subscribed to the audio player')
    } else {
      this.connection.subscribe(this.player)
      console.log('##### Subscribed to audio player')
    }
  }

  async joinVoiceChannel(voiceChannelId: string | undefined, interaction?: any, reconnect: boolean = false) {
    if (this.voiceChannel?.id === voiceChannelId && !reconnect) {
      return
    }

    if (!voiceChannelId) {
      return
    }

    try {
      this.voiceChannel = (await this.channels.fetch(voiceChannelId)) as VoiceBasedChannel

      if (!(this.voiceChannel instanceof VoiceChannel)) {
        throw new Error('Provided channel is not a voice channel.')
      }

      this.connection = joinVoiceChannel({
        channelId: this.voiceChannel.id,
        guildId: this.voiceChannel.guild.id,
        adapterCreator: this.voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: !this.hasVoiceCommandsEnabled,
        selfMute: false,
      })

      this.connection.on('error', (error) => {
        console.error('Voice connection error:', error)
      })

      this.musicPlayer?.setVoiceConnection(this.connection)
    } catch (error) {
      console.error('!!! Error joining voice channel:', error)

      if (interaction && !interaction.replied) {
        interaction.reply(
          createErrorEmbed({
            errorMessage: 'There was an error joining the voice channel; playing command anyways',
            flags: MessageFlags.Ephemeral,
          }) as any
        )
      } else {
        throw new Error('There was an error joining the voice channel')
      }
    }
  }

  ensureVoiceConnection = async (user: GuildMember, interaction?: any) => {
    const currentVoiceChannelId = user.voice?.channelId
    if (this.voiceChannel?.id !== currentVoiceChannelId) {
      await this.joinVoiceChannel(currentVoiceChannelId, interaction)
      if (!this.voiceChannel) {
        if (interaction) {
          throw new Error('Dog is not connected to a voice channel. (ensureVoiceConnection)')
        } else {
          console.error('Dog is not connected to a voice channel. (ensureVoiceConnection)')
          return false
        }
      }
    }
    return true
  }

  async disconnect() {
    console.log('🧹💨✨ Disconnecting/cleaning up bot')
    this.voiceChannel = null
    try {
      this.connection?.destroy()
    } catch (err) {}

    this.musicPlayer?.setVoiceConnection(null)
    await this.musicPlayer?.clearQueue()
    await this.musicPlayer?.stop()
  }
  async migrateToMostPopulatedVoiceChannelOrDisconnect() {
    const voiceChannelIds = [
      '1148443812016963584', // no poors allowed
      '1173363391046352926', // give me content
      '727282992958931066', // anti-social social room
      '1059957383436185700', // 24 hrs of content
      '854513897180102657', // yes we still play runescape
      '1022611880809877616', // bot test realm
      '1022611880809877616', // tfti
    ]

    let channelWithMostUsers = null
    let channelWithMostUsersExcludingBot = null
    let maxUsers = 0
    let maxUsersExcludingBot = 0

    for (const channelId of voiceChannelIds) {
      try {
        const voiceChannel = (await this.channels.fetch(channelId)) as any
        if (!voiceChannel) continue

        const users = voiceChannel.members
        const numUsersInChannel = users.size
        const nonBotUsers = users.filter((member: any) => !member.user.bot).size

        if (nonBotUsers > maxUsersExcludingBot) {
          maxUsersExcludingBot = nonBotUsers
          channelWithMostUsersExcludingBot = channelId
        }

        if (numUsersInChannel > maxUsers) {
          maxUsers = numUsersInChannel
          channelWithMostUsers = channelId
        }
      } catch (error) {
        console.error(`Error fetching channel ${channelId}:`, error)
      }
    }

    if (maxUsersExcludingBot > 0) {
      return this.joinVoiceChannel(channelWithMostUsersExcludingBot)
    }

    if (channelWithMostUsers) {
      setTimeout(async () => {
        try {
          const updatedChannel = (await this.channels.fetch(channelWithMostUsers)) as any
          if (updatedChannel?.members.size === 1) {
            this.disconnect()
          }
        } catch (error) {
          console.error(`Error fetching channel ${channelWithMostUsers}:`, error)
        }
      }, 60000)
    } else {
      this.disconnect()
    }
  }

  async playAudioFromFilePath({ audioFilePath }: PlayAudioFromFilePathOptions) {
    if (!audioFilePath) return
    if (!this.connection) {
      return console.error('Dog is not connected to voice channel (playAudioFromFilePath)')
    }

    const audioResource = createAudioResource(createReadStream(audioFilePath as any), {
      inlineVolume: true,
    })
    audioResource.volume?.setVolume(5)

    let musicPlayerStayPaused = false
    let clientPlayerStayPaused = false

    // pause any currently playing audio (this/musicplayer)
    if (this.musicPlayer?.player.state.status === AudioPlayerStatus.Paused) {
      musicPlayerStayPaused = true
    }

    if (this.player.state.status === AudioPlayerStatus.Paused) {
      clientPlayerStayPaused = true
    } else if (this.player.state.status === AudioPlayerStatus.Playing) {
      this.player.pause()
      this.temporaryPlayerQueue.push(this.player)

      // create new temporary player so we can return to previously playing player
      this.player = createAudioPlayer()
    }

    await this.musicPlayer?.pause()

    setTimeout(() => {
      this.subscribeToClientPlayer()
      this.player.play(audioResource)
    }, 1000)

    const prevPlayer = this.temporaryPlayerQueue.pop()

    this.player.removeAllListeners()

    this.player
      .once(AudioPlayerStatus.Idle, async () => {
        if (prevPlayer) {
          this.player = prevPlayer
          this.subscribeToClientPlayer()
          if (!clientPlayerStayPaused) {
            this.player.unpause()
          }
        }
        if (!musicPlayerStayPaused) {
          await this.musicPlayer?.unpause()
        }
      })
      .on('error', async (err: any) => {
        this.player.stop()
        if (prevPlayer) {
          this.player = prevPlayer
          this.connection?.subscribe(this.player)
          if (!clientPlayerStayPaused) {
            this.player.unpause()
          }
        }
        if (!musicPlayerStayPaused) {
          await this.musicPlayer?.unpause()
        }
        console.error('!!! error in audio player')
      })
  }

  // ----------------------------- VOICE COMMANDS -----------------------------
  setVoiceCommands(value: boolean) {
    this.hasVoiceCommandsEnabled = value
    this.joinVoiceChannel(this.voiceChannel?.id, null, true)
  }

  async handleVoiceCommand(text: string, user: GuildMember) {
    // Ignore common hallucinations
    if (!text || typeof text !== 'string' || ['Thank you.', "We'll be right back."].includes(text)) return
    const chatLog = `>>> [${getCurrentTimestamp()}][${user.nickname || user.displayName}]: ${text.replace('data:', '').trim()}`
    console.log(chatLog)

    const allCommands = flattenCommandList(COMMANDS)
    text = text.toLowerCase().replace(/[^\w\s]/g, '')
    const words = text.split(' ')

    let [commandWord, query] = parseCommandWordAndQuery(words, allCommands)
    let commandMap = this.createCommandMap(user, query)

    if (isSingleWord(text) && allCommands.includes(text)) {
      try {
        await (text === 'play' ? commandMap['unpause'] : commandMap[text])()
      } catch (err) {
        console.error('error in single word command:', err)
      }
      return chatLog
    }

    // If no trigger word at the start, try finding a phrase like "hey dog"
    if (!TRIGGER_WORDS.includes(words[0]!)) {
      let matchedTrigger = ''
      let triggerIndex = -1

      for (const phrase of TRIGGER_PHRASES) {
        const idx = text.lastIndexOf(phrase)
        if (idx > triggerIndex) {
          triggerIndex = idx
          matchedTrigger = phrase
        }
      }

      // Special case: starts with "a dog"
      if (text.startsWith('a dog')) {
        matchedTrigger = 'a dog'
        triggerIndex = 0
      }

      if (triggerIndex === -1) return chatLog

      // Slice *after* the entire matched trigger phrase
      text = text.substring(triggerIndex + matchedTrigger.length).trim()
      ;[commandWord, query] = parseCommandWordAndQuery(text.split(' '), allCommands)
    }

    try {
      const command = `${commandWord} ${query}`
      await this.runSpokenCommand(user, command)
    } catch (err) {
      console.log('error in handleVoicecommand')
    }

    return chatLog
  }

  runSpokenCommand = async (user: any, command: string) => {
    if (command.trim() === 'skip') {
      await skip(user.id)
      return
    }
    try {
      const parsedResponse = await analyzeIntent(command)
      console.log(parsedResponse)
      const intent = parsedResponse?.intent

      if (!intent) {
        console.warn('No intent found in response:', parsedResponse)
        return
      }

      if (intent === 'cancel') return

      const parsedQuery = parsedResponse.original_query
      const commandMap = this.createCommandMap(user, parsedQuery, parsedResponse)
      const commandFn = commandMap[intent]

      if (typeof commandFn === 'function') {
        try {
          await commandFn()
        } catch (commandError) {
          console.error(`Error running command function for intent "${intent}":`, commandError)
          // Optionally fallback to default handler
          await masterVoiceAgent(parsedQuery, intent, user.id)
        }
      } else {
        console.warn(`No matching function found for intent "${intent}". Fallback triggered.`)
        await masterVoiceAgent(parsedQuery, intent, user.id)
      }
    } catch (error) {
      console.error('Error in runSpokenCommand:', error)
    }
  }

  createCommandMap = (user: any, query: string, groqIntent?: GroqIntent): Record<string, () => Promise<any>> => {
    const intents = ['play', 'queue']
    query = removeFirstIntentWord(query, intents)

    const commandMap: Record<string, () => Promise<any>> = {}

    const createAliasGroup = (aliases: string[], action: () => Promise<any>) => {
      for (const alias of aliases) {
        commandMap[alias] = action
      }
    }

    const playCommand = async () => await play({ user, query, force: true })
    const queueCommand = async () => await play({ user, query })
    const stopCommand = async () => await stop()
    const unpauseCommand = async () => await unpause()
    const skipCommand = async () => await skip(user.id)
    const rouletteCommand = async () => await roulette({ userId: user.id, count: parseInt(groqIntent?.count, 10) || 1 })

    createAliasGroup(COMMANDS.PLAY, playCommand)
    createAliasGroup(COMMANDS.QUEUE, queueCommand)
    createAliasGroup(COMMANDS.STOP, stopCommand)
    createAliasGroup(COMMANDS.RESUME, unpauseCommand)
    createAliasGroup(COMMANDS.SKIP, skipCommand)
    createAliasGroup(COMMANDS.ROULETTE, rouletteCommand)

    commandMap['play_after'] = async () => await play({ user, query, queueInPosition: 0 })
    commandMap['clear'] = async () => await this.musicPlayer?.clearQueue()

    return commandMap
  }

  async listenForVoiceCommands() {
    if (!this.connection) return

    this.connection?.receiver.speaking.removeAllListeners()
    if (this.hasVoiceCommandsEnabled) {
      this.connection?.receiver.speaking.on('start', async (userId) => {
        const user = this.voiceChannel!.guild.members.cache.get(userId)
        const responseText = await transcodeUserVoiceInput(this, user!)
        await this.handleVoiceCommand(responseText, user)
      })
    }
  }
}
