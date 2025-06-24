import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionReplyOptions,
  MessageCreateOptions,
  MessageFlags,
} from 'discord.js'
import { extractYouTubeIdFromUrl, parseTitleWithDurationToIso } from './youtubeHelpers/youtubeFormatterHelpers'
import { stripBackticks, stripTimeFromTitle, timestampToISO } from './formatterHelpers'
import { Track } from '../backend/entities/Track'
import { ExtendedTrack } from '../EmbedManager'
import { UNDO } from '../constants'

export enum NowPlayingEmbedState {
  Loading = 'loading',
  Playing = 'playing',
  Paused = 'paused',
  Finished = 'finished',
  Skipped = 'skipped',
  Error = 'error',
}

export const createErrorEmbed = (options: {
  errorMessage: string
  flags?: MessageFlags
}): MessageCreateOptions | InteractionReplyOptions => {
  const { errorMessage, flags } = options

  const embed = new EmbedBuilder().setColor(0xec7278).setTitle('Error:').setDescription(errorMessage.slice(0, 240))

  const response: any = {
    embeds: [embed],
    flags: null,
  }
  if (flags) {
    response.flags = flags
  }

  return response
}

export const createQueueEmbed = (options: { text: string }) => {
  const { text } = options
  return new EmbedBuilder().setColor(0xffa200).setTitle('Queue:').setDescription(`${text}`)
}

export const createGroqEmbed = (options: { query: string; userId: string; response: string }) => {
  const { query, userId, response } = options

  const embed = new EmbedBuilder().setDescription(`*<@${userId}>: ${query}* \n\n ${response}`)

  const interactionResponse = {
    embeds: [embed],
  }

  return interactionResponse
}

export const createRawEmbed = (message: string) => {
  return new EmbedBuilder().setDescription(message)
}

export const createLikedEmbed = ({ text }: { text: string }) => {
  return new EmbedBuilder().setColor(0xff7f9f).setDescription(`### Liked songs: \n${text}`)
}

export const createCustomEmbed = ({
  headerText,
  text,
  color = 0xff7f9f,
}: {
  headerText: string
  text: string
  color?: number
}) => {
  return new EmbedBuilder().setColor(color).setDescription(`### ${headerText}: \n${text}`)
}

export const extractVideoDataFromMessage = (message: any): ExtendedTrack => {
  const embedData = message.embeds[0]?.data
  const isMusicEmbed =
    (message.embeds?.length === 1 && embedData?.fields?.[0]?.name.includes('Requested by')) ||
    (message.embeds.length === 1 && embedData?.description?.includes('Requested by: '))

  if (!isMusicEmbed) return

  const isoDuration =
    timestampToISO(stripBackticks(embedData.fields[1].value)) || parseTitleWithDurationToIso(embedData.title)

  const videoData: ExtendedTrack = {
    title: stripTimeFromTitle(embedData.title),
    url: embedData?.url,
    id: extractYouTubeIdFromUrl(embedData?.url),
    firstPlayedBy: embedData?.fields?.[2]?.value?.replace(/[<@!>]/g, ''),
    duration: isoDuration,
    thumbnail: embedData.thumbnail?.url,
  }
  return videoData
}

export const formatYoutubeVideoTitleForEmbed = (video: Track): string => {
  if (video.liveBroadcastContent === 'live') {
    return `🔴 LIVE 🔴 - ${video.title}`
  }

  return `${video.title}`
}

export const createUndoButtonRow = (customId: string) => {
  const actionRowWithButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(UNDO.QUEUE).setLabel('Undo').setEmoji('↩️').setStyle(ButtonStyle.Secondary)
  )

  return actionRowWithButton
}
