import { Track } from './youtubeHelpers/youtubeFormatterHelpers'
import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js'
import { isoToTimestamp, truncateText } from './formatterHelpers'

export const createPlaylistSelectMenu = ({
  playlists,
  customId,
  placeholderText,
  selectedValues = [],
  multiselect = false,
}: {
  playlists: any[]
  customId: string
  placeholderText: string
  selectedValues?: string[]
  multiselect?: boolean
}) => {
  const playlistSelectMenu = new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholderText)

  if (playlists.length === 0) {
    playlistSelectMenu.addOptions([
      new StringSelectMenuOptionBuilder().setLabel('No playlists available').setValue('none'),
    ])
    playlistSelectMenu.setDisabled(true)
  } else {
    if (multiselect) {
      playlistSelectMenu.setMinValues(1)
      playlistSelectMenu.setMaxValues(playlists.length)
    }

    // Sort playlists: deletable === false first, then by updatedAt desc
    playlists.sort((a, b) => {
      if (a.deletable === b.deletable) {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      }
      return a.deletable === false ? -1 : 1
    })

    playlistSelectMenu.addOptions(
      playlists.map((playlist) => {
        const videoCount = playlist.tracks.length
        const label = `${playlist.name} (${videoCount})`
        const id = playlist.id.toString()

        const icon = playlist.deletable === false ? '❤️' : '📁🎶'

        return new StringSelectMenuOptionBuilder()
          .setLabel(`${icon} ${label}`)
          .setValue(id)
          .setDefault(selectedValues?.includes(id))
      })
    )
  }

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(playlistSelectMenu)
}

export const createTrackSelectMenu = ({
  customId,
  videos,
  defaultValues = [],
  multiselect,
}: {
  customId: string
  videos: Track[]
  defaultValues?: string[]
  multiselect: boolean
}) => {
  const safeVideos = videos.slice(0, 25)

  let options: StringSelectMenuOptionBuilder[]

  if (safeVideos.length === 0) {
    options = [new StringSelectMenuOptionBuilder().setLabel('No tracks available').setValue('none').setDefault(false)]
  } else {
    options = safeVideos.map((video) => {
      const label = `🎶 ${truncateText(video.title, 40)} || (${isoToTimestamp(video.duration)})`
      const option = new StringSelectMenuOptionBuilder().setLabel(label).setValue(video.id)
      if (defaultValues.includes(video.id)) {
        option.setDefault(true)
      }
      return option
    })
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('Select track(s) to queue/remove')
    .addOptions(options)

  if (multiselect && safeVideos.length > 0) {
    menu.setMinValues(1)
    menu.setMaxValues(safeVideos.length)
  }

  if (safeVideos.length === 0) {
    menu.setDisabled(true)
  }

  return menu
}
