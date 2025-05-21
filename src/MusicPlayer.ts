import path from 'path'
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
import { shuffle } from './helpers/otherHelpers'
import {
  formatFramedCommand,
  getCurrentTimestamp,
  isoToTimestamp,
  parseISODurationToMs,
  roundPercentage,
} from './helpers/formatterHelpers'
import { cacheAudioResource, getAudioFileFromCache } from './helpers/cacheHelpers'

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
}

export type CurrentlyPlaying = QueueItem & {
  elapsedInterval?: NodeJS.Timeout
  elapsedTime?: number
  elapsedPercentage?: number
  isPaused?: boolean
  latestUpdateId?: number
  isUpdating?: boolean
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

interface NowPlayingEmbedInfo {
  message: Message
  video: any
  userId: string
  state: NowPlayingEmbedState
  saveToHistory: boolean
  roulette?: boolean
  playNextInQueue?: boolean
}

export class YoutubeMusicPlayer {
  private connection: VoiceConnection
  private _textChannel: TextChannel

  public player: AudioPlayer
  private _queue: QueueItem[]
  private _currentlyPlaying: CurrentlyPlaying

  private _nowPlayingEmbedInfo: NowPlayingEmbedInfo = {
    message: null,
    video: null,
    userId: null,
    state: null,
    saveToHistory: null,
    roulette: null,
    playNextInQueue: null,
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
    this._currentlyPlaying = {
      video: null,
      userId: null,
      saveToHistory: false,
      roulette: false,
      elapsedInterval: null,
      elapsedTime: 0,
      elapsedPercentage: null,
      isPaused: null,
    }

    this.setupAudioPlayerEventListeners()
  }

  private setupAudioPlayerEventListeners = () => {
    this.player.on('stateChange', async (oldPlayerState: AudioPlayerState, newPlayerState: AudioPlayerState) => {
      await this.handleTrackInterval(newPlayerState)
      console.log(`AudioPlayer state changed from ${oldPlayerState.status} to ${newPlayerState.status}`)

      if (newPlayerState.status === AudioPlayerStatus.Playing) {
        await this.editNowPlayingEmbed({ state: NowPlayingEmbedState.Playing })

        const skipReaction = this._nowPlayingEmbedInfo.message.reactions.cache.get('⏭️')
        if (!skipReaction) {
          const replayReaction = this._nowPlayingEmbedInfo.message.reactions.cache.get('🔁')
          await replayReaction?.users.remove().catch(console.error)
          await this._nowPlayingEmbedInfo.message.react('⏭️')
          await this._nowPlayingEmbedInfo.message.react('🔁')
        }
        console.log(
          `[${getCurrentTimestamp()}] 🎹 Now playing: ${this._currentlyPlaying?.video?.title} (id: ${this._currentlyPlaying?.video?.id})`
        )
      }

      if (newPlayerState.status === AudioPlayerStatus.Paused) {
        await this.editNowPlayingEmbed({ state: NowPlayingEmbedState.Paused })
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

  private handleTrackInterval = async (state: AudioPlayerState) => {
    const currentlyPlaying = this.currentlyPlaying
    const duration = parseISODurationToMs(this._nowPlayingEmbedInfo.video?.duration)
    if (!duration) return

    switch (state.status) {
      case AudioPlayerStatus.Playing: {
        this._currentlyPlaying.isPaused = false
        if (!currentlyPlaying.elapsedInterval) {
          this._currentlyPlaying.elapsedInterval = setInterval(() => this.updateElapsedTimer(), 1000)
        }
        break
      }

      case AudioPlayerStatus.Paused: {
        this._currentlyPlaying.isPaused = true
        break
      }

      case AudioPlayerStatus.Idle: {
        this.clearAudioInterval()
        break
      }
    }
  }
  async tryUpdateEmbedTimer() {
    const updateId = ++this._currentlyPlaying.latestUpdateId

    if (!this._currentlyPlaying.isUpdating) {
      this._currentlyPlaying.isUpdating = true
      try {
        await this.editNowPlayingEmbedProgress()
      } catch (err) {
        console.error('Embed update failed:', err)
      } finally {
        this._currentlyPlaying.isUpdating = false

        if (updateId !== this._currentlyPlaying.latestUpdateId) {
          // setTimeout(..., 0) defers the next update to the next event loop tick
          setTimeout(() => this.tryUpdateEmbedTimer(), 0)
        }
      }
    }
  }

  updateElapsedTimer() {
    if (this.currentlyPlaying?.isPaused) return
    const duration = parseISODurationToMs(this._nowPlayingEmbedInfo.video?.duration)

    this._currentlyPlaying.elapsedTime += 1000

    const newPercentage = roundPercentage(this._currentlyPlaying.elapsedTime, duration)    
    this._currentlyPlaying.elapsedPercentage = newPercentage

    this.tryUpdateEmbedTimer()
  }

  clearAudioInterval = () => {
    clearInterval(this._currentlyPlaying.elapsedInterval)
    this._currentlyPlaying.elapsedTime = 0
    this._currentlyPlaying.elapsedInterval = null
    this._currentlyPlaying.elapsedPercentage = null
    this._currentlyPlaying.latestUpdateId = null
    this._currentlyPlaying.isUpdating = false
  }

  private subscribeToMusicPlayer(interaction?: any) {
    if (!this.connection) {
      console.error('Dog is not in a voice channel.')
      if (interaction) throw new Error('Dog is not in a voice channel.')
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
      await this.sendOrUpdateQueueEmbed()

      if (interaction && !interaction.replied) interaction.deleteReply()
    }
  }

  async playNextInQueue(interaction?: any) {
    const queueItem = this._queue.shift()
    if (!queueItem) return

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

      if (interaction && !interaction.replied) interaction.deleteReply()
      // override current embed state
      // this only ever triggers when a user clicks the replay button on the music embed
      // for every other case a new embed is created when play is called
      if (overrideCurrentEmbed) {
        // override flag to enable the changing finished/skipped state in embed
        // when finished/skipped state is set on embed, it normally cannot be changed
        await this.editNowPlayingEmbed({ state: NowPlayingEmbedState.Loading, override: true })
      } else {
        const embedInfo = {
          video,
          userId,
          state: NowPlayingEmbedState.Loading,
          roulette,
        }

        // create a new embed every time play is called
        await this._textChannel
          ?.send({
            embeds: [
              createYoutubeEmbed({
                ...embedInfo,
              }),
            ],
          })
          .then(async (message) => {
            this._nowPlayingEmbedInfo = {
              ...embedInfo,
              message,
              saveToHistory,
            }

            this.currentlyPlaying = {
              video,
              userId,
              saveToHistory,
            }
            await message.react('❤️')
            await message.react('🚫')
            await message.react('⏭️')
            await message.react('🔁')
            this.sendOrUpdateQueueEmbed()
          })
      }
      /* -------------------------------------------------------------- */

      const audioSource = await this.getAudioSource(video)
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

  private playAudioResource = (audioResource: AudioResource) => {
    audioResource.volume?.setVolume(0.5)
    this.player.play(audioResource)
    // Set the flag back to true to resume normal queue behavior
    // (gets set to false in this.forcePlay to avoid audio player on idle event trigger, which plays the next track in the queue)
    this._nowPlayingEmbedInfo.playNextInQueue = true
  }

  async handleTrackFinished() {
    const { saveToHistory, playNextInQueue } = this._nowPlayingEmbedInfo
    const { video, userId } = this._currentlyPlaying

    if (saveToHistory) this.updateMusicHistory(video, userId)
    await this.editNowPlayingEmbed({ state: NowPlayingEmbedState.Finished })
    if (this.queueEmbedInfo.message) await this.deleteQueueEmbed()
    // Remove embed if the bot is the one who played the song (hourly music ready.ts)
    if (userId === BOT_USER_ID) {
      this.nowPlayingEmbedInfo.message?.delete()
    }

    if (playNextInQueue) await this.playNextInQueue()
  }

  async sendOrUpdateQueueEmbed() {
    const numItemsToDisplay = 8
    const queueItemText = this._queue
      .slice(0, numItemsToDisplay)
      .map(
        (item, index) =>
          `‎ [${index + 1}] ‎ [${item.video.title}](${item.video.url}) - (${isoToTimestamp(item.video.duration)}) <@${item.userId}>`
      )
      .join('\n')

    let queueEmbedText =
      this._queue.length > numItemsToDisplay
        ? `${queueItemText}\n... and ${this._queue.length - numItemsToDisplay} more!`
        : queueItemText

    const latestMessages = await this._textChannel.messages.fetch({ limit: 2 })
    const latestMessageWithEmbed = latestMessages.find((msg) => msg.embeds.length > 0)

    // If no embed exists and queue has enough items, post new embed
    if (!this.queueEmbedInfo.message && this._queue.length >= 1) {
      await this._textChannel
        ?.send({
          embeds: [createQueueEmbed({ text: queueEmbedText })],
        })
        .then((message) => {
          this.queueEmbedInfo.message = message
        })
    }
    // If there's an embed and queue is too short, remove it
    else if (this.queueEmbedInfo.message && this._queue.length < 1) {
      await this.deleteQueueEmbed()
      this.queueEmbedInfo.message = null
    }
    // If the embed is not the latest message with an embed, delete and repost it
    else if (this.queueEmbedInfo.message && latestMessageWithEmbed?.id !== this.queueEmbedInfo.message.id) {
      await this.deleteQueueEmbed()

      await this._textChannel
        ?.send({
          embeds: [createQueueEmbed({ text: queueEmbedText })],
        })
        .then((message) => {
          this.queueEmbedInfo.message = message
        })
    }
    // Otherwise, just update the existing embed
    else if (this.queueEmbedInfo.message) {
      this.queueEmbedInfo.message
        .edit({
          embeds: [createQueueEmbed({ text: queueEmbedText })],
        })
        .catch((err: any) => console.error(err.message))
    }
  }

  async deleteQueueEmbed() {
    await this.queueEmbedInfo.message?.delete().catch((err: any) => console.error(err.message))
    this.queueEmbedInfo.message = null
  }

  async shuffle(userId: string) {
    if (this.queue.length >= 2) {
      this.queue = shuffle(this._queue)
      await this.sendOrUpdateQueueEmbed()
    }
  }

  async clearQueue() {
    this._queue = []
    await this.sendOrUpdateQueueEmbed()
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
    error = null,
  }: {
    skip?: boolean
    skippedByUserId?: string
    playNextInQueue?: boolean
    error?: any
  } = {}) {
    let state: NowPlayingEmbedState = NowPlayingEmbedState.Finished

    try {
      if (error) {
        state = NowPlayingEmbedState.Error
      }

      if (skip) {
        this._nowPlayingEmbedInfo.saveToHistory = false
        state = NowPlayingEmbedState.Skipped
        formatFramedCommand(`Track skipped by <@${skippedByUserId}>`)
      }

      // always call editNowPlayingEmbed before calling this.player.stop()
      // if not, the audio player on idle event handler will trigger first
      // the audio player event handler calls handleTrackFinished which also calls editNowPlayingEmbed
      // this locks the embed state and makes it so we cannot set 'skipped' or 'error' states
      await this.editNowPlayingEmbed({ state, skippedByUserId, error })

      // Stop the player
      this.player.stop()

      // Delete the queue embed
      await this.deleteQueueEmbed()
    } catch (e) {
      console.error('Error occurred while stopping the track:', e)

      // Fallback attempt to show error state in embed if initial embed update fails
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
        ?.edit({
          embeds: [
            createYoutubeEmbed({
              ...this._nowPlayingEmbedInfo,
              state,
            }),
          ],
        })
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

    // On track finish, handle reactions (music controls)
    if (
      state === NowPlayingEmbedState.Finished ||
      state === NowPlayingEmbedState.Skipped ||
      state === NowPlayingEmbedState.Error
    ) {
      // When track is finished, remove the skip reaction
      const skipReaction = this.nowPlayingEmbedInfo.message.reactions.cache.get('⏭️')
      if (skipReaction) skipReaction.users.remove(BOT_USER_ID).catch(console.error)
    }

    // This block is basically only used when a user uses the repeat track function
    if (state === NowPlayingEmbedState.Loading) {
      const skipReaction = this.nowPlayingEmbedInfo.message.reactions.cache.get('⏭️')
      if (skipReaction) {
        skipReaction.users.cache.forEach((user) => {
          if (user.id !== BOT_USER_ID) {
            skipReaction.users.remove(user.id).catch(console.error)
          }
        })
      }
      try {
        await this._nowPlayingEmbedInfo.message.react('⏭️')
      } catch (err) {
        console.error(err)
      }
    }

    await this._nowPlayingEmbedInfo.message
      ?.edit({
        embeds: [
          createYoutubeEmbed({
            ...this._nowPlayingEmbedInfo,
            state: state,
            skippedByUserId,
          }),
        ],
      })
      .catch((err: any) => {
        console.error(err.message)
      })
    return state
  }

  async editNowPlayingEmbedProgress() {
    if (
      this.player.state.status !== AudioPlayerStatus.Playing ||
      this._nowPlayingEmbedInfo.state === NowPlayingEmbedState.Finished ||
      this._nowPlayingEmbedInfo.state === NowPlayingEmbedState.Skipped ||
      this._nowPlayingEmbedInfo.state === NowPlayingEmbedState.Error
    )
      return

    await this._nowPlayingEmbedInfo.message
      ?.edit({
        embeds: [
          createYoutubeEmbed({
            ...this._nowPlayingEmbedInfo,
          }),
        ],
      })
      .catch((err: any) => {
        console.error(err.message)
      })
  }

  private getAudioSource = async (video: FormattedYoutubeVideo) => {
    // either returns an ogg file from cache or stream
    // const cachedFilePath = getAudioFileFromCache(video.id)
    // const youtubeAudioStream = await createYoutubeAudioStream(video)
    return getAudioFileFromCache(video.id) || (await createYoutubeAudioStream(video))
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
  set currentlyPlaying({
    video,
    userId,
    saveToHistory,
    elapsedTime = 0,
    elapsedInterval = null,
    isPaused = true,
    latestUpdateId = null,
    isUpdating = false,
  }: CurrentlyPlaying) {
    this._currentlyPlaying = {
      video,
      userId,
      saveToHistory,
      elapsedTime,
      elapsedInterval,
      isPaused,
      latestUpdateId,
      isUpdating,
    }
  }

  get nowPlayingEmbedInfo() {
    return this._nowPlayingEmbedInfo
  }
  set nowPlayingEmbedInfo({ message, video, userId, state, saveToHistory, roulette }: NowPlayingEmbedInfo) {
    this._nowPlayingEmbedInfo = { message, video, userId, state, saveToHistory, roulette }
  }
}
