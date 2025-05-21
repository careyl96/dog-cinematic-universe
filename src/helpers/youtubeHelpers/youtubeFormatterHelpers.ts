export interface FormattedYoutubeVideo {
  title: string
  url: string
  id: string
  duration: string
  thumbnail: string
  liveBroadcastContent?: 'live' | 'none'
}

export interface FormattedYoutubeVideoCompressed
  extends Pick<FormattedYoutubeVideo, 'title' | 'id' | 'duration' | 'liveBroadcastContent'> {}

export const toCompressedYoutubeVideo = ({
  title,
  id,
  duration,
  liveBroadcastContent,
}: FormattedYoutubeVideo): FormattedYoutubeVideoCompressed => ({
  title: title,
  id: id,
  duration: duration,
  ...(liveBroadcastContent ? { liveBroadcastContent: liveBroadcastContent } : {}),
})

export interface YoutubeCache {
  [key: string]: FormattedYoutubeVideo | FormattedYoutubeVideoCompressed
}

export const formatYoutubeVideoFromIdSearch = (video: any): FormattedYoutubeVideo => {
  // {
  //   title: 'Initial D - Running in The 90s',
  //   url: 'https://youtube.com/watch?v=XCiDuy4mrWU',
  //   id: 'XCiDuy4mrWU',
  //   duration: 'PT4M46S',
  //   thumbnail: 'https://i.ytimg.com/vi/XCiDuy4mrWU/hqdefault.jpg',
  //   liveBroadcastContent: 'none'
  // }
  const formattedVideo = {} as any
  // formattedVideo.title = isLiveVideo ? `🔴 LIVE 🔴 - ${video.snippet.title}` : video.snippet.title
  formattedVideo.title = video.snippet.title
  formattedVideo.url = `https://www.youtube.com/watch?v=${video.id}`
  formattedVideo.id = video.id
  formattedVideo.duration = video.contentDetails.duration
  formattedVideo.thumbnail = video.snippet.thumbnails.default.url
  formattedVideo.liveBroadcastContent = video.snippet.liveBroadcastContent

  return formattedVideo
}

export const extractYouTubeIdFromUrl = (url: string) => {
  let match = url.match(/(?:youtube\.com\/(?:.*[?&]v=|embed\/|v\/|shorts\/)|youtu\.be\/)([^?&/]+)/)

  return match ? match[1] : ''
}

export const createYoutubeUrlFromId = (videoId: string) => {
  return `https://youtube.com/watch?v=${videoId}`
}

// takes the time from the title and returns the time formatted to ISO (e.g. 3:27 -> PT3M27S)
export const parseTitleWithDurationToIso = (input: string) => {
  const match = input.match(/\((\d{1,2}):(?:(\d{2}):)?(\d{2})\)/)
  if (!match) return null

  const hasHours = !!match[2]

  const hours = hasHours ? parseInt(match[1], 10) : 0
  const minutes = hasHours ? parseInt(match[2], 10) : parseInt(match[1], 10)
  const seconds = parseInt(match[3], 10)

  let iso = 'PT'
  if (hours > 0) iso += `${hours}H`
  if (minutes > 0) iso += `${minutes}M`
  if (seconds > 0) iso += `${seconds}S`

  return iso
}

export const isValidYoutubeUrl = (url: string): boolean => {
  if (!url) return false

  const regex =
    /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/(watch\?v=|embed\/|v\/|shorts\/|playlist\?list=)?([a-zA-Z0-9_-]+)(\S+)?$/

  return regex.test(url)
}
