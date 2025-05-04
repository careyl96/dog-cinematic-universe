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
import path from 'path'

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
export const fetchYoutubeVideoFromUrlOrQuery = async (options: {
  urlOrQuery: string
  useYts?: boolean
}): Promise<FormattedYoutubeVideo | FormattedYoutubeVideo[]> => {
  const { urlOrQuery, useYts = false } = options

  const isUrl = isValidYoutubeUrl(urlOrQuery)
  let playlistId: string | null = null
  let videoId: string | null = null

  if (isUrl) {
    try {
      const url = new URL(urlOrQuery)
      playlistId = url.searchParams.get('list')
      const vParam = url.searchParams.get('v')

      if (!playlistId && vParam) {
        videoId = extractYouTubeIdFromUrl(urlOrQuery) as string
      }
    } catch (err) {
      console.warn('Failed to parse YouTube URL:', err)
    }
  }

  const handleYtsFallback = async () => {
    console.log('##### Using yt-search fallback')
    if (playlistId) {
      console.log('###### Detected playlist URL')
      return fetchPlaylistViaYts(urlOrQuery)
    }
    return fetchViaYTS(urlOrQuery, isUrl, videoId)
  }

  try {
    if (useYts) {
      return await handleYtsFallback()
    }

    if (playlistId) {
      return await fetchYoutubePlaylistById(playlistId)
    }

    return isUrl
      ? await fetchYoutubeVideoById(videoId!)
      : await fetchYoutubeVideoByQuery(urlOrQuery)
  } catch (err: any) {
    console.warn('YouTube API failed, falling back to yt-search')
    console.warn('Query:', urlOrQuery)
    if (videoId) console.warn('Extracted videoId:', videoId)

    try {
      return await handleYtsFallback()
    } catch (fallbackErr: any) {
      console.error('Both YouTube API and yt-search failed:', fallbackErr)
      throw new Error('Video unavailable')
    }
  }
}

// @distube/ytdl-core, use if something goes wrong with youtube-dl-exec
export const createYoutubeAudioStreamYtdl = (url: string): Readable => {
  if (!url)
    throw new Error('YouTube video URL is undefined (createYoutubeAudioStream)')

  const __dirname = path.resolve()

  console.log(path.join(__dirname, 'cookies.json'))
  const agent = ytdl.createAgent(
    JSON.parse(fs.readFileSync('./cookies.json', 'utf-8'))
  )

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
  if (!url)
    throw new Error('YouTube video URL is undefined (createYoutubeAudioStream)')

  const process = youtubeDl.exec(
    url,
    {
      output: '-',
      format: 'bestaudio',
      noWarnings: true,
      ignoreErrors: true,
      quiet: true,
      abortOnError: true,
      newline: true,
    },
    {
      stdio: ['ignore', 'pipe', 'ignore'], // Ensure stdout is piped
    }
  )

  const audioStream = process.stdout

  return audioStream
}
