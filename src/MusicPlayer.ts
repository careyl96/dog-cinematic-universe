import path, { format } from 'path'
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
import { createYoutubeAudioStream } from './helpers/youtubeHelpers/youtubeHelpers'
import { ChatInputCommandInteraction, Message, TextChannel } from 'discord.js'
import { fetchYoutubeVideosFromUrlOrQuery } from './helpers/youtubeHelpers/youtubeHelpers'
import { createQueueEmbed, createYoutubeEmbed, NowPlayingEmbedState } from './helpers/embedHelpers'
import { BOT_USER_ID, PATH } from './constants'
import { Readable } from 'stream'
import { FormattedYoutubeVideo } from './helpers/youtubeHelpers/youtubeFormatterHelpers'
import { updateHistoryFile } from './helpers/musicDataHelpers'
import { getGuildMember, shuffle } from './helpers/otherHelpers'
import {
  formatFramedCommand,
  getCurrentTimestamp,
  isoToTimestamp,
  parseISODurationToMs,
  roundPercentage,
} from './helpers/formatterHelpers'
import { cacheAudioResource, getAudioSource } from './helpers/cacheHelpers'
import { getRandomVideo } from './helpers/playerFunctions'

interface YoutubeMusicPlayerOptions {
  connection?: VoiceConnection
  textChannel: TextChannel
}

interface PlayAudioFromYoutubeOptions {
  video: FormattedYoutubeVideo
  userId: string
  saveToHistory: boolean
  roulette?: boolean
  overrideCurrentEmbed?: boolean
  interaction?: ChatInputCommandInteraction
}

export type QueueItem = {
  video: FormattedYoutubeVideo
  userId: string
  saveToHistory: boolean
  roulette?: boolean
  autoplay?: boolean
}

export type TrackTimer = {
  elapsedTime?: number | null
  elapsedTimerRunning?: boolean | null
  elapsedPercentage?: number | null
  startTimestamp?: number | null
  baseElapsed?: number | null
  latestUpdateId?: number | null
  isUpdating?: boolean | null
  nextExpectedTime?: number | null
}

interface ForcePlayOptions {
  query: string
  userId: string
  overrideCurrentEmbed?: boolean
  saveToHistory: boolean
  interaction?: ChatInputCommandInteraction
}
interface EnqueueOptions {
  query?: string
  videosToQueue?: FormattedYoutubeVideo | FormattedYoutubeVideo[]
  userId: string
  saveToHistory: boolean
  roulette?: boolean
  queueInPosition?: number
  interaction?: ChatInputCommandInteraction
}

export interface NowPlayingEmbedInfo {
  message: Message
  video: any
  userId: string
  state: NowPlayingEmbedState
  saveToHistory: boolean
  roulette?: boolean
  playNextInQueue?: boolean
  skippedByUserId?: string
}

export class YoutubeMusicPlayer {
  private connection: VoiceConnection
  private _textChannel: TextChannel

  public player: AudioPlayer
  public autoplay: boolean = false
  private _queue: QueueItem[]
  private _currentlyPlaying: QueueItem
  private _volume: number = 0.5
  private _audioResource: AudioResource | null = null
  private _trackTimer: TrackTimer

  private _nowPlayingEmbedInfo: NowPlayingEmbedInfo = {
    message: null,
    video: null,
    userId: null,
    state: null,
    saveToHistory: null,
    roulette: null,
    playNextInQueue: null,
    skippedByUserId: null,
  }
  private queueEmbedInfo: any = {
    message: null,
  }

  constructor({ connection, textChannel }: YoutubeMusicPlayerOptions) {
    this.connection = connection || null
    this._textChannel = textChannel!

    this.player = createAudioPlayer({
      behaviors: {
        maxMissedFrames: 50,
        noSubscriber: NoSubscriberBehavior.Play,
      },
    })
    this._queue = []
    this.currentlyPlaying = {
      video: null,
      userId: null,
      saveToHistory: false,
      roulette: false,
    }
    this._trackTimer = {
      elapsedTime: null,
      elapsedTimerRunning: false,
      elapsedPercentage: null,
      startTimestamp: 0,
      baseElapsed: 0,
      latestUpdateId: null,
      isUpdating: false,
      nextExpectedTime: null,
    }

    this.setupAudioPlayerEventListeners()
  }

