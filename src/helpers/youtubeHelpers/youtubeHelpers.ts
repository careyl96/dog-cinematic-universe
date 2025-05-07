import fs from 'fs'
import youtubeDl from 'youtube-dl-exec'
import ytdl from '@distube/ytdl-core'

import axios from 'axios'
import { Readable } from 'form-data'
import { fetchPlaylistViaYts, fetchViaYTS } from './ytsHelpers'
import {
  extractYouTubeIdFromUrl,
  FormattedYoutubeVideo,
  formatYoutubeVideoFromIdSearch,
  isValidYoutubeUrl,
} from './youtubeFormatterHelpers'
import { PassThrough } from 'stream'
import { client } from '../..'
import { createErrorEmbed, createYoutubeEmbed } from '../embedHelpers'
import { MessageFlags } from 'discord.js'

// fetches single youtube video via youtube api and returns formatted video for music player using videoId
const fetchYoutubeVideoById = async (videoId: string) => {
  const params = new URLSearchParams({
    id: videoId,
    part: 'snippet, contentDetails',
    key: process.env.YOUTUBE_API_KEY,
  })
  const formattedAPIUrl = `https://www.googleapis.com/youtube/v3/videos?${params}`

  const response: any = await axios.get(formattedAPIUrl)
  const video = response.data.items[0]

  return formatYoutubeVideoFromIdSearch(video)
}
// fetches youtube playlist via youtube api and returns formatted videos for music player
const fetchYoutubePlaylistById = async (playlistId: string) => {
  const params = new URLSearchParams({
    playlistId,
    key: process.env.YOUTUBE_API_KEY,
    part: 'snippet',
    maxResults: '50',
  })
  console.log('##### Fetching playlist via official YouTube API')
  const formattedAPIUrl = `https://www.googleapis.com/youtube/v3/playlistItems?${params}`

  const response: any = await axios.get(formattedAPIUrl)
  const youtubeApiResponseItems = response.data.items

  const videos: FormattedYoutubeVideo[] = []
  for (const item of youtubeApiResponseItems) {
    const video = await fetchYoutubeVideoById(item.snippet.resourceId.videoId)
    videos.push(video)
  }

  return videos
}
// fetches youtube video via youtube api and returns formatted videos for music player using query
// this is used when the user provides a search query instead of a videoId
const fetchYoutubeVideoByQuery = async (urlOrQuery: string) => {
  const params = new URLSearchParams({
    q: urlOrQuery,
    key: process.env.YOUTUBE_API_KEY,
    part: 'snippet',
    maxResults: '1',
  })
  const formattedAPIUrl = `https://www.googleapis.com/youtube/v3/search?${params}`

  const response: any = await axios.get(formattedAPIUrl)
  const videoId = response.data.items[0].id.videoId

  return await fetchYoutubeVideoById(videoId)
}
/* -------------------------------------------------------------- */
// https://developers.google.com/youtube/v3/docs/search/list?apix_params=%7B%22part%22%3A%5B%22snippet%22%5D%2C%22maxResults%22%3A1%2C%22q%22%3A%22blue%22%7D#usage
// https://developers.google.com/youtube/v3/getting-started#quota
// https://developers.google.com/youtube/v3/docs/errors
// fetches a single youtube video based on url or query
export const fetchYoutubeVideoFromUrlOrQuery = async ({
  urlOrQuery,
  useYts = false,
  interaction,
}: {
  urlOrQuery: string
  useYts?: boolean
  interaction?: any
}): Promise<FormattedYoutubeVideo | FormattedYoutubeVideo[]> => {
  const isUrl = isValidYoutubeUrl(urlOrQuery)
  let playlistId: string | null = null
  let videoId: string | null = null

  if (isUrl) {
    try {
      const url = new URL(urlOrQuery)
      playlistId = url.searchParams.get('list')
      videoId = url.searchParams.get('v') || extractYouTubeIdFromUrl(urlOrQuery)
    } catch (err) {
      console.warn('Failed to parse YouTube URL:', err)
    }
  }

  const fallback = async () => {
    console.log('##### Using yt-search fallback')
    return playlistId ? fetchPlaylistViaYts(urlOrQuery) : fetchViaYTS(urlOrQuery, isUrl, videoId)
  }

  try {
    if (useYts) return await fallback()

    if (playlistId) return await fetchYoutubePlaylistById(playlistId)
    if (isUrl && videoId) return await fetchYoutubeVideoById(videoId)

    return await fetchYoutubeVideoByQuery(urlOrQuery)
  } catch (err) {
    console.warn('Primary fetch failed. Query:', urlOrQuery, 'VideoId:', videoId)
    console.error(err)

    try {
      return await fallback()
    } catch (fallbackErr) {
      console.error('Both YouTube API and yt-search failed:', fallbackErr)

      const errorEmbed = createErrorEmbed({
        errorMessage: `Video unavailable: ${urlOrQuery}`,
        flags: MessageFlags.Ephemeral,
      }) as any
      if (interaction && !interaction.replied) {
        interaction.followUp(errorEmbed)
      } else {
        client.musicPlayer?.textChannel?.send(errorEmbed)
      }
    }
  }
}

// @distube/ytdl-core, use if something goes wrong with youtube-dl-exec
export const createYoutubeAudioStreamYtdl = (url: string): Readable => {
  if (!url) throw new Error('YouTube video URL is undefined (createYoutubeAudioStream)')

  const agent = ytdl.createAgent(JSON.parse(fs.readFileSync('./cookies.json', 'utf-8')))

  const audioStream = ytdl(url, {
    filter: 'audioonly',
    quality: 'highestaudio',
    highWaterMark: 1 << 25, // increases buffer size
    agent,
  })

  return audioStream
}

// // creates the audio stream necessary for discord's audio player
// // using youtube-dl-exec
export const createYoutubeAudioStream = (url: string): Readable => {
  if (!url) throw new Error('YouTube video URL is undefined (createYoutubeAudioStream)')

  const process = youtubeDl.exec(
    url,
    {
      output: '-',
      format: 'bestaudio',
      noWarnings: true,
      ignoreErrors: true,
      quiet: false, // Set to false for verbose logs
      abortOnError: true,
      newline: true,
    },
    {
      stdio: ['ignore', 'pipe', 'ignore'],
    }
  )

  const audioStream = process.stdout

  // Wrap the audio stream in a PassThrough to buffer and adjust the stream as needed
  const bufferedStream = new PassThrough({
    highWaterMark: 128 * 1024, // Adjust buffer size to 128KB
  })

  audioStream.pipe(bufferedStream)

  // Error handling for the stream
  audioStream.on('error', (err) => {
    console.error('Audio stream error:', err)
  })

  return bufferedStream
}
