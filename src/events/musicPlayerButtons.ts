import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ComponentType,
  Events,
  Interaction,
  MessageFlags,
} from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { createQueueEmbed, extractVideoDataFromMessage } from '../helpers/embedHelpers'
import { EMBED_CONTROLS } from '../constants'
import { escapeDiscordMarkdown, isoToTimestamp, truncateText } from '../helpers/formatterHelpers'
import { fetchMessages } from '../helpers/otherHelpers'
import { extractYouTubeIdFromUrl } from '../helpers/youtubeHelpers/youtubeFormatterHelpers'
import { QueueItem } from '../MusicPlayer'
import { playlistCtrl, trackCtrl } from '../backend/controllers/Controllers'
import { AudioPlayerStatus } from '@discordjs/voice'
import { GuildSession } from '../GuildSession'
import { ensureVoiceConnectionOrReply } from '../helpers/voiceConnectionHelpers'
import { ExtendedTrack } from '../EmbedStateManager'

export default {
  name: Events.InteractionCreate,
  once: false,
  // Inside your interaction handler
  async execute(client: ClientWithCommands, session: GuildSession, interaction: Interaction) {
    if (!interaction.isButton() || !session || !session.musicPlayer) return

    const userId = interaction.user.id
    const message = interaction.message

    const musicPlayer = session.musicPlayer

    const videoData: ExtendedTrack = extractVideoDataFromMessage(message)
    if (!videoData) return

    const embedState = musicPlayer.embedStateManager
    const playerState: AudioPlayerStatus = musicPlayer.player.state.status

    switch (interaction.customId) {
      case EMBED_CONTROLS.VOLUME_DOWN:
        await musicPlayer.volDown()
        await interaction.deferUpdate()
        break

      case EMBED_CONTROLS.VOLUME_UP:
        await musicPlayer.volUp()
        await interaction.deferUpdate()
        break

      case EMBED_CONTROLS.BACK:
        await interaction.deferUpdate()
        const connected = await ensureVoiceConnectionOrReply(interaction, session, userId)
        if (!connected) break

        const timeElapsedBeforePlayPrevTrack = 3000

        const sameTrackAsCurrentlyPlaying = videoData.id === extractYouTubeIdFromUrl(embedState.track?.url)
        const startTrackFromBeginning = embedState.trackTimer?.state.elapsedTime >= timeElapsedBeforePlayPrevTrack
        const playTrackFromPreviousMessage = embedState.trackTimer?.state.elapsedTime < timeElapsedBeforePlayPrevTrack
        if (sameTrackAsCurrentlyPlaying && startTrackFromBeginning) {
          await musicPlayer.forcePlay({
            query: videoData.url,
            userId,
            overrideCurrentEmbed: true,
          })
        } else if (playTrackFromPreviousMessage) {
          let currentEmbedMessage = embedState?.message

          const messages = await fetchMessages(session.musicBotTextChannel, 10)

          const prevMessage = messages.find(
            (m) => m.embeds?.[0]?.data?.fields?.[0]?.name?.includes('Requested by') && m.id !== currentEmbedMessage?.id
          )

          if (prevMessage) {
            try {
              await currentEmbedMessage.delete()
            } catch (error) {
              console.error('Failed to delete current embed message:', error)
            }
            const embedData = prevMessage.embeds[0].data
            const prevVideo = (await trackCtrl.getByIdAndFormat(extractYouTubeIdFromUrl(embedData.url))) as any

            musicPlayer.embedStateManager.message = prevMessage
            await musicPlayer.forcePlay({
              query: prevVideo.url,
              userId,
              overrideCurrentEmbed: true,
            })
          }
        }
        break

      case EMBED_CONTROLS.PLAY: {
        await interaction.deferUpdate()
        const connected = await ensureVoiceConnectionOrReply(interaction, session, userId)
        if (!connected) break
        session.musicPlayer.unpause()
        break
      }

      case EMBED_CONTROLS.PAUSE:
        await musicPlayer.pause()
        await interaction.deferUpdate()
        break

      case EMBED_CONTROLS.SKIP:
        if (
          playerState === AudioPlayerStatus.Playing ||
          playerState === AudioPlayerStatus.Paused ||
          playerState === AudioPlayerStatus.Buffering
        ) {
          try {
            await interaction.deferUpdate()
          } catch (err) {
            console.error(err)
          }
          await musicPlayer.skip(userId)
        } else {
          await interaction.reply({
            content: 'Nothing currently playing.',
            ephemeral: true,
          })
        }
        break

      case EMBED_CONTROLS.QUEUE: {
        await interaction.deferUpdate()
        const connected = await ensureVoiceConnectionOrReply(interaction, session, userId)
        if (!connected) break

        try {
          musicPlayer.enqueue({
            videosToQueue: [videoData],
            userId,
            queueInPosition: 0,
          })
          if (musicPlayer.player.state.status !== AudioPlayerStatus.Idle) {
            await interaction.followUp({
              content: `Added [${truncateText(
                escapeDiscordMarkdown(videoData.title),
                45
              )}](<${videoData.url}>) to the queue!`,
              flags: MessageFlags.Ephemeral,
            })
          }
        } catch (err) {
          console.error(err)
        }

        break
      }
      case EMBED_CONTROLS.VIEW_QUEUE:
        await handleViewQueue({ interaction, session, userId })
        break

      case EMBED_CONTROLS.LIKE:
        try {
          playlistCtrl.addFavorite(userId, videoData.id)
          interaction.reply({
            content: `Added [${videoData.title}](<${videoData.url}>) to your liked music!`,
            ephemeral: true,
          })
        } catch (error: any) {
          interaction.reply({
            content: error?.message || 'Something wrong like',
            flags: MessageFlags.Ephemeral,
          })
        }
        break

      case EMBED_CONTROLS.AUTOPLAY:
        try {
          await musicPlayer.handleAutoplay(!musicPlayer.autoplay)
          await interaction.reply({
            content: `Autoplay ${musicPlayer.autoplay ? 'enabled' : 'disabled'}!`,
            flags: MessageFlags.Ephemeral,
          })
        } catch (err) {
          console.error(err)
        }
        break

      case EMBED_CONTROLS.ROULETTE:
        try {
          await interaction.deferUpdate()
          await musicPlayer.handleAutoplay(true)
        } catch (err) {
          console.error(err)
        }
        break
    }
  },
}