  private setupAudioPlayerEventListeners = () => {
    this.player.on('stateChange', async (oldPlayerState: AudioPlayerState, newPlayerState: AudioPlayerState) => {
      if (newPlayerState.status === AudioPlayerStatus.Playing) {
        await this.startElapsedTimer()
        await this.editNowPlayingEmbed({ state: NowPlayingEmbedState.Playing })
        console.log(
          `[${getCurrentTimestamp()}] 🎹 Now playing: ${this._currentlyPlaying?.video?.title} (id: ${this._currentlyPlaying?.video?.id})`
        )
      }

      if (newPlayerState.status === AudioPlayerStatus.Paused) {
        this.pauseElapsedTimer()
        this.editNowPlayingEmbed({ state: NowPlayingEmbedState.Paused })
      }
      if (newPlayerState.status === AudioPlayerStatus.Idle) {
        await this.handleTrackFinished()
      }
    })
    this.player.on('error', async (err: Error) => {
      console.error(`AudioPlayer error:`, err)
      await this.editNowPlayingEmbed({ state: NowPlayingEmbedState.Error, error: err })
      await this.stop()
    })
  }

  async startElapsedTimer() {
    if (this._trackTimer.elapsedTimerRunning) return
    this._trackTimer.elapsedTimerRunning = true
    this._trackTimer.latestUpdateId = 0
    this._trackTimer.startTimestamp = Date.now()
    this._trackTimer.baseElapsed ??= 0
    await this.runElapsedTimerLoop()
  }

  pauseElapsedTimer() {
    if (!this._trackTimer.elapsedTimerRunning) return

    const now = Date.now()
    const delta = now - (this._trackTimer.startTimestamp ?? now)
    this._trackTimer.baseElapsed += delta
    this._trackTimer.elapsedTimerRunning = false
    this._trackTimer.startTimestamp = null
  }

  getAccurateElapsedTime(): number {
    const base = this._trackTimer.baseElapsed ?? 0
    if (!this._trackTimer.elapsedTimerRunning || !this._trackTimer.startTimestamp) {
      console.log(this._trackTimer.elapsedTimerRunning)
      console.log(this._trackTimer.startTimestamp)
      return base
    }

    return base + (Date.now() - this._trackTimer.startTimestamp)
  }

  runElapsedTimerLoop() {
    const now = Date.now()
    if (this.player.state.status === AudioPlayerStatus.Playing) {
      const duration = parseISODurationToMs(this._nowPlayingEmbedInfo.video?.duration)
      const accurateElapsed = this.getAccurateElapsedTime()

      this._trackTimer.elapsedTime = accurateElapsed

      const newPercentage = roundPercentage(accurateElapsed, duration)
      this._trackTimer.elapsedPercentage = newPercentage

      this.tryUpdateNowPlayingEmbedTimer()
    }

    // Update expected time for next tick
    this._trackTimer.nextExpectedTime ??= now + 1000
    this._trackTimer.nextExpectedTime += 1000

    const delay = Math.max(0, this._trackTimer.nextExpectedTime - Date.now())
    setTimeout(() => this.runElapsedTimerLoop(), delay)
  }

  async tryUpdateNowPlayingEmbedTimer() {
    if (this.player.state.status !== AudioPlayerStatus.Playing) return
    const updateId = ++this._trackTimer.latestUpdateId

    if (!this._trackTimer.isUpdating) {
      this._trackTimer.isUpdating = true
      try {
        await this.editNowPlayingEmbedProgress()
      } catch (err) {
        console.error('Embed update failed:', err)
      } finally {
        this._trackTimer.isUpdating = false

        if (updateId !== this._trackTimer.latestUpdateId) {
          // Defer next update attempt
          setTimeout(() => this.tryUpdateNowPlayingEmbedTimer(), 0)
        }
      }
    }
  }

