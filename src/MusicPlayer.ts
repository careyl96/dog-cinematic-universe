import {
  AudioPlayer,
  AudioPlayerState,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  VoiceConnection,
} from '@discordjs/voice'
import { ChatInputCommandInteraction, EmbedBuilder, Message } from 'discord.js'
import { fetchYoutubeVideosFromUrlOrQuery, FormattedYoutubeVideo } from './helpers/youtubeHelpers/youtubeHelpers'
import { createUndoButtonRow, NowPlayingEmbedState } from './helpers/embedHelpers'
import { BOT_USER_ID, UNDO } from './constants'
import { Readable } from 'stream'

import { shuffle } from './helpers/otherHelpers'
import { escapeDiscordMarkdown, formatFramedCommand, truncateText } from './helpers/formatterHelpers'
import { cacheAudioResource, getAudioSource } from './helpers/cacheHelpers'
import { getRandomVideos } from './helpers/playerFunctions'
import { cachedTrackCtrl, trackCtrl } from './backend/controllers/Controllers'
import { GuildSession } from './GuildSession'
import { EmbedManager, ExtendedTrack } from './EmbedManager'

interface YoutubeMusicPlayerOptions {
  session: GuildSession
  connection?: VoiceConnection
}

interface PlayAudioFromYoutubeOptions {
  video: ExtendedTrack | FormattedYoutubeVideo
  userId: string
  roulette?: boolean
  overrideCurrentEmbed?: boolean
  interaction?: ChatInputCommandInteraction
}

export type QueueItem = {
  video: FormattedYoutubeVideo | ExtendedTrack
  userId: string
  autoplay?: boolean
}

interface ForcePlayOptions {
  query: string
  userId: string
  overrideCurrentEmbed?: boolean
  interaction?: ChatInputCommandInteraction
}
interface EnqueueOptions {
  query?: string
  videosToQueue?: (ExtendedTrack | FormattedYoutubeVideo)[]
  userId: string
  queueInPosition?: number
  interaction?: any
}

export class YoutubeMusicPlayer {
  private session: GuildSession

  public player: AudioPlayer
  public autoplay: boolean = false
  private _queue: QueueItem[]
  private _volume: number = 0.5
  private _audioResource: AudioResource | null = null

  public track: ExtendedTrack
  public embedManager: EmbedManager
  private shouldPlayNextInQueue: boolean

  constructor({ session }: YoutubeMusicPlayerOptions) {
    this.session = session

    this.player = createAudioPlayer({
      behaviors: {
        maxMissedFrames: 50,
        noSubscriber: NoSubscriberBehavior.Play,
      },
    })
    this._queue = []

    this.track = null
    this.embedManager = new EmbedManager(session)
    this.shouldPlayNextInQueue = true

    this.setupAudioPlayerEventListeners()
  }

  private setupAudioPlayerEventListeners = () => {
    this.player.on('stateChange', async (oldPlayerState: AudioPlayerState, newPlayerState: AudioPlayerState) => {
      if (newPlayerState.status === AudioPlayerStatus.Playing) {
        await this.handleTrackStarted()
      }

      if (newPlayerState.status === AudioPlayerStatus.Paused) {
        await this.handleTrackPaused()
      }
      if (newPlayerState.status === AudioPlayerStatus.Idle) {
        await this.handleTrackFinished()
      }
    })
    this.player.on('error', async (err: Error) => {
      console.error(`AudioPlayer error:`, err)
      await this.embedManager.updateEmbed(NowPlayingEmbedState.Error)
      await cachedTrackCtrl.delete(this.track.id)
    })
  }

  private subscribeToMusicPlayer(interaction?: any) {
    if (!this.session.connection) {
      console.log('aint no connection here')
      if (interaction) throw new Error('Dog is not in a voice channel.')
      return
    }
    if (
      this.session.connection?.state.status === 'ready' &&
      this.session.connection?.state.subscription?.player === this.player
    ) {
      console.log('##### Already subscribed to the music player')
      return
    } else {
      this.session.connection?.subscribe(this.player)
      console.log('##### Subscribed to music player')
    }
  }

