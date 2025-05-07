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
export const fetchYoutubeVideosFromUrlOrQuery = async ({
  urlOrQuery,
  useYts = false,
  interaction,
}: {
  urlOrQuery: string
  useYts?: boolean
  interaction?: any
}): Promise<FormattedYoutubeVideo | FormattedYoutubeVideo[]> => {
  const item = detectSource(urlOrQuery)

  // yts fallback
  const fallback = async () => {
    if (item.source === 'youtube') {
      if (item.type === 'playlist') {
        return fetchPlaylistViaYts(urlOrQuery)
      } else if (item.type === 'single') {
        return fetchViaYTS({
          query: urlOrQuery,
          isUrl: true,
        })
      }
    }
    if (item.source === 'spotify') {
      if (item.type === 'playlist') {
        const trackNames = await client.spotify.getPlaylistTracks(urlOrQuery, 50)

        const videos: FormattedYoutubeVideo[] = []
        for (let trackName of trackNames) {
          videos.push(
            await fetchViaYTS({
              query: trackName,
              isUrl: false,
            })
          )
        }
        return videos
      } else if (item.type === 'single') {
        const query = await client.spotify.getTrackNameAndAuthor(urlOrQuery)
        return fetchViaYTS({ query, isUrl: false })
      }
    }
  }

  try {
    if (useYts) return await fallback()

    if (item.source === 'youtube') {
      if (item.type === 'playlist') {
        return await fetchYoutubePlaylistById(item.id)
      } else if (item.type === 'single') {
        return await fetchYoutubeVideoById(item.id)
      }
    }

    if (item.source === 'spotify') {
      if (item.type === 'playlist') {
        const trackNames = await client.spotify.getPlaylistTracks(urlOrQuery, 50)
        const videos: FormattedYoutubeVideo[] = []
        for (let trackName of trackNames) {
          videos.push(await fetchYoutubeVideoByQuery(trackName))
        }
        return videos
      } else if (item.type === 'single') {
        const trackName = await client.spotify.getTrackNameAndAuthor(urlOrQuery)
        return fetchYoutubeVideoByQuery(trackName)
      }
    }

    return await fetchYoutubeVideoByQuery(urlOrQuery)
  } catch (error) {
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

const detectSource = (
  input: string
): {
  source: 'spotify' | 'youtube' | 'query'
  query?: string
  type?: 'single' | 'playlist'
  id?: string
} => {
  // YouTube video URL
  const youtubeVideoRegex = /^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:&.*)?$/
  const videoMatch = input.match(youtubeVideoRegex)
  if (videoMatch) {
    return { source: 'youtube', id: videoMatch[1], type: 'single' }
  }

  // YouTube playlist URL
  const youtubePlaylistRegex = /^https:\/\/(?:www\.)?youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)(?:&.*)?$/
  const ytPlaylistMatch = input.match(youtubePlaylistRegex)
  if (ytPlaylistMatch) {
    return { source: 'youtube', id: ytPlaylistMatch[1], type: 'playlist' }
  }

  // Spotify track URL
  const spotifyTrackRegex = /^https:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)(\?.*)?$/
  const trackMatch = input.match(spotifyTrackRegex)
  if (trackMatch) {
    return { source: 'spotify', id: trackMatch[1], type: 'single' }
  }

  // Spotify playlist URL
  const spotifyPlaylistRegex = /^https:\/\/open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)(\?.*)?$/
  const playlistMatch = input.match(spotifyPlaylistRegex)
  if (playlistMatch) {
    return { source: 'spotify', id: playlistMatch[1], type: 'playlist' }
  }

  // Default to query (treated as single)
  return { source: 'query', query: input }
}