  async editNowPlayingEmbedProgress() {
    if (
      this.player.state.status !== AudioPlayerStatus.Playing ||
      this._nowPlayingEmbedInfo.state === NowPlayingEmbedState.Finished ||
      this._nowPlayingEmbedInfo.state === NowPlayingEmbedState.Skipped ||
      this._nowPlayingEmbedInfo.state === NowPlayingEmbedState.Error
    ) {
      return
    }

    await this._nowPlayingEmbedInfo.message
      ?.edit(
        createYoutubeEmbed({
          ...this._nowPlayingEmbedInfo,
          state: NowPlayingEmbedState.Playing,
        })
      )
      .catch((err: any) => {
        console.error(err.message)
      })
  }

  clearAudioInterval = () => {
    this._trackTimer.elapsedTime = null
    this._trackTimer.elapsedTimerRunning = false
    this._trackTimer.elapsedPercentage = null
    this._trackTimer.startTimestamp = null
    this._trackTimer.baseElapsed = null
    this._trackTimer.latestUpdateId = null
    this._trackTimer.isUpdating = null
  }

  private subscribeToMusicPlayer(interaction?: any) {
    if (!this.connection) {
      if (interaction) throw new Error('Dog is not in a voice channel.')
      return
    }
    if (this.connection?.state.status === 'ready' && this.connection?.state.subscription?.player === this.player) {
      // console.log('##### Already subscribed to the music player')
      return
    } else {
      this.connection?.subscribe(this.player)
      // console.log('##### Subscribed to music player')
    }
  }

  setVoiceConnection(connection?: VoiceConnection) {
    this.connection = connection || null
    this.subscribeToMusicPlayer()
  }

  // overrwrite currently playing song
  async forcePlay({ query, userId, overrideCurrentEmbed = false, saveToHistory, interaction }: ForcePlayOptions) {
    const useYts = overrideCurrentEmbed ? false : true
    const video = (await fetchYoutubeVideosFromUrlOrQuery({
      urlOrQuery: query,
      useYts,
      interaction,
    })) as any
    // this flag prevents the next track from auto-playing once the audio player is idle
    // we want to prevent this when force playing because otherwise both the song we are trying to play
    // as well as the next song in the queue overlap
    this._nowPlayingEmbedInfo.playNextInQueue = false
    await this.playAudioFromYTVideo({
      video,
      userId,
      overrideCurrentEmbed,
      saveToHistory,
      interaction,
    })
  }

  // takes query or pre-formatted videos
  async enqueue({
    query,
    videosToQueue,
    userId,
    saveToHistory,
    roulette = false,
    queueInPosition,
    interaction,
  }: EnqueueOptions) {
    if (!query && !videosToQueue) {
      return console.error('No queue input')
    }

    let videos: FormattedYoutubeVideo | FormattedYoutubeVideo[]
    if (query) {
      videos = await fetchYoutubeVideosFromUrlOrQuery({
        urlOrQuery: query,
        useYts: this.player.state.status === AudioPlayerStatus.Idle,
        interaction,
      })
      if (!videos) {
        console.error('##### Error with video(s)')
        return
      }
    } else if (videosToQueue) {
      videos = videosToQueue
    }

    videos = Array.isArray(videos) ? videos : [videos]
    const queueItems = videos.map((video) => ({ video, userId, saveToHistory, roulette }) as QueueItem)

    if (queueInPosition !== undefined && queueInPosition >= 0 && queueInPosition <= this._queue.length) {
      this._queue.splice(queueInPosition, 0, ...queueItems)
    } else {
      this._queue.push(...queueItems)
    }

    if (this.player.state.status === AudioPlayerStatus.Idle) {
      await this.playNextInQueue(interaction)
    } else {
      if (interaction && !interaction.replied) interaction.deleteReply()
    }
  }

  async playNextInQueue(interaction?: any) {
    let queueItem = this._queue.shift()
    if (!queueItem) {
      if (!this.autoplay) return

      const video = await getRandomVideo()
      queueItem = {
        video,
        userId: BOT_USER_ID,
        saveToHistory: false,
      }
    }

    await this.playAudioFromYTVideo({
      video: queueItem.video,
      userId: queueItem.userId,
      saveToHistory: queueItem.saveToHistory,
      roulette: queueItem.roulette,
      interaction,
    })
  }

