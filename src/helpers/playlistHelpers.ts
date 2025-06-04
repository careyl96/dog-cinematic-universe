import path from 'path'
import { BOT_USER_ID, PATH } from '../constants'
import fs from 'fs'
import {
  extractYouTubeIdFromUrl,
  FormattedYoutubeVideo,
  FormattedYoutubeVideoCompressed,
  toCompressedYoutubeVideo,
} from './youtubeHelpers/youtubeFormatterHelpers'
import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js'
import { isoToTimestamp, sanitizeFilename, truncateText } from './formatterHelpers'

export interface Playlist {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  undeletable: boolean
  videos: { [key: string]: FormattedYoutubeVideoCompressed }
}

export const getPublicPlaylists = () => {
  const dirPath = path.join(PATH.USER_DATA, BOT_USER_ID)
  const botPlaylistPath = path.join(dirPath, 'playlists')
  // Check if playlists folder exists, create if not
  if (!fs.existsSync(botPlaylistPath)) {
    fs.mkdirSync(botPlaylistPath, { recursive: true })
  }

  const playlists = fs.readdirSync(botPlaylistPath)

  return playlists.map((filename) => {
    const playlistPath = path.join(botPlaylistPath, filename)
    const playlistData = fs.readFileSync(playlistPath, 'utf-8')
    const data = JSON.parse(playlistData)
    return data as Playlist
  })
}

export const getAllPlaylistsForUser = (userId: string): Playlist[] => {
  const dirPath = path.join(PATH.USER_DATA, userId)
  const userPlaylistPath = path.join(dirPath, 'playlists')
  // Check if playlists folder exists, create if not
  if (!fs.existsSync(userPlaylistPath)) {
    fs.mkdirSync(userPlaylistPath, { recursive: true })
  }

  const playlists = fs.readdirSync(userPlaylistPath)

  return playlists.map((filename) => {
    const playlistPath = path.join(userPlaylistPath, filename)
    const playlistData = fs.readFileSync(playlistPath, 'utf-8')
    const data = JSON.parse(playlistData)
    return data as Playlist
  })
}

export const getPlaylistForUserById = (userId: string, playlistId: string) => {
  const targetFile = getPlaylistFilePath(userId, playlistId)
  console.log(targetFile)
  try {
    const playlistData = fs.readFileSync(targetFile, 'utf-8')
    const data = JSON.parse(playlistData)
    console.log(data)
    return data as Playlist
  } catch (err) {
    console.error(`Error reading playlist ${playlistId}:`, err)
    return null
  }
}

export const getPlaylistFilePath = (userId: string, playlistId: string): string | null => {
  const dirPath = path.join(PATH.USER_DATA, userId)
  const userPlaylistPath = path.join(dirPath, 'playlists')

  if (!fs.existsSync(userPlaylistPath)) {
    fs.mkdirSync(userPlaylistPath, { recursive: true })
  }

  const targetFile = path.join(userPlaylistPath, `${playlistId}.json`)
  console.log(targetFile)

  if (!fs.existsSync(targetFile)) {
    return null // Or throw an error, depending on your use case
  }

  return targetFile
}

export const deletePlaylistForUserByPlaylistId = (userId: string, playlistIds: string[]) => {
  if (!playlistIds) throw new Error('No playlists selected')
  if (playlistIds.some((id) => id === 'liked_music')) throw new Error('Cannot delete liked music')

  const dirPath = path.join(PATH.USER_DATA, userId)
  const userPlaylistPath = path.join(dirPath, 'playlists')

  if (!fs.existsSync(userPlaylistPath)) {
    // No playlists directory means nothing to delete
    return
  }

  let deletedPlaylists = []
  for (const playlistId of playlistIds) {
    const targetFile = path.join(userPlaylistPath, `${playlistId}.json`)
    if (fs.existsSync(targetFile)) {
      try {
        const playlistData = fs.readFileSync(targetFile, 'utf-8')
        const data = JSON.parse(playlistData)
        fs.unlinkSync(targetFile)
        deletedPlaylists.push(data.name)
        console.log(`Deleted playlist: ${playlistId}`)
      } catch (err) {
        console.error(`Failed to delete playlist "${playlistId}":`, err)
      }
    } else {
      console.warn(`Playlist file not found: ${playlistId}`)
    }
  }

  return deletedPlaylists
}