  // overrwrite currently playing song
  async forcePlay({ query, userId, overrideCurrentEmbed = false, interaction }: ForcePlayOptions) {
    // This flag prevents the next track from auto-playing when the audio player becomes idle.
    // It's used during force play to avoid overlapping playback of the current and next track.
    this.shouldPlayNextInQueue = false
    if (this.player.state.status === AudioPlayerStatus.Paused) {
      await this.stop({ skip: true, skippedByUserId: userId })
    }

    const useYts = overrideCurrentEmbed ? false : true
    const video = (await fetchYoutubeVideosFromUrlOrQuery({
      session: this.session,
      urlOrQuery: query,
      useYts,
    })) as ExtendedTrack | FormattedYoutubeVideo
    await this.playAudioFromYTVideo({
      video,
      userId,
      overrideCurrentEmbed,
      interaction,
    })
  }

  // takes query or pre-formatted videos
  async enqueue({ query, videosToQueue, userId, queueInPosition, interaction }: EnqueueOptions) {
    if (!query && !videosToQueue) {
      return console.error('No queue input')
    }

    let videos
    if (query) {
      videos = await fetchYoutubeVideosFromUrlOrQuery({
        session: this.session,
        urlOrQuery: query,
        useYts: this.player.state.status === AudioPlayerStatus.Idle,
      })
      if (!videos) {
        console.error('##### No videos found (enqueue)')
        return
      }
    } else if (videosToQueue) {
      videos = videosToQueue
    }

    videos = (Array.isArray(videos) ? videos : [videos]) as FormattedYoutubeVideo[] | ExtendedTrack[]
    const queueItems = videos.map((video) => ({ video, userId }) as QueueItem)

    if (queueInPosition !== undefined && queueInPosition >= 0 && queueInPosition <= this._queue.length) {
      this._queue.splice(queueInPosition, 0, ...queueItems)
    } else {
      this._queue.push(...queueItems)
    }

    if (this.player.state.status === AudioPlayerStatus.Idle) {
      await this.playNextInQueue(interaction)
    } else {
      if (interaction && !interaction.replied) {
        const MAX_DESCRIPTION_LENGTH = 4096

        const embed = new EmbedBuilder().setColor(0xffa200).setAuthor({ name: 'Queue Updated:' })

        let description = ''
        let countIncluded = 0

        for (let i = 0; i < videos.length; i++) {
          const queueIndex = this._queue.length - videos.length + i
          const title = truncateText(escapeDiscordMarkdown(videos[i].title), 60)
          const line = `[${queueIndex + 1}] [${title}](${videos[i].url})\n`

          const remaining = videos.length - (i + 1)
          const suffix = remaining > 0 ? `... and [${remaining}] others` : ''

          // Check if adding this line (plus potential suffix) fits
          if (description.length + line.length + suffix.length > MAX_DESCRIPTION_LENGTH) {
            // If we can't add the line, append suffix if it fits
            if (suffix.length > 0 && description.length + suffix.length <= MAX_DESCRIPTION_LENGTH) {
              description += suffix
            }
            break
          }

          description += line
          countIncluded++
        }

        embed.setDescription(description)

        await interaction.followUp({
          embeds: [embed],
          components: [createUndoButtonRow(UNDO.QUEUE)],
          ephemeral: true,
        })
        const userState = this.session.userStates.get(userId)
        userState.interaction = interaction
        userState.queuedTracks = videos
        userState.addQueueInteraction({ videoId: videos[0].id, interaction })
      }
    }
  }

  async playNextInQueue(interaction?: any) {
    let queueItem = this._queue.shift()

    if (!queueItem) {
      if (!this.autoplay) return

      const videos = await getRandomVideos({ session: this.session })
      if (videos.length === 0) {
        console.error('No valid random video found')
        return
      }

      queueItem = {
        video: videos[0],
        userId: BOT_USER_ID,
      }
    }

    // Play the video (from queue or autoplay)
    await this.playAudioFromYTVideo({
      video: queueItem.video,
      userId: queueItem.userId,
      interaction,
    })
  }

