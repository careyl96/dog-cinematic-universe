import fs from 'fs'
import path from 'path'
import { PATH } from '../constants'

export const getVideoDataFromCache = (id: string) => {
  const videoDataCacheJson = path.join(PATH.AUDIO_FILES.GENERATED.YOUTUBE.DEFAULT, 'cache.json')
  if (fs.existsSync(videoDataCacheJson)) {
    const cache = JSON.parse(fs.readFileSync(videoDataCacheJson, 'utf-8'))
    if (cache[id]) return cache[id]
  }
  return null
}

export const getAudioFileFromCache = (id: string): string | null => {
  const audioFileCachePath = path.join(PATH.AUDIO_FILES.GENERATED.YOUTUBE.CACHE, `${id}.ogg`)
  return fs.existsSync(audioFileCachePath) ? audioFileCachePath : null
}
