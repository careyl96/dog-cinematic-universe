import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  VoiceConnection,
} from '@discordjs/voice'
import { createYoutubeAudioStream } from './helpers/youtubeHelpers/youtubeHelpers'
import { ChatInputCommandInteraction, Message, TextChannel } from 'discord.js'
import { fetchYoutubeVideoFromUrlOrQuery } from './helpers/youtubeHelpers/youtubeHelpers'
import {
  createQueueEmbed,
  createYoutubeEmbed,
  createYoutubeErrorEmbed,
  NowPlayingEmbedState,
} from './helpers/embeds'
import { client } from '.'
import { AUDIO_FILES, PATH } from './constants'
import { Readable } from 'stream'
import { createJsonForUser } from './helpers/seedMusicHistory'
import { existsSync, readFileSync } from 'fs'
import { FormattedYoutubeVideo } from './helpers/youtubeHelpers/youtubeFormatterHelpers'

interface YoutubeMusicPlayerOptions {
  connection?: VoiceConnection
  textChannel: TextChannel
}

interface PlayOptions {
  query: string
  userId: string
  interaction?: ChatInputCommandInteraction
}

interface PlayAudioFromYoutubeOptions {
  video: FormattedYoutubeVideo
  userId: string
  saveHistory?: boolean
  interaction?: ChatInputCommandInteraction
  force?: boolean
}

export type QueueItem = {
  video: FormattedYoutubeVideo
  userId: string
  saveHistory?: boolean
}

interface EnqueueOptions {
  videosToQueue: FormattedYoutubeVideo | FormattedYoutubeVideo[]
  userId: string
  interaction?: ChatInputCommandInteraction
  saveHistory?: boolean
}

interface NowPlayingEmbedInfo {
  message: Message
  video: any
  userId: string
  state: NowPlayingEmbedState
}

export class YoutubeMusicPlayer {
  private connection: VoiceConnection
  private _textChannel: TextChannel

  public player: AudioPlayer
  private _queue: QueueItem[]
  private currentlyPlaying: QueueItem
  private previouslyPlayed: QueueItem
  private audioStream: Readable = null