export const createNewPlaylist = async ({
  userId,
  name,
  isPublic = false,
}: {
  userId: string
  name: string
  isPublic?: boolean
}) => {
  if (isPublic) userId = BOT_USER_ID

  const customId = sanitizeFilename(name)
  const playlistDir = path.join(PATH.USER_DATA, userId, 'playlists')
  const playlistFilePath = path.join(playlistDir, `${customId}.json`)

  const userPlaylists = await getAllPlaylistsForUser(userId)
  if (userPlaylists?.length >= 24) {
    throw new Error('⚠️ Playlist Limit Reached (25)')
  }
  if (userPlaylists?.some((playlist) => playlist.id === customId)) {
    throw new Error('❌ Playlist with this name already exists')
  } else if (name.length > 50) {
    throw new Error('❌ Playlist name must be less than 50 characters')
  } else if (name.length > 1000) {
    throw new Error('❌ really bro')
  }

  const newPlaylistData = {
    id: customId,
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    undeletable: false,
    videos: {},
  }

  fs.writeFileSync(playlistFilePath, JSON.stringify(newPlaylistData, null, 2))
  return userId
}

export const createPlaylistSelectMenu = ({
  playlists,
  customId,
  placeholderText,
  selectedValues = [],
  multiselect = false,
}: {
  playlists: Playlist[]
  customId: string
  placeholderText: string
  selectedValues?: string[]
  multiselect?: boolean
}) => {
  const playlistSelectMenu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholderText)

  if (multiselect) {
    playlistSelectMenu.setMinValues(1)
    playlistSelectMenu.setMaxValues(playlists.length)
  }

  playlistSelectMenu.addOptions(
    playlists
      .sort((a, b) => {
        if (a.id === 'liked_music') return -1
        if (b.id === 'liked_music') return 1
        return 0
      })
      .map((playlist) => {
        const isLiked = playlist.id === 'liked_music'
        const videoCount = Object.keys(playlist.videos).length || 0
        const label = `${playlist.name} (${videoCount})`
        const menuBuilder = new StringSelectMenuOptionBuilder()
          .setLabel(`${isLiked ? '❤️' : '📁🎶'} ${label}`)
          .setValue(playlist.id)
          .setDefault(selectedValues?.includes(playlist.id))
        return menuBuilder
      })
  )
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(playlistSelectMenu)
}

export const updatePlaylistForUserById = ({
  userId,
  playlistId,
  video,
  remove = false,
  removeUrls = [],
  isPublic = false,
}: {
  userId: string
  playlistId: string
  video?: FormattedYoutubeVideo
  remove?: boolean
  removeUrls?: string[]
  isPublic?: boolean
}) => {
  if (!playlistId) throw new Error('No playlist id provided')
  console.log(userId)
  const filePath = getPlaylistFilePath(userId, playlistId)
  let existingPlaylistData: { videos: { [key: string]: FormattedYoutubeVideoCompressed } } = { videos: {} }

  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      existingPlaylistData = JSON.parse(fileContent)
    } catch (err) {
      throw new Error(`Error reading or parsing existing ${playlistId}.json: ${err}`)
    }
  }

  if (remove) {
    if (!removeUrls.length) {
      throw new Error('No URLs provided for removal.')
    }

    const videoIdsToRemove = removeUrls.map(extractYouTubeIdFromUrl).filter((id): id is string => !!id)
    videoIdsToRemove.forEach((id) => {
      delete existingPlaylistData.videos[id]
    })

    const updatedData = {
      ...existingPlaylistData,
      updatedAt: new Date().toISOString(),
    }

    fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf-8')
    return
  }

  if (!video) {
    throw new Error('⚠️ No video provided')
  }

  if (existingPlaylistData.videos[video.id]) {
    throw new Error('⚠️ Track already exists in playlist')
  }

  const trackCount = Object.keys(existingPlaylistData.videos).length
  if (trackCount >= 25) {
    throw new Error('⚠️ Playlist track limit reached! (25)')
  }

  const formattedData = { [video.id]: toCompressedYoutubeVideo(video) }

  const updatedData = {
    ...existingPlaylistData,
    updatedAt: new Date().toISOString(),
    videos: {
      ...existingPlaylistData.videos,
      ...formattedData,
    },
  }

  fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2), 'utf-8')
}

export const createTrackSelectMenu = ({
  customId,
  videos,
  defaultValues,
  multiselect,
}: {
  customId: string
  videos: FormattedYoutubeVideo[]
  defaultValues?: string[]
  multiselect: boolean
}) => {
  const options = defaultValues
    ? videos.map((video) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`🎶 ${truncateText(video.title, 40)} || (${isoToTimestamp(video.duration)})`)
          .setValue(video.url)
          .setDefault(defaultValues.includes(video.url))
      )
    : videos.map((video) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`🎶 ${truncateText(video.title, 40)} || (${isoToTimestamp(video.duration)})`)
          .setValue(video.url)
      )

  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Select track(s) to queue/remove')
    .addOptions(options)
  if (multiselect) {
    menu.setMinValues(1)
    menu.setMaxValues(videos.length)
  }

  return menu
}
