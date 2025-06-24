import { Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { GuildSession } from './GuildSession'
import { formatYoutubeVideoTitleForEmbed, NowPlayingEmbedState } from './helpers/embedHelpers'
import {
  generateProgressBar,
  isoToTimestamp,
  msToTimestamp,
  isoToMs,
} from './helpers/formatterHelpers'
import { Track } from './backend/entities/Track'
import { handleTrackFinishedTransaction } from './backend/helpers/handleTrackFinishedTransaction'
import { EMBED_CONTROLS } from './constants'
import { uncompressTrack } from './helpers/youtubeHelpers/youtubeFormatterHelpers'
import { TimerManager } from './TimerManager'
export type ExtendedTrack = Track & {
  url: string
  thumbnail: string
}

export class EmbedStateManager {
  session: GuildSession
  message: Message | null = null

  userId: string
  track: ExtendedTrack
  embedState: NowPlayingEmbedState
  skippedByUserId: string | null

  trackTimer: TimerManager

  constructor(session: GuildSession) {
    this.session = session

    this.userId = null
    this.track = null
    this.embedState = null

    this.trackTimer = new TimerManager(1000, () => this.updateEmbed(NowPlayingEmbedState.Playing))
    this.skippedByUserId = null
  }

  public setTrack({ track, userId }: { track: Track; userId: string }) {
    this.trackTimer.stop()
    this.track = uncompressTrack(track)
    this.userId = userId
  }

  public async handlePlay() {
    this.trackTimer.startOrResume()
    try {
      await this.updateEmbed(NowPlayingEmbedState.Playing)
    } catch {}
  }
  public async handlePause() {
    this.trackTimer.pause()
    try {
      await this.updateEmbed(NowPlayingEmbedState.Paused)
    } catch {}
  }
  public async handleFinished() {
    const elapsedTime = this.trackTimer.stop()
    if (!this.skippedByUserId) {
      await handleTrackFinishedTransaction({
        userId: this.userId,
        guildId: this.session.guild.id,
        trackData: this.track,
        startTimestamp: this.trackTimer.state.startTime,
      })
    }

    if (this.skippedByUserId) {
      await this.updateEmbed(NowPlayingEmbedState.Skipped, elapsedTime)
    } else {
      await this.updateEmbed(NowPlayingEmbedState.Finished)
    }
    this.resetTrackEmbedState()
  }

  private createTrackEmbed({
    track = this.track,
    userId = this.userId,
    embedState = this.embedState,
    elapsedTime = this.trackTimer.state.elapsedTime,
  }: {
    track?: ExtendedTrack
    userId?: string
    embedState?: NowPlayingEmbedState
    elapsedTime?: number
  } = {}) {
    const trackCompletionPercentage = Math.floor((elapsedTime / isoToMs(track.duration)) * 100) ?? 0
    const progressBar = generateProgressBar(trackCompletionPercentage, 10)
    const elapsedTimestamp = msToTimestamp(elapsedTime ?? 0)
    const trackDuration = isoToTimestamp(track.duration)

    let stateString: string
    let color: number

    switch (embedState) {
      case NowPlayingEmbedState.Loading:
        stateString = 'Loading...'
        color = 0x8c8c8c
        break
      case NowPlayingEmbedState.Playing:
        stateString = 'Now playing:'
        color = 0xa0c980
        break
      case NowPlayingEmbedState.Paused:
        stateString = 'Paused'
        color = 0x8c8c8c
        break
      case NowPlayingEmbedState.Finished:
        stateString = 'Track finished'
        color = 0x0055cc
        break
      case NowPlayingEmbedState.Skipped:
        stateString = 'Track skipped'
        color = 0xe098e0
        break
      case NowPlayingEmbedState.Error:
        stateString = 'Error'
        color = 0xec7278
        break
      default:
        stateString = 'Now playing:'
        color = 0xa0c980
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(formatYoutubeVideoTitleForEmbed(track))
      .setURL(track.url)
      .setAuthor({ name: stateString })
      .addFields(
        { name: '<:Flowuwu:823463092724826162> Requested by', value: `<@${userId}>`, inline: true },
        { name: '🕗 Duration', value: track.duration ? `\`${trackDuration}\`` : '(Unknown)', inline: true }
      )
      .setThumbnail(track.thumbnail)
      .setTimestamp()

    if (track.firstPlayedBy) {
      embed.addFields({ name: '📥 First queue', value: `<@${track.firstPlayedBy}>`, inline: true })
    }
    if (![NowPlayingEmbedState.Finished, NowPlayingEmbedState.Error].includes(embedState)) {
      embed.setDescription(`\`${elapsedTimestamp}\` ${progressBar} \`${trackDuration}\``)
    }

    const actionRows = this.createYoutubeEmbedActionRows()

    return {
      embeds: [embed],
      components: actionRows,
    }
  }

  public async updateEmbed(state: NowPlayingEmbedState = this.embedState, elapsedTime?: number) {
    if (!this.message) return console.error('No message to update')

    this.embedState = state
    const { embeds, components } = this.createTrackEmbed({ elapsedTime })

    this.trackTimer.state.isUpdating = true
    await this.message.edit({ embeds, components })
    this.trackTimer.state.isUpdating = false
  }

  public async sendInitialEmbed() {
    this.embedState = NowPlayingEmbedState.Loading
    const { embeds, components } = this.createTrackEmbed()
    const sentMessage = await this.session.musicBotTextChannel.send({ embeds, components })
    this.message = sentMessage
  }

  private createYoutubeEmbedActionRows() {
    const embedState = this.embedState
    const musicPlayer = this.session.musicPlayer

    const actionRows: ActionRowBuilder<ButtonBuilder>[] = []
    const row1Buttons: ButtonBuilder[] = []
    const row2Buttons: ButtonBuilder[] = []

    const trackFinished = [
      NowPlayingEmbedState.Finished,
      NowPlayingEmbedState.Skipped,
      NowPlayingEmbedState.Error,
    ].includes(this.embedState)

    if (!trackFinished) {
      const isPlaying = [NowPlayingEmbedState.Playing, NowPlayingEmbedState.Loading].includes(embedState)

      row1Buttons.push(
        new ButtonBuilder()
          .setCustomId(EMBED_CONTROLS.VOLUME_DOWN)
          .setLabel('Down')
          .setEmoji('🔉')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(musicPlayer?.volume === 0.1 ? true : false),
        new ButtonBuilder()
          .setCustomId(EMBED_CONTROLS.BACK)
          .setLabel('Back')
          .setEmoji('⏪')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(isPlaying ? EMBED_CONTROLS.PAUSE : 'play')
          .setLabel(isPlaying ? 'Pause' : 'Play')
          .setEmoji(isPlaying ? '⏸️' : '▶️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(EMBED_CONTROLS.SKIP)
          .setLabel('Skip')
          .setEmoji('⏭️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(EMBED_CONTROLS.VOLUME_UP)
          .setLabel('Up')
          .setEmoji('🔊')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(musicPlayer?.volume === 3 ? true : false)
      )

      row2Buttons.push(
        new ButtonBuilder().setCustomId(EMBED_CONTROLS.LIKE).setEmoji('❤️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(EMBED_CONTROLS.VIEW_QUEUE)
          .setLabel(`Queue (${musicPlayer.queue.length})`)
          .setEmoji('📃')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(musicPlayer?.queue.length === 0 ? true : false),
        new ButtonBuilder()
          .setCustomId('playlist:list')
          .setLabel('Playlists')
          .setEmoji('🗂️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('playlist:add').setEmoji('✅').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(EMBED_CONTROLS.AUTOPLAY)
          .setLabel('Autoplay')
          .setEmoji({ id: '1069843544375820328' })
          .setStyle(musicPlayer.autoplay ? ButtonStyle.Primary : ButtonStyle.Secondary)
      )

      const topRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...row1Buttons)
      const bottomRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...row2Buttons)

      actionRows.push(topRow, bottomRow)
    } else {
      // buttons that render when player has finished playing
      row1Buttons.push(
        new ButtonBuilder().setCustomId(EMBED_CONTROLS.LIKE).setEmoji('❤️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('playlist:list')
          .setLabel('Playlists')
          .setEmoji('🗂️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(EMBED_CONTROLS.QUEUE)
          .setLabel('Replay/Queue')
          .setEmoji('🔁')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('playlist:add')
          .setLabel('Add to playlist')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(EMBED_CONTROLS.ROULETTE).setEmoji('❓').setStyle(ButtonStyle.Secondary)
      )

      actionRows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...row1Buttons))
    }

    return actionRows
  }

  public resetTrackEmbedState() {
    this.message = null
    this.userId = null
    this.track = null
    this.embedState = null
    this.skippedByUserId = null
  }
}
