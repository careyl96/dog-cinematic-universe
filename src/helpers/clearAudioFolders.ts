import fs from 'fs-extra'
import { PATH } from '../constants'

export const clearAudioFolders = async () => {
  const folders = [
    PATH.AUDIO_FILES.GENERATED.PCM,
    PATH.AUDIO_FILES.GENERATED.TTS,
    PATH.AUDIO_FILES.GENERATED.WAV,
    PATH.AUDIO_FILES.GENERATED.YOUTUBE,
  ]

  try {
    await Promise.all(
      folders.map(async (folder) => {
        await fs.emptyDir(folder)
        // console.log(`${folder} cleared successfully`)
      })
    )
  } catch (err) {
    console.error('!!! Error clearing folders:', err)
  }
}
