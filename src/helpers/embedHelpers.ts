import { EmbedBuilder, InteractionReplyOptions, MessageCreateOptions, MessageFlags } from 'discord.js'
import {
  extractYouTubeIdFromUrl,
  FormattedYoutubeVideo,
  parseTitleWithDurationToIso,
} from './youtubeHelpers/youtubeFormatterHelpers'
import {
  escapeDiscordMarkdown,
  generateProgressBar,
  isoToTimestamp,
  msToTimestamp,
  stripBackticks,
  stripTimeFromTitle,
  timestampToISO,
} from './formatterHelpers'
import { client } from '..'
import { CurrentlyPlaying } from '../MusicPlayer'

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

type CreateYoutubeEmbedOptions = {
  video: FormattedYoutubeVideo
  userId: string
  state?: NowPlayingEmbedState
  skippedByUserId?: string
  roulette?: boolean
  error?: any
  percentage?: number
}
export const createYoutubeEmbed = ({
  video,
  userId,
  state,
  skippedByUserId,
  roulette,
  error,
}: CreateYoutubeEmbedOptions) => {
  let stateString = ''
  const percentage = client.musicPlayer.currentlyPlaying?.elapsedPercentage ?? 0
  const progressBar = generateProgressBar(percentage, 10)
  let color

  switch (state) {
    case NowPlayingEmbedState.Loading:
      stateString = `Loading...`
      color = 0x8c8c8c
      break
    case NowPlayingEmbedState.Playing:
      stateString = `Now playing:`
      color = 0xa0c980
      break
    case NowPlayingEmbedState.Paused:
      stateString = `Paused`
      color = 0x8c8c8c
      break
    case NowPlayingEmbedState.Finished:
      stateString = `Track finished`
      color = 0x0055cc
      break
    case NowPlayingEmbedState.Skipped:
      stateString = `Track skipped`
      color = 0xe098e0
      break
    case NowPlayingEmbedState.Error:
      stateString = `Error: ${error?.message.slice(0, 240)}`
      color = 0xec7278
      break
    default:
      stateString = `Now playing:`
      color = 0xa0c980
      break
  }

  const currentlyPlaying = client.musicPlayer.currentlyPlaying
  let requestedByValue = `<@${userId}>${roulette ? ' via </roulette:1356769593208606791>' : ''}`
  let progressValue = ''
  if (state !== NowPlayingEmbedState.Finished) {
    // progressValue = `${state === NowPlayingEmbedState.Playing ? `<a:dogcited:782004922408894505> ` : ''}\`${msToTimestamp(currentlyPlaying.elapsedTime)}\` ${progressBar} \`${isoToTimestamp(video.duration)}\``
    progressValue = `\`${msToTimestamp(currentlyPlaying.elapsedTime)}\` ${progressBar} \`${isoToTimestamp(video.duration)}\``
  }

  const fields = [
    {
      name: '<:dentge:1194024284360814682> Requested by',
      value: requestedByValue,
      inline: true,
    },
    {
      name: '🕗 Duration',
      value: video.duration ? `\`${isoToTimestamp(video.duration)}\`` : '(Unknown)',
      inline: true,
    },
  ]

  if (skippedByUserId) {
    fields.push({
      name: '<:Flowuwu:823463092724826162> Skipped by',
      value: `<@${skippedByUserId}>`,
      inline: true,
    })
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${formatYoutubeVideoTitleForEmbed(video)} ${state === NowPlayingEmbedState.Playing ? `<a:dogcited:782004922408894505> ` : ''}`)
    .setURL(video.url)
    .setAuthor({
      name: stateString,
    })
    .addFields(...fields)
    .setThumbnail(video.thumbnail)
    .setTimestamp()

  progressValue && embed.setDescription(progressValue)

  return embed
}

export const createYoutubeErrorEmbed = (options: { youtubeVideo: any; userId: string; err: any }) => {
  const { youtubeVideo, userId, err } = options
  return new EmbedBuilder()
    .setColor(0xec7278)
    .setTitle(`${escapeDiscordMarkdown(youtubeVideo.title)} - (${isoToTimestamp(youtubeVideo.duration)})`)
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
  return new EmbedBuilder().setColor(0xff7f9f).setDescription(`### Liked songs: \n${text}`)
}

export const getVideoDataFromMessage = (message: any): FormattedYoutubeVideo => {
  const embedData = message.embeds[0]?.data
  const isMusicEmbed =
    (message.embeds?.length === 1 && embedData?.fields?.[0]?.name.includes('Requested by')) ||
    (message.embeds.length === 1 && embedData?.description?.includes('Requested by: '))

  if (!isMusicEmbed) return

  const isoDuration =
    timestampToISO(stripBackticks(embedData.fields[1].value)) || parseTitleWithDurationToIso(embedData.title)

  const videoData: FormattedYoutubeVideo = {
    title: stripTimeFromTitle(embedData.title),
    url: embedData.url,
    id: extractYouTubeIdFromUrl(embedData.url),
    duration: isoDuration,
    thumbnail: embedData.thumbnail.url,
  }
  return videoData
}

const formatYoutubeVideoTitleForEmbed = (video: FormattedYoutubeVideo): string => {
  if (video.liveBroadcastContent === 'live') {
    return `🔴 LIVE 🔴 - ${escapeDiscordMarkdown(video.title)}`
  }

  return `${escapeDiscordMarkdown(video.title)}`
}
