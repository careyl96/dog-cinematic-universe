import fs from 'fs'
import youtubeDl from 'youtube-dl-exec'
import ytdl from '@distube/ytdl-core'
import axios from 'axios'

import { Readable } from 'form-data'
import { fetchPlaylistViaYts, fetchViaYTS } from './ytsHelpers'
import { formatYoutubeVideoFromIdSearch } from './youtubeFormatterHelpers'
import { PassThrough } from 'stream'
import { client } from '../..'
import { trackCtrl } from '../../backend/controllers/Controllers'
import { GuildSession } from '../../GuildSession'
import { ExtendedTrack } from '../../EmbedManager'

export type FormattedYoutubeVideo = {
  title: string
  url: string
  id: string
  duration: string
  thumbnail: string
  liveBroadcastContent: string
}

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
    maxResults: '100',
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
  session,
  urlOrQuery,
  useYts = false,
}: {
  session: GuildSession
  urlOrQuery: string
  useYts?: boolean
}): Promise<ExtendedTrack | FormattedYoutubeVideo | FormattedYoutubeVideo[]> => {
  const item = detectSource(urlOrQuery)

  const getYoutubeResult = async (
    {
      useBackupApi,
    }: {
      useBackupApi: boolean
    } = {
      useBackupApi: useYts,
    }
  ): Promise<FormattedYoutubeVideo | FormattedYoutubeVideo[] | ExtendedTrack> => {
    if (item.source === 'youtube') {
      if (item.type === 'playlist') {
        return useBackupApi ? fetchPlaylistViaYts(urlOrQuery) : fetchYoutubePlaylistById(item.id)
      }

      if (item.type === 'single') {
        const cached = await trackCtrl.getByIdAndFormat(item.id, session.guild.id)
        return (
          cached ??
          (useBackupApi
            ? fetchViaYTS({ query: urlOrQuery, isUrl: true, videoId: item.id })
            : fetchYoutubeVideoById(item.id))
        )
      }
    }

    if (item.source === 'spotify') {
      if (item.type === 'playlist') {
        const trackNames = await client.spotify.getPlaylistTracks(urlOrQuery)
        return useBackupApi
          ? Promise.all(trackNames.map((name) => fetchViaYTS({ query: name, isUrl: false })))
          : Promise.all(trackNames.map((name) => fetchYoutubeVideoByQuery(name)))
      }

      if (item.type === 'album') {
        const trackNames = await client.spotify.getAlbumTracks(urlOrQuery)
        return useBackupApi
          ? Promise.all(trackNames.map((name) => fetchViaYTS({ query: name, isUrl: false })))
          : Promise.all(trackNames.map((name) => fetchYoutubeVideoByQuery(name)))
      }

      if (item.type === 'single') {
        const name = await client.spotify.getTrackNameAndAuthor(urlOrQuery)
        return useBackupApi ? fetchViaYTS({ query: name, isUrl: false }) : fetchYoutubeVideoByQuery(name)
      }
    }

    // Default fallback if input doesn't match a known type
    return useBackupApi ? fetchViaYTS({ query: urlOrQuery, isUrl: false }) : fetchYoutubeVideoByQuery(urlOrQuery)
  }

  try {
    return await getYoutubeResult()
  } catch (error) {
    console.warn('Primary fetch failed. Trying fallback...')
    try {
      return await getYoutubeResult({ useBackupApi: true })
    } catch (fallbackErr) {
      console.error('Both YouTube API and yt-search failed:', fallbackErr)
      throw fallbackErr
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
export const createYoutubeAudioStream = (video: ExtendedTrack | FormattedYoutubeVideo): Readable => {
  console.log('creating audio stream!')
  const { url } = video
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
  // Return stream for bot audio streaming
  // Wrap the audio stream in a PassThrough to buffer and adjust the stream as needed
  const passThrough = new PassThrough({
    highWaterMark: 128 * 1024, // Adjust buffer size to 128KB
  })

  audioStream.pipe(passThrough)

  passThrough.on('data', (chunk) => {
    console.log('Received audio chunk, size:', chunk.length)
  })

  passThrough.on('end', () => {
    console.log('Audio stream ended')
  })

  return passThrough
}

const detectSource = (
  input: string
): {
  source: 'spotify' | 'youtube' | 'query'
  query?: string
  type?: 'single' | 'playlist' | 'album'
  id?: string
} => {
  // YouTube video URL
  // const youtubeVideoRegex = /^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:&.*)?$/
  const youtubeVideoRegex = /^https:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\?.*)?$/
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

  const spotifyAlbumRegex = /^https:\/\/open\.spotify\.com\/album\/([a-zA-Z0-9]+)(\?.*)?$/
  const albumMatch = input.match(spotifyAlbumRegex)
  if (albumMatch) {
    return { source: 'spotify', id: albumMatch[1], type: 'album' }
  }

  // Default to query (treated as single)
  return { source: 'query', query: input }
}
