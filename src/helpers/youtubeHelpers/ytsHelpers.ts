import yts from 'yt-search'
import { createYoutubeUrlFromId, FormattedYoutubeVideo, isValidYoutubeUrl } from './youtubeFormatterHelpers'
import { timestampToISO } from '../formatterHelpers'

// --- YT-Search helpers
export const fetchViaYTS = async ({
  query,
  isUrl,
  videoId,
}: {
  query: string
  isUrl: boolean
  videoId?: string | null
}): Promise<FormattedYoutubeVideo> => {
  if (isUrl && videoId) {
    const response = await yts({ videoId })
    return formatYTSFromIdSearch(response)
  }

  const response = await yts(query)
  if (!response?.all?.length) throw new Error('No search results found')
  const videoResults = response.all.filter((result) => result.type === 'video' || result.type === 'live')
  return formatYTSFromQuerySearch(videoResults[0])
}

export const fetchPlaylistViaYts = async (playlistUrl: string): Promise<FormattedYoutubeVideo[]> => {
  const parsedUrl = new URL(playlistUrl)
  const playlistId = parsedUrl.searchParams.get('list')

  try {
    const response = await yts({ listId: playlistId })
    return response.videos.map((video) => formatYTSFromQuerySearch(video))
  } catch (err) {
    console.error('Error fetching playlist:', err)
    throw new Error('Playlist unavailable')
  }
}

export const formatYTSFromIdSearch = (video: any): FormattedYoutubeVideo => {
  // {
  //   title: 'yung kai - blue (official music video)',
  //   description: 'Stream my track and follow me on socials: https://linktr.ee/yungkaiboy\n' +
  //   url: 'https://youtube.com/watch?v=IpFX2vq8HKw',
  //   videoId: 'IpFX2vq8HKw',
  //   seconds: 221,
  //   timestamp: '3:41',
  //   duration: { toString: [Function: toString], seconds: 221, timestamp: '3:41' },
  //   views: 94447616,
  //   genre: 'people & blogs',
  //   uploadDate: '2024-12-11',
  //   ago: '3 months ago',
  //   image: 'https://i.ytimg.com/vi/IpFX2vq8HKw/hqdefault.jpg',
  //   thumbnail: 'https://i.ytimg.com/vi/IpFX2vq8HKw/hqdefault.jpg',
  //   author: { name: 'yung kai', url: 'https://youtube.com/@ykaizzk' }
  // }

  const formattedVideo = {} as any

  formattedVideo.title = video.title
  formattedVideo.url = video.url
  formattedVideo.id = video.videoId
  formattedVideo.duration = timestampToISO(video.duration?.timestamp) || null
  formattedVideo.thumbnail = video.thumbnail

  // to keep consistent with youtube api response
  formattedVideo.liveBroadcastContent = 'none'

  return formattedVideo
}

export const formatYTSFromQuerySearch = (video: any): FormattedYoutubeVideo => {
  // {
  //   type: 'video',
  //   videoId: 'YQHsXMglC9A',
  //   url: 'https://youtube.com/watch?v=YQHsXMglC9A',
  //   title: 'Adele - Hello (Official Music Video)',
  //   description: 'Directed by Xavier Dolan, @XDolan Follow Adele on: Facebook - https://www.facebook.com/Adele Twitter ...',
  //   image: 'https://i.ytimg.com/vi/YQHsXMglC9A/hq720.jpg',
  //   thumbnail: 'https://i.ytimg.com/vi/YQHsXMglC9A/hq720.jpg',
  //   seconds: 367,
  //   timestamp: '6:07',
  //   duration: { toString: [Function: toString], seconds: 367, timestamp: '6:07' },
  //   ago: '9 years ago',
  //   views: 3196158186,
  //   author: {
  //     name: 'Adele',
  //     url: 'https://youtube.com/channel/UCsRM0YB_dabtEPGPTKo-gcw'
  //   }
  // }
  const formattedVideo = {} as any

  // formattedVideo.title = liveVideo ? `🔴 LIVE 🔴 - ${video.title}` : video.title
  formattedVideo.title = video.title
  formattedVideo.url = video.url || createYoutubeUrlFromId(video.videoId)
  formattedVideo.id = video.videoId
  formattedVideo.duration = timestampToISO(video.duration?.timestamp) || null
  formattedVideo.thumbnail = video.thumbnail

  // to keep consistent with youtube api response
  formattedVideo.liveBroadcastContent = video.type === 'live' ? 'live' : 'none'

  return formattedVideo
}