  // core function that converts audio file/stream into audio and plays it through the bot
  // this is always the last function that gets called
  async playAudioFromYTVideo({
    video,
    userId,
    overrideCurrentEmbed = false,
    interaction,
  }: PlayAudioFromYoutubeOptions) {
    if (interaction && !interaction.replied) interaction.deleteReply()

    try {
      await this.session.ensureVoiceConnection(userId)
      this.subscribeToMusicPlayer()
      const track = await trackCtrl.ensureValidTrackDataOrUpsert(video, userId, this.session.guild.id)
      this.embedManager.setTrack({ track, userId })
      this.track = track

      if (!overrideCurrentEmbed) {
        this.resetAudioVolume()
      }

      // override current embed state
      // this only ever triggers when a user clicks the replay or back button on the music embed
      if (overrideCurrentEmbed) {
        // override flag to enable the changing finished/skipped state in embed
        // when finished/skipped state is set on embed, it normally cannot be changed
        this.embedManager.updateEmbed(NowPlayingEmbedState.Loading)
      } else {
        // create a new embed every time playAudioFromYTVideo is called
        this.embedManager.sendInitialEmbed()
      }
      /* -------------------------------------------------------------- */

      const { cachedTrack, audioStream } = await getAudioSource(video)
      cachedTrack && console.log(`💸💸💸💸💸 Fetched ${video.title} (${video.id}) from cache!`)

      const audioResource = createAudioResource(audioStream, {
        inlineVolume: true,
        silencePaddingFrames: 5,
      })
      this.playAudioResource(audioResource)

      if (!cachedTrack && video.liveBroadcastContent === 'none') {
        await cacheAudioResource(audioStream as Readable, video)
      }
    } catch (err) {
      console.log('eroerieorueoruoeiruo')
      throw err
    }
  }

  private resetAudioVolume() {
    this.volume = 0.5
  }

  private playAudioResource = (audioResource: AudioResource) => {
    this._audioResource = audioResource
    audioResource.volume?.setVolume(0.5)
    this.volume = 0.5
    this.player.play(audioResource)
    this.shouldPlayNextInQueue = true
  }

  volDown = () => {
    const newVolume = this.volume - 0.2 <= 0 ? 0.1 : (this.volume -= 0.2)
    this._audioResource?.volume?.setVolume(newVolume)
    this.volume = newVolume
  }

  volUp = () => {
    const newVolume = this.volume + 0.2 >= 3 ? 3 : (this.volume += 0.2)
    this._audioResource?.volume?.setVolume(newVolume)
    this.volume = newVolume
  }

  async handleTrackStarted() {
    this.session.stopIdleTimer()
    await this.embedManager.handlePlay()
  }

  async handleTrackPaused() {
    await this.embedManager.handlePause()
  }

  async handleTrackFinished() {
    await this.session.startIdleTimer()
    await this.embedManager.handleFinished()
    if (this.shouldPlayNextInQueue && !!this.session.connection) await this.playNextInQueue()
  }

  async shuffle() {
    if (this.queue.length >= 2) {
      this.queue = shuffle(this._queue)
    }
  }

  async clearQueue() {
    const queueWasCleared = this._queue.length > 0
    this._queue = []
    return queueWasCleared
  }

  async skip(userId: string = BOT_USER_ID) {
    try {
      this.subscribeToMusicPlayer()
      await this.stop({ skip: true, skippedByUserId: userId })
    } catch (err) {
      throw new Error("Player isn't playing anything!")
    }
  }

  async pause() {
    try {
      if (this.player.state.status !== AudioPlayerStatus.Playing) return
      this.player.pause()
    } catch {
      throw new Error("Player isn't playing anything!")
    }
  }

  async unpause() {
    try {
      this.subscribeToMusicPlayer()
      this.player.unpause()
    } catch {
      throw new Error("Player isn't playing anything!")
    }
  }

  async stop({
    skip = false,
    skippedByUserId = null,
  }: {
    skip?: boolean
    skippedByUserId?: string
  } = {}) {
    try {
      if (skip) {
        this.embedManager.skippedByUserId = skippedByUserId
        formatFramedCommand(`Track skipped by @${skippedByUserId}`)
      }

      this.player.stop(true)
    } catch (e) {
      console.error('Error occurred while stopping the track:', e)

      try {
        await this.embedManager.updateEmbed(NowPlayingEmbedState.Error)
      } catch (embedError) {
        console.error('Failed to update NowPlaying embed after error:', embedError)
      }
    }
  }

  async setAutoplay(autoplay: boolean = this.autoplay) {
    if (this.autoplay === autoplay) return
    this.autoplay = autoplay

    if (this.player.state.status === AudioPlayerStatus.Idle && this.autoplay) {
      await this.playNextInQueue()
      return
    }
  }

  get queue() {
    return this._queue
  }
  set queue(newQueue: QueueItem[]) {
    this._queue = newQueue
  }
  get volume() {
    return this._volume
  }
  set volume(volume: number) {
    this._volume = volume
  }
}
