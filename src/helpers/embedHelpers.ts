import { EmbedBuilder, InteractionReplyOptions, MessageCreateOptions, MessageFlags } from 'discord.js'
import {
  extractYouTubeIdFromUrl,
  FormattedYoutubeVideo,
  parseTitleWithDurationToIso,
} from './youtubeHelpers/youtubeFormatterHelpers'
import { stripTimeFromTitle } from './formatterHelpers'

export type NowPlayingEmbedState = 'loading' | 'playing' | 'paused' | 'finished' | 'skipped' | 'error'

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

export const createYoutubeEmbed = (options: {
  youtubeVideo: any
  userId: string
  upNext?: any
  state?: NowPlayingEmbedState
  skippedByUserId?: string
  error?: any
}) => {
  const { youtubeVideo, userId, upNext, state, skippedByUserId, error } = options

  let stateString = ''
  let color = 0xa0c980
  switch (state) {
    case 'loading':
      stateString = `Loading...`
      color = 0x8c8c8c
      break
    case 'playing':
      stateString = `Now playing:`
      color = 0xa0c980
      break
    case 'paused':
      stateString = `Paused`
      color = 0x8c8c8c
      break
    case 'finished':
      stateString = `Track finished`
      color = 0x0055cc
      break
    case 'skipped':
      stateString = `Track skipped`
      color = 0xe098e0
      break
    case 'error':
      stateString = `Error: ${error?.message.slice(0, 240)}`
      color = 0xec7278
      break
    default:
      stateString = `Now playing:`
      color = 0xa0c980
      break
  }

  let description = `Requested by: <@${userId}>`
  description = skippedByUserId ? description + `\nSkipped by: <@${skippedByUserId}>` : description

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${youtubeVideo.title}${youtubeVideo.duration ? ` - (${youtubeVideo.duration})` : ''}`)
    .setURL(youtubeVideo.url)
    .setDescription(description)
    .setAuthor({
      name: stateString,
    })
    .setThumbnail(youtubeVideo.thumbnail)
    .setTimestamp()

  if (upNext && (state === 'playing' || state === 'paused')) {
    embed.addFields({
      name: 'Up next:',
      value: !!upNext
        ? `${upNext.video.title}${youtubeVideo.duration ? ` - (${youtubeVideo.duration})` : ''} <@${upNext.userId}>`
        : '*Queue is empty!*',
    })
  }

  return embed
}

export const createYoutubeErrorEmbed = (options: { youtubeVideo: any; userId: string; err: any }) => {
  const { youtubeVideo, userId, err } = options
  return new EmbedBuilder()
    .setColor(0xec7278)
    .setTitle(`${youtubeVideo.title} - (${youtubeVideo.duration})`)
    .setURL(youtubeVideo.url)
    .setDescription(`Requested by: <@${userId}>`)
    .setAuthor({
      name: `Error: ${err?.message.slice(0, 240)}`,
    })
    .setThumbnail(youtubeVideo.thumbnail!)
}

export const createQueueEmbed = (options: { text: string }) => {
  const { text } = options
  return new EmbedBuilder().setColor(0xffa200).setDescription(`### Queue: \n${text}`)
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

export const createLikedEmbed = (options: { text: string }) => {
  const { text } = options
  return new EmbedBuilder().setColor(0xffa200).setDescription(`### Liked songs: \n${text}`)
}

export const getVideoDataFromMessage = (message: any): FormattedYoutubeVideo => {
  const isMusicEmbed = message.embeds.length === 1 && message.embeds[0].data?.description?.includes('Requested by: ')

  if (!isMusicEmbed) return

  const embedData = message.embeds[0].data

  const videoData: FormattedYoutubeVideo = {
    title: stripTimeFromTitle(embedData.title),
    url: embedData.url,
    id: extractYouTubeIdFromUrl(embedData.url),
    duration: parseTitleWithDurationToIso(embedData.title),
    thumbnail: embedData.thumbnail.url,
  }
  return videoData
}