const handleViewQueue = async ({
  interaction,
  session,
  userId,
}: {
  interaction: ButtonInteraction
  session: GuildSession
  userId: string
}) => {
  const ITEMS_PER_PAGE = 25
  const queue = session.musicPlayer.queue
  const totalPages = Math.max(Math.ceil(queue.length / ITEMS_PER_PAGE), 1)
  let currentPage = 0

  const userState = session.getUserState(userId)

  const generateQueueEmbedText = (queue: QueueItem[], page: number): string => {
    const start = page * ITEMS_PER_PAGE
    const end = start + ITEMS_PER_PAGE
    return (
      queue
        .slice(start, end)
        .map(
          (item, index) =>
            `[${start + index + 1}] [${truncateText(
              escapeDiscordMarkdown(item.video.title),
              45
            )}](${item.video.url}) - (${isoToTimestamp(item.video.duration)}) <@${item.userId}>`
        )
        .join('\n') || '<a:emoji:1132934927382499388> No songs queued.'
    )
  }

  const createPaginationRow = (page: number, total: number) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('queue_prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId('queue_next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= total - 1)
    )
  }

  await interaction.reply({
    embeds: [createQueueEmbed({ text: generateQueueEmbedText(queue, currentPage) })],
    components: totalPages > 1 ? [createPaginationRow(currentPage, totalPages)] : [],
    ephemeral: true,
  })
  const replyMsg = await interaction.fetchReply()

  const collector = replyMsg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i) => i.user.id === userId && ['queue_prev', 'queue_next'].includes(i.customId),
    time: 60000,
  })
  userState.queueManager = { currentPage, totalPages, collector }

  collector.on('collect', async (btnInteraction) => {
    const queue = session.musicPlayer.queue
    let page = userState.queueManager.currentPage

    if (btnInteraction.customId === 'queue_prev') {
      page = Math.max(0, page - 1)
    } else if (btnInteraction.customId === 'queue_next') {
      page = Math.min(userState.queueManager.totalPages - 1, page + 1)
    }

    const embed = createQueueEmbed({ text: generateQueueEmbedText(queue, page) })
    const components =
      userState.queueManager.totalPages > 1 ? [createPaginationRow(page, userState.queueManager.totalPages)] : []

    await btnInteraction.update({
      embeds: [embed],
      components,
    })

    userState.queueManager = { currentPage: page }
  })

  collector.on('end', () => {
    // Only clean up if it's the same collector
    if (userState.queueManager.collector === collector) {
      userState.queueManager = { collector: null }
    }
  })
}
