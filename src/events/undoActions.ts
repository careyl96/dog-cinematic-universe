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
import { createQueueEmbed } from '../helpers/embedHelpers'
import { UNDO } from '../constants'
import { escapeDiscordMarkdown, isoToTimestamp, truncateText } from '../helpers/formatterHelpers'
import { QueueItem } from '../MusicPlayer'
import { playlistCtrl } from '../backend/controllers/Controllers'
import { GuildSession } from '../GuildSession'
import { removeFromQueue } from '../helpers/playerFunctions'

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(client: ClientWithCommands, session: GuildSession, interaction: Interaction) {
    if (!interaction.isButton() || !session || !session.musicPlayer) return

    const userId = interaction.user.id
    const userState = session.getUserState(userId)

    switch (interaction.customId) {
      case UNDO.LIKE:
        try {
          await playlistCtrl.removeFavorite(userId, userState.selectedVideo.id)
          await userState.clearInteraction()
        } catch (error: any) {
          interaction.reply({
            content: error?.message || 'Something wrong :(',
            flags: MessageFlags.Ephemeral,
          })
        }
        await interaction.deferUpdate()
        break
      case UNDO.QUEUE:
        await interaction.deferUpdate()
        try {
          const videoIds = userState.queuedTracks.map((track) => track.id)
          if (videoIds) {
            await removeFromQueue({ session, videoIds })
          }
          await userState.clearInteraction(videoIds[0])
        } catch (error: any) {
          interaction.reply({
            content: error?.message || 'Something wrong :(',
            flags: MessageFlags.Ephemeral,
          })
        }
        break
    }
  },
}

const getUrlFromQueueEmbed = (input: string) => {
  const match = input.match(/\((https?:\/\/[^\s)]+)\)/)

  if (match) {
    return match[1]
  } else {
    console.log('No URL found.')
  }
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
