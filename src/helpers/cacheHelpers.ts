import fs from 'fs'
import path from 'path'
import { MAX_AUDIO_FILES, PATH } from '../constants'
import {
  createYoutubeUrlFromId,
  FormattedYoutubeVideo,
  toCompressedYoutubeVideo,
  YoutubeCache,
} from './youtubeHelpers/youtubeFormatterHelpers'
import { formatFramedCommand } from './formatterHelpers'
import { Readable } from 'stream'
import ffmpeg from 'fluent-ffmpeg'

export const cacheAudioResource = async (stream: Readable, video: FormattedYoutubeVideo) => {
  const tempPath = path.join(PATH.AUDIO_FILES.GENERATED.YOUTUBE.CACHE, `temp.ogg`)
  const outputPath = path.join(PATH.AUDIO_FILES.GENERATED.YOUTUBE.CACHE, `${video.id}.ogg`)
  const musicCacheJsonFilePath = path.join(PATH.AUDIO_FILES.GENERATED.YOUTUBE.DEFAULT, 'cache.json')
  let musicCacheJson: YoutubeCache = {}

  fs.mkdirSync(PATH.AUDIO_FILES.GENERATED.YOUTUBE.DEFAULT, { recursive: true })
  if (fs.existsSync(musicCacheJsonFilePath)) {
    musicCacheJson = JSON.parse(fs.readFileSync(musicCacheJsonFilePath, 'utf-8'))
    if (musicCacheJson[video.id]) return
  }

  const addVideoDataToJSONCache = () => {
    const cacheKeys = Object.keys(musicCacheJson)
    if (!musicCacheJson[video.id] && cacheKeys.length >= MAX_AUDIO_FILES) {
      const oldestKey = cacheKeys[0] // Insertion order is preserved

      // delete .ogg from disk and evict from cache
      fs.unlink(path.join(PATH.AUDIO_FILES.GENERATED.YOUTUBE.CACHE, `${oldestKey}.ogg`), (err) => {
        if (err) {
          console.error('error deleting file:', err)
        } else {
          delete musicCacheJson[oldestKey]
          console.log(`evicted ${oldestKey}.ogg`)
        }
      })
    }
    const compressed = toCompressedYoutubeVideo(video)
    musicCacheJson[video.id] = compressed

    // NOTE: this writes the json file with human readable indentation (which occupies additional space)
    // TODO: small optimization would be to remove spacing to save on space
    fs.writeFileSync(musicCacheJsonFilePath, JSON.stringify(musicCacheJson, null, 2), 'utf-8')
  }

  const addVideoDataToAudioCache = () => {
    fs.rename(tempPath, outputPath, (error) => {
      if (error) {
        // Show the error
        console.error(error)
      } else {
        formatFramedCommand(`${video.id}.ogg saved to cache successfully`)
      }
    })
  }

  // save audio file
  await new Promise<void>((resolve, reject) => {
    ffmpeg(stream)
      .audioCodec('copy')
      .format('ogg')
      .on('error', async (err: any) => {})
      .on('end', () => {
        addVideoDataToJSONCache()
        addVideoDataToAudioCache()
        // enforceFileLimit(PATH.AUDIO_FILES.GENERATED.YOUTUBE.CACHE)
        resolve()
      })
      .save(tempPath)
  })
}
export const getVideoDataFromCache = (id: string): FormattedYoutubeVideo => {
  const videoDataCacheJson = path.join(PATH.AUDIO_FILES.GENERATED.YOUTUBE.DEFAULT, 'cache.json')
  if (fs.existsSync(videoDataCacheJson)) {
    const cache: YoutubeCache = JSON.parse(fs.readFileSync(videoDataCacheJson, 'utf-8'))
    const cachedVideo = cache[id]
    if (cachedVideo) {
      const video = {
        ...cachedVideo,
        url: createYoutubeUrlFromId(cachedVideo.id),
        thumbnail: `https://i.ytimg.com/vi/${cachedVideo.id}/default.jpg`,
        liveBroadcastContent: cachedVideo.liveBroadcastContent || 'none',
      }
      return video as FormattedYoutubeVideo
    }
  }
  return null
}

export const getAudioFileFromCache = (id: string): string | null => {
  const audioFileCachePath = path.join(PATH.AUDIO_FILES.GENERATED.YOUTUBE.CACHE, `${id}.ogg`)
  return fs.existsSync(audioFileCachePath) ? audioFileCachePath : null
}