  private nowPlayingEmbedInfo: NowPlayingEmbedInfo = {
    message: null,
    video: null,
    userId: null,
    state: null,
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
      },
    })
    this._queue = []
    this.currentlyPlaying = null
    this.previouslyPlayed = null
  }

  private subscribeToMusicPlayer() {
    if (!this.connection) throw new Error('Dog is not in a voice channel.')
    if (
      this.connection?.state.status === 'ready' &&
      this.connection?.state.subscription?.player === this.player
    ) {
      // console.log('##### Already subscribed to the music player')
      return
    } else {
      this.connection?.subscribe(this.player)
      console.log('##### Subscribed to music player')
    }
  }

  setVoiceConnection(connection?: VoiceConnection) {
    this.connection = connection || null
  }

  // overrwrite currently playing song
  // used when using voice commands or when force option is selected
  async forcePlay({ query, userId, interaction }: PlayOptions) {
    this.subscribeToMusicPlayer()
    const youtubeResult = (await fetchYoutubeVideoFromUrlOrQuery({
      urlOrQuery: query,
      useYts: true,
    })) as any

    await this.playAudioFromYTVideo({
      video: youtubeResult,
      userId,
      force: true,
      interaction,
    })
  }

  async play({ query, userId, interaction }: PlayOptions) {
    const videos = await fetchYoutubeVideoFromUrlOrQuery({
      urlOrQuery: query,
      useYts: this.player.state.status === AudioPlayerStatus.Idle,
    })
    await this.enqueue({ videosToQueue: videos, userId, interaction })
  }

  async enqueue({
    videosToQueue,
    userId,
    saveHistory = false,
    interaction,
  }: EnqueueOptions) {
    const videos = Array.isArray(videosToQueue)
      ? videosToQueue
      : [videosToQueue]
    this._queue.push(
      ...videos.map((video) => ({ video, userId, saveHistory }) as QueueItem)
    )

    if (this.player.state.status === AudioPlayerStatus.Idle) {
      await this.playNextInQueue(interaction)
    } else {
      await this.sendOrUpdateQueueEmbed()
      this.editNowPlayingEmbed()

      if (interaction) interaction.deleteReply()
    }
  }

  async playNextInQueue(interaction?: any) {
    const queueItem = this._queue.shift()
    if (!queueItem) return console.error('!!! No items in queue')

    await this.playAudioFromYTVideo({
      video: queueItem.video,
      userId: queueItem.userId,
      saveHistory: queueItem.saveHistory,
      interaction,
    })
  }

  async playAudioFromYTVideo({
    video,
    userId,
    interaction,
    saveHistory = true,
    force = false,
  }: PlayAudioFromYoutubeOptions) {
    this.subscribeToMusicPlayer()

    try {
      if (this.player.state.status === AudioPlayerStatus.Idle || force) {
        if (force) {
          this.stop({ skip: true, skippedByUserId: userId })
        }

        if (interaction) interaction.deleteReply()

        // send loading embed
        this._textChannel
          ?.send({
            embeds: [
              createYoutubeEmbed({
                youtubeVideo: video,
                userId,
                upNext: this._queue[0],
                state: 'loading',
              }),
            ],
          })
          .then((message) => {
            this.nowPlayingEmbedInfo = {
              ...this.nowPlayingEmbedInfo,
              ...{ message, video, userId, state: 'loading' },
            }
            this.sendOrUpdateQueueEmbed()
          })
        /* -------------------------------------------------------------- */
        this.audioStream = createYoutubeAudioStream(video.url)
        const audioResource = createAudioResource(this.audioStream, {
          inlineVolume: true,
        })
        audioResource.volume?.setVolume(0.5)
        this.player.play(audioResource)
        /* -------------------------------------------------------------- */

        this.player.removeAllListeners()
        this.player
          .once(AudioPlayerStatus.Idle, async () => {
            console.log(
              '######################################### TRACK FINISHED #########################################'
            )
            if (saveHistory) this.updateMusicBotHistory(video, userId)
            this.editNowPlayingEmbed('finished')
            await this.playNextInQueue()
          })
          .once(AudioPlayerStatus.Playing, () => {
            this.editNowPlayingEmbed('playing')
            this.previouslyPlayed = this.currentlyPlaying
            this.currentlyPlaying = { video, userId }
            console.log(`🎹 Now playing: ${video.title}`)
          })
          .on('error', async (err) => {
            this.editNowPlayingEmbed('error', null, err)

            this.stop()
            // await client.playAudioFromFilePath({
            //   audioFilePath: AUDIO_FILES.WHIMPER,
            // })
          })
      }
    } catch (err) {
      console.error(err)
      throw err
    }
  }

  async sendOrUpdateQueueEmbed() {
    const numItemsToDisplay = 8
    const queueItemText = this._queue
      .slice(0, numItemsToDisplay)
      .map(
        (item, index) =>
          `‎ [${index + 1}] ‎ ${item.video.title} - (${item.video.duration}) <@${item.userId}>`
      )
      .join('\n')

    let queueEmbedText =
      this._queue.length > numItemsToDisplay
        ? `${queueItemText}\n... and ${this._queue.length - numItemsToDisplay} more!`
        : queueItemText

    const latestMessages = await this._textChannel.messages.fetch({ limit: 1 })
    const latestMessage = latestMessages.first()

    // Determine if we should replace the existing embed
    const shouldRepost =
      this.queueEmbedInfo.message &&
      latestMessage?.id !== this.queueEmbedInfo.message.id

    // If no embed exists and queue has enough items, post new embed
    if (!this.queueEmbedInfo.message && this._queue.length >= 2) {
      await this._textChannel
        ?.send({
          embeds: [createQueueEmbed({ text: queueEmbedText })],
        })
        .then((message) => {
          this.queueEmbedInfo.message = message
        })
    }
    // If there's an embed and queue is too short, remove it
    else if (this.queueEmbedInfo.message && this._queue.length < 2) {
      await this.queueEmbedInfo.message
        .delete()
        .catch((err: any) => console.error(err.message))
      this.queueEmbedInfo.message = null
    }
    // If the embed is not the latest message, delete and repost it
    else if (shouldRepost) {
      await this.queueEmbedInfo.message
        ?.delete()
        .catch((err: any) => console.error(err.message))

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

    this.editNowPlayingEmbed()
  }

  async deleteQueueEmbed() {
    await this.queueEmbedInfo.message
      ?.delete()
      .catch((err: any) => console.error(err.message))
    this.queueEmbedInfo.message = null
  }

  clearQueue() {
    this._queue = []
    this.editNowPlayingEmbed()
  }

  skip(userId: string) {
    try {
      this.subscribeToMusicPlayer()
      // this._textChannel?.send({
      //   allowedMentions: {
      //     parse: [],
      //   },
      //   content: `<@${userId}> used skip!`,
      // })
      this.stop({ skip: true, skippedByUserId: userId })
    } catch (err) {
      throw new Error("Player isn't playing anything!")
    }
  }

  pause() {
    try {
      this.editNowPlayingEmbed('paused')
      this.player.pause()
    } catch {
      throw new Error("Player isn't playing anything!")
    }
  }

  unpause() {
    try {
      this.subscribeToMusicPlayer()
      this.editNowPlayingEmbed('playing')
      this.player.unpause()
    } catch {
      throw new Error("Player isn't playing anything!")
    }
  }

  stop(
    {
      skip = false,
      skippedByUserId,
      error = null,
    }: { skip?: boolean; skippedByUserId?: string; error?: any } = {
      skip: false,
      skippedByUserId: null,
      error: null,
    }
  ) {
    let state: NowPlayingEmbedState = 'finished'
    if (error) state = 'error'
    if (skip) state = 'skipped'

    this.editNowPlayingEmbed(state, skippedByUserId, error)
    this.deleteQueueEmbed()
    this.player.stop()
    this.player.unpause()
  }

  playPrev(interaction: ChatInputCommandInteraction) {
    if (!this.previouslyPlayed) {
      interaction.deleteReply()
      return
    }

    if (this.currentlyPlaying) {
      this._queue.unshift(this.currentlyPlaying)
    }
    this.playAudioFromYTVideo({
      video: this.previouslyPlayed?.video,
      userId: this.previouslyPlayed?.userId!,
      force: true,
      interaction,
    })
    this.currentlyPlaying = null
  }

  editNowPlayingEmbed(
    state: NowPlayingEmbedState = this.nowPlayingEmbedInfo.state,
    skippedByUserId?: string,
    error?: any
  ) {
    if (this.nowPlayingEmbedInfo.state === 'skipped') return
    if (this.nowPlayingEmbedInfo.state === 'error') return
    if (!this.nowPlayingEmbedInfo.message) return
    // return console.log('##### NO NOW PLAYING EMBED MESSAGE FOUND')

    // console.log(`###### Track embed state: ${state}`)
    this.nowPlayingEmbedInfo.state = state
    this.nowPlayingEmbedInfo.message
      ?.edit({
        embeds: [
          createYoutubeEmbed({
            youtubeVideo: this.nowPlayingEmbedInfo.video,
            userId: this.nowPlayingEmbedInfo.userId,
            upNext: this._queue[0],
            state,
            skippedByUserId,
            error,
          }),
        ],
      })
      .catch((err: any) => {
        console.error(err.message)
      })
  }

  updateMusicBotHistory(video: FormattedYoutubeVideo, userId: string) {
    const messageHistoryFilePath = `${PATH.MUSIC_BOT_HISTORY}/${userId}.json`
    if (existsSync(messageHistoryFilePath)) {
      const userMusicBotHistory = JSON.parse(
        readFileSync(messageHistoryFilePath, 'utf-8')
      )
      const videoId = this.currentlyPlaying.video.id
      if (!userMusicBotHistory[videoId]) {
        // If the video doesn't exist in the history, create a new entry
        userMusicBotHistory[videoId] = {
          title: video.title,
          requestCount: 1,
        }
      } else {
        // If the video exists, just increment the requestCount
        userMusicBotHistory[videoId].requestCount += 1
      }
      createJsonForUser(userId, userMusicBotHistory)
    } else {
      createJsonForUser(userId, {
        [video.id]: {
          title: video.title,
          requestCount: 1,
        },
      })
    }

    console.log('##### UPDATED USER MUSIC BOT HISTORY')
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
}