  // core function that converts audio file/stream into audio and plays it through the bot
  // this is always the last function that gets called
  async playAudioFromYTVideo({
    video,
    userId,
    saveToHistory = false,
    roulette = false,
    overrideCurrentEmbed = false,
    interaction,
  }: PlayAudioFromYoutubeOptions) {
    this.subscribeToMusicPlayer(interaction)
    try {
      this.clearAudioInterval()
      if (!overrideCurrentEmbed) {
        this.resetAudioVolume()
      }

      if (interaction && !interaction.replied) interaction.deleteReply()
      // override current embed state
      // this only ever triggers when a user clicks the replay button on the music embed
      // for every other case a new embed is created when play is called
      if (overrideCurrentEmbed) {
        // override flag to enable the changing finished/skipped state in embed
        // when finished/skipped state is set on embed, it normally cannot be changed
        this.editNowPlayingEmbed({ state: NowPlayingEmbedState.Loading, override: true })
      } else {
        const embedInfo = {
          video,
          userId,
          state: NowPlayingEmbedState.Loading,
          roulette,
        }

        // create a new embed every time play is called
        this._textChannel
          ?.send(
            createYoutubeEmbed({
              ...embedInfo,
            })
          )
          .then(async (message) => {
            this.nowPlayingEmbedInfo = {
              ...embedInfo,
              message,
              saveToHistory,
            }

            this.currentlyPlaying = {
              video,
              userId,
              saveToHistory,
            }
          })
      }
      /* -------------------------------------------------------------- */

      const audioSource = await getAudioSource(video)
      const audioResource = createAudioResource(audioSource, {
        inlineVolume: true,
        silencePaddingFrames: 5,
      })
      this.playAudioResource(audioResource)

      if (typeof audioSource === 'string') {
        formatFramedCommand(`Successfully retrieved ${video.title} from cache`)
      }

      if (typeof audioSource !== 'string') {
        cacheAudioResource(audioSource as Readable, video)
      }
    } catch (err) {
      console.error(err)
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
    // Set the flag back to true to resume normal queue behavior
    // (gets set to false in this.forcePlay to avoid audio player on idle event trigger, which plays the next track in the queue)
    this._nowPlayingEmbedInfo.playNextInQueue = true
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

  async handleTrackFinished() {
    const { saveToHistory, playNextInQueue, skippedByUserId } = this._nowPlayingEmbedInfo
    const { video, userId } = this._currentlyPlaying

    if (saveToHistory) this.updateMusicHistory(video, userId)

    if (this._nowPlayingEmbedInfo.skippedByUserId) {
      await this.editNowPlayingEmbed({ state: NowPlayingEmbedState.Skipped, skippedByUserId })
    } else {
      await this.editNowPlayingEmbed({ state: NowPlayingEmbedState.Finished })
    }
    if (this.queueEmbedInfo.message) await this.deleteQueueEmbed()
    this.clearAudioInterval()
    if (playNextInQueue) await this.playNextInQueue()
  }

  async deleteQueueEmbed() {
    await this.queueEmbedInfo.message?.delete().catch((err: any) => console.error(err.message))
    this.queueEmbedInfo.message = null
  }

  async shuffle(userId: string) {
    if (this.queue.length >= 2) {
      this.queue = shuffle(this._queue)
    }
  }

  async clearQueue() {
    this._queue = []
  }

  async skip(userId: string) {
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
        this._nowPlayingEmbedInfo.skippedByUserId = skippedByUserId
        this._nowPlayingEmbedInfo.saveToHistory = false

        formatFramedCommand(`Track skipped by @${skippedByUserId}`)
      }

      this.player.stop(true)
      await this.deleteQueueEmbed()
    } catch (e) {
      console.error('Error occurred while stopping the track:', e)

      try {
        await this.editNowPlayingEmbed({
          state: NowPlayingEmbedState.Error,
          error: e,
        })
      } catch (embedError) {
        console.error('Failed to update NowPlaying embed after error:', embedError)
      }
    }
  }

