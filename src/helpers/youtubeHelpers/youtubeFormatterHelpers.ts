export interface FormattedYoutubeVideo {
  title: string
  url: string
  id: string
  duration: string
  thumbnail: string
}

export const formatYoutubeVideoFromIdSearch = (video: any): FormattedYoutubeVideo => {
  const formattedVideo = {} as any

  let liveVideo = video.snippet.liveBroadcastContent === 'live'

  formattedVideo.title = liveVideo ? `🔴 LIVE 🔴 - ${video.snippet.title}` : video.snippet.title
  formattedVideo.url = `https://www.youtube.com/watch?v=${video.id}`
  formattedVideo.id = video.id
  formattedVideo.duration = formatDuration(video.contentDetails.duration)
  formattedVideo.thumbnail = video.snippet.thumbnails.default.url

  return formattedVideo
}

export const extractYouTubeIdFromUrl = (url: string) => {
  let match = url.match(/(?:youtube\.com\/(?:.*[?&]v=|embed\/|v\/|shorts\/)|youtu\.be\/)([^?&/]+)/)

  return match ? match[1] : ''
}

export const createYoutubeUrlFromId = (videoId: string) => {
  return `https://youtube.com/watch?v=${videoId}`
}

export const formatDuration = (isoDuration: string) => {
  // Extract hours, minutes, and seconds using regex
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)

  if (!match) return ''

  let hours = match[1] ? parseInt(match[1]) : 0
  let minutes = match[2] ? parseInt(match[2]) : 0
  let seconds = match[3] ? parseInt(match[3]) : 0

  // Format time components with leading zeros where necessary
  let formattedTime = [
    hours > 0 ? hours : null, // Include hours only if it's greater than 0
    hours > 0 || minutes > 9 ? minutes.toString().padStart(2, '0') : minutes, // Keep two digits for minutes if hours exist
    seconds.toString().padStart(2, '0'), // Always keep two digits for seconds
  ]
    .filter((val) => val !== null)
    .join(':') // Remove null values

  return formattedTime
}

// takes the time from the title and returns the time formatted to ISO (e.g. 3:27 -> PT3M27S)
export const parseTitleWithDurationToIso = (input: string) => {
  const match = input.match(/\((\d+):(\d+)/)
  if (!match) return null

  const minutes = parseInt(match[1], 10)
  const seconds = parseInt(match[2], 10)

  let iso = 'PT'
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

