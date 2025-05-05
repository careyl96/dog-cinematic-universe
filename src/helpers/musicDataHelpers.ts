import fs from 'fs'
import path from 'path'
import { BOT_USER_ID, PATH } from '../constants'
import { FormattedYoutubeVideo } from './youtubeHelpers/youtubeFormatterHelpers'

type MusicHistory = {
  [videoId: string]: FormattedYoutubeVideo & {
    requestCount: number
  }
}

type LikedMusic = {
  [videoId: string]: FormattedYoutubeVideo
}

export const getUserMusicHistory = (userId: string) => {
  const dirPath = path.join(PATH.USER_DATA, userId)
  const filePath = path.join(dirPath, 'music_queue_history.json')

  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }
}

export const getCachedTracks = () => {
  const cacheJsonFilePath = path.join(PATH.AUDIO_FILES.GENERATED.YOUTUBE.DEFAULT, 'cache.json')

  if (fs.existsSync(cacheJsonFilePath)) {
    return JSON.parse(fs.readFileSync(cacheJsonFilePath, 'utf-8'))
  }
}

export const createOrUpdateUserMusicHistory = (userId: string, data: MusicHistory) => {
  const dirPath = path.join(PATH.USER_DATA, userId)
  const filePath = path.join(dirPath, 'music_queue_history.json')

  // Ensure the directory exists
  fs.mkdirSync(dirPath, { recursive: true })

  // Write the file
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  // console.log(`Updated music history: ${userId} at ${filePath}`)
}

export const createOrUpdateUsersLikedMusic = (userId: string, data: LikedMusic | string) => {
  const dirPath = path.join(PATH.USER_DATA, userId)
  const filePath = path.join(dirPath, 'liked_music.json')

  // Ensure the directory exists
  fs.mkdirSync(dirPath, { recursive: true })

  // Write the file
  let existingData: LikedMusic = {}

  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      existingData = JSON.parse(fileContent)
    } catch (err) {
      console.error('Error reading or parsing existing liked_music.json:', err)
    }
  }

  // Merge new data into existing data (append/update)
  let updatedData: LikedMusic = { ...existingData }

  if (typeof data === 'string') {
    delete updatedData[data]
  } else {
    updatedData = {
      ...updatedData,
      ...data,
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf-8')
  // console.log(`Users liked music created/updated for user: ${userId} at ${filePath}`)
}

export const createOrUpdateSongBlacklist = (data: string | string[], remove: boolean = false) => {
  const dirPath = path.join(PATH.USER_DATA, BOT_USER_ID)
  const filePath = path.join(dirPath, 'blacklisted_music.json')

  // Ensure the directory exists
  fs.mkdirSync(dirPath, { recursive: true })

  let existingData: string[] = []

  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      existingData = JSON.parse(fileContent)
    } catch (err) {
      console.error('Error reading or parsing blacklisted_music.json:', err)
    }
  }

  const inputIds = Array.isArray(data) ? data : [data]

  let updatedData: string[]
  if (remove) {
    updatedData = existingData.filter((id) => !inputIds.includes(id))
  } else {
    const newSet = new Set([...existingData, ...inputIds])
    updatedData = Array.from(newSet)
  }

  fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf-8')
}

export const updateHistoryFile = (filePath: string, video: FormattedYoutubeVideo) => {
  let history: Record<string, any> = {}

  if (fs.existsSync(filePath)) {
    history = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }

  const videoId = video.id
  const prev = history[videoId]

  history[videoId] = {
    ...video,
    ...prev,
    requestCount: (prev?.requestCount ?? 0) + 1,
  }

  const userId = filePath.split('/').slice(-2, -1)[0] // Extract user ID from path
  createOrUpdateUserMusicHistory(userId, history)
}
