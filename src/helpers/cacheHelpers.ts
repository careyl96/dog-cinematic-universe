import fs from 'fs'
import path from 'path'
import { PATH } from '../constants'
import {
  createYoutubeUrlFromId,
  FormattedYoutubeVideo,
  FormattedYoutubeVideoCompressed,
  YoutubeCache,
} from './youtubeHelpers/youtubeFormatterHelpers'

export const getVideoDataFromCache = (id: string): FormattedYoutubeVideo => {
  const videoDataCacheJson = path.join(PATH.AUDIO_FILES.GENERATED.YOUTUBE.DEFAULT, 'cache.json')
  if (fs.existsSync(videoDataCacheJson)) {
    const cache: YoutubeCache = JSON.parse(fs.readFileSync(videoDataCacheJson, 'utf-8'))
    const maybeCompressed = cache[id]
    if (maybeCompressed) {
      const video =
        typeof maybeCompressed === 'object' && !('url' in maybeCompressed)
          ? {
              ...maybeCompressed,
              url: createYoutubeUrlFromId(maybeCompressed.id),
              thumbnail: `https://i.ytimg.com/vi/${maybeCompressed.id}/default.jpg`,
              liveBroadcastContent: maybeCompressed.liveBroadcastContent || 'none',
            }
          : maybeCompressed
      return video as FormattedYoutubeVideo
    }
  }
  return null
}

export const getAudioFileFromCache = (id: string): string | null => {
  const audioFileCachePath = path.join(PATH.AUDIO_FILES.GENERATED.YOUTUBE.CACHE, `${id}.ogg`)
  return fs.existsSync(audioFileCachePath) ? audioFileCachePath : null
}