  async editNowPlayingEmbed({
    state = this._nowPlayingEmbedInfo.state,
    skippedByUserId,
    error,
    override = false, // normally prevent state changes after "finished state"
  }: {
    state: NowPlayingEmbedState
    skippedByUserId?: string
    error?: any
    override?: boolean
  }) {
    if (state === this._nowPlayingEmbedInfo.state || !this._nowPlayingEmbedInfo.message) {
      return
    }

    if (override) {
      this._nowPlayingEmbedInfo.state = state
      await this._nowPlayingEmbedInfo.message
        ?.edit(
          createYoutubeEmbed({
            ...this._nowPlayingEmbedInfo,
            state,
          })
        )
        .catch((err: any) => {
          console.error(err.message)
        })
      return state
    }

    if (this._nowPlayingEmbedInfo.state === NowPlayingEmbedState.Finished) {
      return state
    } else if (this._nowPlayingEmbedInfo.state === NowPlayingEmbedState.Skipped) {
      return state
    } else if (this._nowPlayingEmbedInfo.state === NowPlayingEmbedState.Error) {
      return state
    }
    this._nowPlayingEmbedInfo.state = state

    await this._nowPlayingEmbedInfo.message
      ?.edit(
        createYoutubeEmbed({
          ...this._nowPlayingEmbedInfo,
          state: state,
          skippedByUserId,
        })
      )
      .catch((err: any) => {
        console.error(err.message)
      })
    return state
  }

  async handleAutoplay(autoplay: boolean = this.autoplay) {
    if (this.autoplay === autoplay) return
    this.autoplay = autoplay
    formatFramedCommand(`Autoplay is now ${autoplay ? 'enabled' : 'disabled'}`)

    if (this.player.state.status === AudioPlayerStatus.Idle && this.autoplay) {
      await this.playNextInQueue()
      return
    }

    await this._nowPlayingEmbedInfo.message
      ?.edit(
        createYoutubeEmbed({
          ...this._nowPlayingEmbedInfo,
        })
      )
      .catch((err: any) => {
        console.error(err.message)
      })
  }

  updateMusicHistory(video: FormattedYoutubeVideo, userId: string) {
    const userPath = path.join(PATH.USER_DATA, `${userId}/music_queue_history.json`)
    const globalPath = path.join(PATH.USER_DATA, `${BOT_USER_ID}/music_queue_history.json`)

    updateHistoryFile(userPath, video)
    updateHistoryFile(globalPath, video)
  }

  // ===========================================================================================

  get textChannel() {
    return this._textChannel
  }

  get queue() {
    return this._queue
  }
  set queue(newQueue: QueueItem[]) {
    this._queue = newQueue
  }
  get currentlyPlaying() {
    return this._currentlyPlaying
  }
  set currentlyPlaying({ video, userId, saveToHistory }: QueueItem) {
    this._currentlyPlaying = {
      video,
      userId,
      saveToHistory,
    }
  }

  get trackTimer() {
    return this._trackTimer
  }
  set trackTimer({
    elapsedTime = null,
    elapsedTimerRunning = false,
    elapsedPercentage = null,
    startTimestamp = 0,
    baseElapsed = 0,
    latestUpdateId = null,
    isUpdating = false,
    nextExpectedTime = null,
  }: TrackTimer) {
    this._trackTimer = {
      elapsedTime,
      elapsedTimerRunning,
      elapsedPercentage,
      startTimestamp,
      baseElapsed,
      latestUpdateId,
      isUpdating,
      nextExpectedTime,
    }
  }

  get nowPlayingEmbedInfo() {
    return this._nowPlayingEmbedInfo
  }
  set nowPlayingEmbedInfo({
    message,
    video,
    userId,
    state,
    saveToHistory,
    roulette,
    playNextInQueue = true,
  }: NowPlayingEmbedInfo) {
    this._nowPlayingEmbedInfo = { message, video, userId, state, saveToHistory, roulette, playNextInQueue }
  }
  get volume() {
    return this._volume
  }
  set volume(volume: number) {
    this._volume = volume
  }
}
