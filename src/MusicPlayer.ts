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
import { createQueueEmbed, createYoutubeEmbed, NowPlayingEmbedState } from './helpers/embedHelpers'
import { BOT_USER_ID, PATH } from './constants'
import { Readable } from 'stream'
import { FormattedYoutubeVideo } from './helpers/youtubeHelpers/youtubeFormatterHelpers'
import { updateHistoryFile } from './helpers/musicDataHelpers'
import { shuffle } from './helpers/otherHelpers'
import { getCurrentTimestamp } from './helpers/formatterHelpers'

interface YoutubeMusicPlayerOptions {
  connection?: VoiceConnection
  textChannel: TextChannel
}

interface PlayOptions {
  query: string
  userId: string
  overrideCurrentEmbed?: boolean
  queueInPosition?: number
  interaction?: ChatInputCommandInteraction
}

interface PlayAudioFromYoutubeOptions {
  video: FormattedYoutubeVideo
  userId: string
  saveHistory?: boolean
  force?: boolean
  overrideCurrentEmbed?: boolean
  interaction?: ChatInputCommandInteraction
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
  queueInPosition?: number
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
  private _currentlyPlaying: QueueItem
  private audioStream: Readable = null

  private _nowPlayingEmbedInfo: NowPlayingEmbedInfo = {
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
    this._currentlyPlaying = null
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
      console.log('##### Subscribed to music player')
    }
  }

  setVoiceConnection(connection?: VoiceConnection) {
    this.connection = connection || null
  }

  // overrwrite currently playing song
  // used when using voice commands or when force option is selected
  async forcePlay({ query, userId, overrideCurrentEmbed = false, interaction }: PlayOptions) {
    this.subscribeToMusicPlayer(interaction)
    const useYts = overrideCurrentEmbed ? false : true
    const video = (await fetchYoutubeVideoFromUrlOrQuery({
      urlOrQuery: query,
      useYts,
      interaction,
    })) as any

    await this.playAudioFromYTVideo({
      video,
      userId,
      force: true,
      overrideCurrentEmbed,
      interaction,
    })
  }

  // this function is kind of useless since enqueue does the same thing more or less, TODO: remove
  // primary play function is in playerFunctions.ts
  async play({ query, userId, interaction, queueInPosition }: PlayOptions) {
    const video = await fetchYoutubeVideoFromUrlOrQuery({
      urlOrQuery: query,
      useYts: this.player.state.status === AudioPlayerStatus.Idle,
      interaction,
    })
    if (!video) {
      console.error('##### Error with video')
      return
    }
    await this.enqueue({ videosToQueue: video, userId, interaction, queueInPosition })
  }

  async enqueue({ videosToQueue, userId, interaction, saveHistory = true, queueInPosition }: EnqueueOptions) {
    const videos = Array.isArray(videosToQueue) ? videosToQueue : [videosToQueue]

    const queueItems = videos.map((video) => ({ video, userId, saveHistory }) as QueueItem)

    if (queueInPosition !== undefined && queueInPosition >= 0 && queueInPosition <= this._queue.length) {
      this._queue.splice(queueInPosition, 0, ...queueItems)
    } else {
      this._queue.push(...queueItems)
    }

    if (this.player.state.status === AudioPlayerStatus.Idle) {
      await this.playNextInQueue(interaction)
    } else {
      await this.sendOrUpdateQueueEmbed()
      await this.editNowPlayingEmbed()

      if (interaction && !interaction.replied) interaction.deleteReply()
    }
  }

  async playNextInQueue(interaction?: any) {
    const queueItem = this._queue.shift()
    if (!queueItem) return

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
    saveHistory = true,
    force = false,
    overrideCurrentEmbed = false,
    interaction,
  }: PlayAudioFromYoutubeOptions) {
    this.audioStream?.destroy()
    this.subscribeToMusicPlayer(interaction)

    try {
      if (this.player.state.status === AudioPlayerStatus.Idle || force) {
        if (force && !overrideCurrentEmbed) {
          await this.stop({ skip: true, skippedByUserId: userId })
        }

        if (interaction && !interaction.replied) interaction.deleteReply()

        // send loading embed
        if (overrideCurrentEmbed) {
          this.editNowPlayingEmbed('loading')
        } else {
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
              this._nowPlayingEmbedInfo = {
                ...this._nowPlayingEmbedInfo,
                ...{ message, video, userId, state: 'loading' },
              }
              message.react('❤️')
              message.react('🚫')
              message.react('⏭️')
              message.react('🔁')
              this.sendOrUpdateQueueEmbed()
            })
        }
        /* -------------------------------------------------------------- */
        this.audioStream = createYoutubeAudioStream(video.url)

        const audioResource = createAudioResource(this.audioStream, {
          inlineVolume: true,
          silencePaddingFrames: 5,
        })
        // const audioResource = createAudioResource(`${PATH.AUDIO_FILES.GENERATED.YOUTUBE}/output.mp3`, {
        //   inlineVolume: true,
        //   silencePaddingFrames: 5,
        // })
        audioResource.volume?.setVolume(0.5)
        this.player.play(audioResource)
        /* -------------------------------------------------------------- */

        this.player.removeAllListeners()
        this.player
          .once(AudioPlayerStatus.Idle, async () => {
            this.handleTrackFinished({ saveHistory })
          })
          .once(AudioPlayerStatus.Playing, async () => {
            await this.editNowPlayingEmbed('playing')
            this.currentlyPlaying = { video, userId }
            console.log(`[${getCurrentTimestamp()}] 🎹 Now playing: ${video.title}`)
          })
          .on('error', async (err) => {
            await this.editNowPlayingEmbed('error', null, err)
            await this.stop()
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

  async handleTrackFinished({ saveHistory = false }: { saveHistory?: boolean }) {
    const { video, userId } = this.nowPlayingEmbedInfo
    console.log(
      `######################################### ${video.title} FINISHED #########################################`
    )
    if (saveHistory) this.updateMusicHistory(video, userId)
    await this.editNowPlayingEmbed('finished')

    // Remove embed if the bot is the one who played the song (hourly music ready.ts)
    if (userId === BOT_USER_ID) {
      this.nowPlayingEmbedInfo.message?.delete()
      console.log(
        `######################################### HOURLY MUSIC - DELETING EMBED #########################################`
      )
    }

    await this.playNextInQueue()
  }

  async sendOrUpdateQueueEmbed() {
    const numItemsToDisplay = 8
    const queueItemText = this._queue
      .slice(0, numItemsToDisplay)
      .map(
        (item, index) =>
          `‎ [${index + 1}] ‎ [${item.video.title}](${item.video.url}) - (${item.video.duration}) <@${item.userId}>`
      )
      .join('\n')

    let queueEmbedText =
      this._queue.length > numItemsToDisplay
        ? `${queueItemText}\n... and ${this._queue.length - numItemsToDisplay} more!`
        : queueItemText

    const latestMessages = await this._textChannel.messages.fetch({ limit: 1 })
    const latestMessage = latestMessages.first()

    // Determine if we should replace the existing embed
    const shouldRepost = this.queueEmbedInfo.message && latestMessage?.id !== this.queueEmbedInfo.message.id

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
      await this.queueEmbedInfo.message.delete().catch((err: any) => console.error(err.message))
      this.queueEmbedInfo.message = null
    }
    // If the embed is not the latest message, delete and repost it
    else if (shouldRepost) {
      await this.queueEmbedInfo.message?.delete().catch((err: any) => console.error(err.message))

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

    await this.editNowPlayingEmbed()
  }

  async deleteQueueEmbed() {
    await this.queueEmbedInfo.message?.delete().catch((err: any) => console.error(err.message))
    this.queueEmbedInfo.message = null
  }

  async shuffle(userId: string) {
    if (this.queue.length >= 2) {
      this.queue = shuffle(this._queue)
      // this._textChannel?.send({
      //   allowedMentions: {
      //     parse: [],
      //   },
      //   content: `<@${userId}> shuffled the queue!`,
      // })
      await this.sendOrUpdateQueueEmbed()
      await this.editNowPlayingEmbed()
    }
  }

  async clearQueue() {
    this._queue = []
    await this.editNowPlayingEmbed()
  }

  async skip(userId: string) {
    try {
      this.subscribeToMusicPlayer()
      // this._textChannel?.send({
      //   allowedMentions: {
      //     parse: [],
      //   },
      //   content: `<@${userId}> used skip!`,
      // })
      await this.stop({ skip: true, skippedByUserId: userId })
    } catch (err) {
      throw new Error("Player isn't playing anything!")
    }
  }

  async pause() {
    try {
      await this.editNowPlayingEmbed('paused')
      this.player.pause()
    } catch {
      throw new Error("Player isn't playing anything!")
    }
  }

  async unpause() {
    try {
      this.subscribeToMusicPlayer()
      await this.editNowPlayingEmbed('playing')
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
    error?: any
  } = {}) {
    let state: NowPlayingEmbedState = 'finished'
    if (error) state = 'error'
    if (skip) state = 'skipped'

    await this.editNowPlayingEmbed(state, skippedByUserId, error)
    this.deleteQueueEmbed()
    this.player.stop()
    this.player.unpause()
  }

  async editNowPlayingEmbed(
    state: NowPlayingEmbedState = this.nowPlayingEmbedInfo.state,
    skippedByUserId?: string,
    error?: any
  ) {
    if (this.nowPlayingEmbedInfo.state === 'finished') return
    if (this.nowPlayingEmbedInfo.state === 'skipped') return
    if (this.nowPlayingEmbedInfo.state === 'error') return
    if (!this.nowPlayingEmbedInfo.message) return

    // console.log(`###### Track embed state: ${state}`)
    this.nowPlayingEmbedInfo.state = state
    if (
      this.nowPlayingEmbedInfo.state === 'finished' ||
      this.nowPlayingEmbedInfo.state === 'skipped' ||
      this.nowPlayingEmbedInfo.state === 'error'
    ) {
      const skipReaction = this.nowPlayingEmbedInfo.message.reactions.cache.get('⏭️')
      if (skipReaction) skipReaction.users.remove(BOT_USER_ID).catch(console.error)
    }
    await this.nowPlayingEmbedInfo.message
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

  updateMusicHistory(video: FormattedYoutubeVideo, userId: string) {
    const userPath = `${PATH.USER_DATA}/${userId}/music_queue_history.json`
    const globalPath = `${PATH.USER_DATA}/${BOT_USER_ID}/music_queue_history.json`

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
  set currentlyPlaying({ video, userId }: QueueItem) {
    this._currentlyPlaying = { video, userId }
  }

  get nowPlayingEmbedInfo() {
    return this._nowPlayingEmbedInfo
  }
  set nowPlayingEmbedInfo({ message, video, userId, state }: NowPlayingEmbedInfo) {
    this._nowPlayingEmbedInfo = { message, video, userId, state }
  }
}
