import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  Events,
  Interaction,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { createCustomEmbed, createUndoButtonRow } from '../helpers/embedHelpers'
import { escapeDiscordMarkdown, isoToTimestamp, timestampToISO, truncateText } from '../helpers/formatterHelpers'
import { queue } from '../helpers/playerFunctions'
import { extractYouTubeIdFromUrl, uncompressTrack } from '../helpers/youtubeHelpers/youtubeFormatterHelpers'
import { createPlaylistSelectMenu, createTrackSelectMenu } from '../helpers/playlistHelpers'
import { client } from '..'
import { playlistCtrl, trackCtrl } from '../backend/controllers/Controllers'
import { GuildSession } from '../GuildSession'
import { ensureVoiceConnectionOrReply } from '../helpers/voiceConnectionHelpers'
import { FormattedYoutubeVideo } from '../helpers/youtubeHelpers/youtubeHelpers'
import { Track } from '../backend/entities/Track'
import { ExtendedTrack } from '../EmbedManager'
import { UNDO } from '../constants'
import { AudioPlayerStatus } from '@discordjs/voice'

const PLAYLIST = {
  MAIN_MENU: 'main_menu',
  MAIN_MENU_UPDATE: 'main_menu:update',
  LIST: 'playlist:list',
  LIST_UPDATE: 'playlist:list:update',
  VIEW: 'playlist:view',
  VIEW_PUBLIC: 'playlist:view:public',
  CREATE: 'playlist:create',
  CREATE_CONFIRM: 'playlist:create:confirm',
  CREATE_FROM_TRACK: 'playlist:create:fromtrack',
  CREATE_FROM_TRACK_CONFIRM: 'playlist:create:fromtrack:confirm',

  EDIT: 'playlist:edit',

  DELETE: 'playlist:delete',
  DELETE_SELECT: 'playlist:delete:select',
  DELETE_CONFIRM: 'playlist:delete:confirm',

  ADD_TO_PLAYLIST: 'playlist:add',
  ADD_TRACK_CONFIRM: 'playlist:add:track:confirm',
  ADD_TRACK_PUBLIC_CONFIRM: 'playlist:add:track:public:confirm',

  REMOVE_TRACK_CONFIRM: 'playlist:track:remove',
  REMOVE_TRACK_CLEAR: 'playlist:track:remove:clear',

  TRACK_SELECT: 'playlist:track:select',
  QUEUE_TRACK_CONFIRM: 'playlist:queue:confirm',

  SELECTION_CLEAR: 'playlist:track:selection:clear',
}

// returns user to main menu
const backButton = new ButtonBuilder()
  .setCustomId(PLAYLIST.MAIN_MENU_UPDATE)
  .setLabel(`Main menu`)
  .setEmoji('⬅️')
  .setStyle(ButtonStyle.Secondary)

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(client: ClientWithCommands, session: GuildSession, interaction: Interaction) {
    console.log(interaction.customId)
    if (!session || !session.musicPlayer) return

    const userId = interaction.user.id
    const guildId = session.guild.id
    const musicPlayer = session.musicPlayer

    const state = session.getUserState(userId)
    const userPlaylists = await playlistCtrl.getByUserId(userId)
    const publicPlaylists = await playlistCtrl.getPublicByGuildId(guildId)

    if (interaction.isButton()) {
      const playlistOptions = [{ name: '🌱 - Create new playlist', customId: PLAYLIST.CREATE }]

      if (userPlaylists?.length > 0) {
        playlistOptions.unshift({ name: '📁 - View playlists', customId: PLAYLIST.LIST_UPDATE })
        playlistOptions.push({ name: '🗑️ - Delete Playlist', customId: PLAYLIST.DELETE })
      }

      switch (interaction.customId) {
        case PLAYLIST.MAIN_MENU:
        case PLAYLIST.MAIN_MENU_UPDATE: {
          state?.cleanup()
          await interaction.update({
            content: state.textContent,
            embeds: [],
            components: playlistOptions.map(({ name, customId }) =>
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(customId).setLabel(name).setStyle(ButtonStyle.Secondary)
              )
            ),
          })
          break
        }

        case PLAYLIST.LIST:
        case PLAYLIST.LIST_UPDATE: {
          state?.cleanup()
          const publicPlaylistSelectMenu = createPlaylistSelectMenu({
            playlists: publicPlaylists,
            customId: PLAYLIST.VIEW_PUBLIC,
            placeholderText: `🐶 Dog playlists`,
          })

          const selectMenu = createPlaylistSelectMenu({
            playlists: userPlaylists,
            customId: PLAYLIST.VIEW,
            placeholderText: `📁 Your playlists`,
          })

          const menuButton = new ButtonBuilder()
            .setCustomId(PLAYLIST.MAIN_MENU)
            .setLabel(`Main menu`)
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
          const createNewPlaylistButton = new ButtonBuilder()
            .setCustomId(PLAYLIST.CREATE)
            .setLabel(`Create new playlist`)
            .setEmoji('🌱')
            .setStyle(ButtonStyle.Secondary)
          const navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(menuButton, createNewPlaylistButton)

          const content = state.textContent
          const response: any = {
            content,
            embeds: [],
            components: [publicPlaylistSelectMenu, selectMenu, navigationRow],
          }

          if (interaction.customId === PLAYLIST.LIST_UPDATE) {
            await interaction.update(response)
          } else {
            await interaction.reply({ ...response, flags: MessageFlags.Ephemeral })
          }
          state.textContent = ''
          break
        }

        case PLAYLIST.VIEW_PUBLIC:
        case PLAYLIST.VIEW:
          await renderPlaylistView({
            session,
            interaction,
            playlistId: state.playlist.id,
          })
          break

        case PLAYLIST.CREATE_FROM_TRACK:
        case PLAYLIST.CREATE: {
          let customId
          if (interaction.customId === PLAYLIST.CREATE_FROM_TRACK) {
            customId = PLAYLIST.CREATE_FROM_TRACK_CONFIRM
          } else {
            state.selectedVideo = null
            customId = PLAYLIST.CREATE_CONFIRM
          }
          const modal = new ModalBuilder().setCustomId(customId).setTitle('Create New Playlist')

          const nameInput = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Playlist name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. Songs to flex on your fellow dogs')
            .setRequired(true)

          const publicInput = new TextInputBuilder()
            .setCustomId('public')
            .setLabel('Make Public? (Y/N)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Y/N (or leave empty for private)')
            .setMinLength(1)
            .setMaxLength(1)
            .setRequired(false)

          modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(publicInput)
          )
          await interaction.showModal(modal)
          break
        }

        case PLAYLIST.DELETE: {
          const deletablePlaylists = userPlaylists.filter((playlist) => playlist.deletable === true)
          const selectMenu = createPlaylistSelectMenu({
            playlists: deletablePlaylists,
            customId: PLAYLIST.DELETE_SELECT,
            placeholderText: `🗑️ Select playlist(s) to delete`,
            multiselect: true,
          })
          const navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)

          const content = state.textContent
          await interaction.update({
            content,
            embeds: [],
            components: [selectMenu, navigationRow],
          })
          state.textContent = ''
          break
        }
        case PLAYLIST.DELETE_CONFIRM: {
          try {
            const navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)
            const idsToDelete = state.selectedPlaylistIds.map((id) => parseInt(id, 10))
            const playlists = await playlistCtrl.delete(idsToDelete)
            state.playlist.selectedTracks = []

            const deletedPlaylistEmbedText = playlists.map((playlist) => `- ${playlist.name}`).join('\n')
            await interaction.update({
              embeds: [new EmbedBuilder().setTitle('Removed playlist(s)').setDescription(deletedPlaylistEmbedText)],
              components: [navigationRow],
            })
          } catch (error: any) {
            console.error(error?.message)
          }
          break
        }

        // only triggered from embed controls button for now
        case PLAYLIST.ADD_TO_PLAYLIST: {
          const publicPlaylistSelectMenu = createPlaylistSelectMenu({
            playlists: publicPlaylists,
            customId: PLAYLIST.ADD_TRACK_PUBLIC_CONFIRM,
            placeholderText: `🐶 Add to public playlist`,
          })
          const selectMenu = createPlaylistSelectMenu({
            playlists: userPlaylists,
            customId: PLAYLIST.ADD_TRACK_CONFIRM,
            placeholderText: `Add to private playlist`,
          })
          const createNewPlaylistButton = new ButtonBuilder()
            .setCustomId(PLAYLIST.CREATE_FROM_TRACK)
            .setLabel(`Create new playlist`)
            .setEmoji('🌱')
            .setStyle(ButtonStyle.Secondary)
          const navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, createNewPlaylistButton)

          const embedData = interaction.message.embeds[0].data
          const videoData: FormattedYoutubeVideo = {
            title: embedData.title,
            url: embedData.url,
            id: extractYouTubeIdFromUrl(embedData.url),
            duration: timestampToISO(
              embedData.fields.find((field: any) => field.name === '🕗 Duration')?.value.replace(/`(.*?)`/g, '$1')
            ),
            thumbnail: embedData.thumbnail?.url || '',
            liveBroadcastContent: 'none', //TODO: make dynamic
          }

          state.selectedVideo = videoData
          await interaction.reply({
            content: `Add [${state.selectedVideo.title}](${state.selectedVideo.url}) to playlist:`,
            embeds: [],
            components: [publicPlaylistSelectMenu, selectMenu, navigationRow],
            flags: [MessageFlags.Ephemeral],
          })
          state.textContent = ''

          const message = await interaction.fetchReply()
          message
            .createMessageComponentCollector({
              componentType: ComponentType.StringSelect,
              filter: (i: any) =>
                i.user.id === interaction.user.id &&
                (i.customId === PLAYLIST.ADD_TRACK_CONFIRM || i.customId === PLAYLIST.ADD_TRACK_PUBLIC_CONFIRM),
            })
            .on('collect', async (selectInteraction: any) => {
              const playlistId = selectInteraction.values[0]
              state.playlist.id = playlistId

              await playlistCtrl.addTrack(parseInt(playlistId, 10), state.selectedVideo.id)
              try {
                await renderPlaylistView({
                  session,
                  interaction: selectInteraction,
                  playlistId,
                  newVideo: state.selectedVideo,
                })
              } catch (error: any) {
                await selectInteraction.update({
                  content: error.message || 'Something went wrong',
                  embeds: [],
                  components: [selectMenu, navigationRow],
                })
                console.error('Error updating playlist: ', error)
              }
            })

          break
        }

        case PLAYLIST.QUEUE_TRACK_CONFIRM: {
          await interaction.deferUpdate()
          const connected = await ensureVoiceConnectionOrReply(interaction, session, userId, false)
          if (!connected) break

          const selectedTrackIds = state.playlist.selectedTracks
          const selectedTracks: ExtendedTrack[] = await trackCtrl.getByIds(selectedTrackIds)

          const queueLengthBeforeQueuingTrack = musicPlayer.queue.length
          const tracksToDisplay =
            queueLengthBeforeQueuingTrack === 0 && musicPlayer.player.state.status === AudioPlayerStatus.Idle
              ? selectedTracks.slice(1)
              : selectedTracks

          if (selectedTracks && selectedTracks.length > 0) {
            const currentQueue = musicPlayer.queue
            const startIndex =
              currentQueue.length - selectedTracks.length < 0 ? 0 : currentQueue.length - selectedTracks.length

            const reply = tracksToDisplay
              .map((track, i) => {
                const position = startIndex + i + 1
                return `[${position}] [${truncateText(
                  escapeDiscordMarkdown(track.title),
                  45
                )}](${track.url}) - (${isoToTimestamp(track.duration)}) `
              })
              .join('\n')

            if (reply) {
              await interaction.followUp({
                embeds: [new EmbedBuilder().setColor(0xffa200).setTitle('Added to queue:').setDescription(reply)],
                flags: MessageFlags.Ephemeral,
              })
            }
          } else {
            await interaction.followUp({
              content: 'No tracks were added. Something went wrong.',
              flags: MessageFlags.Ephemeral,
            })
          }

          await queue({
            session,
            userId,
            query: selectedTrackIds,
          })
          break
        }

        case PLAYLIST.REMOVE_TRACK_CONFIRM: {
          await interaction.deferUpdate()
          const playlistId = state.playlist.id
          const tracksToDelete = state.playlist.selectedTracks

          try {
            const removedPlaylistTracks = await playlistCtrl.removeTracks(parseInt(playlistId, 10), tracksToDelete)
            const removedTracks = removedPlaylistTracks.map((playlistTrack) => uncompressTrack(playlistTrack.track))
            state.playlist.selectedTracks = []

            // const reply = removedTracks
            //   .map((track, i) => {
            //     return `[${i + 1}] [${truncateText(
            //       escapeDiscordMarkdown(track.title),
            //       45
            //     )}](${track.url}) - (${isoToTimestamp(track.duration)}) `
            //   })
            //   .join('\n')

            // await interaction.followUp({
            //   embeds: [new EmbedBuilder().setTitle('Removed track(s):').setDescription(reply)],
            //   flags: MessageFlags.Ephemeral,
            // })
          } catch (error: any) {
            console.error('ERROR', error)
          }
          break
        }

        case PLAYLIST.SELECTION_CLEAR: {
          await interaction.deferUpdate()
          break
        }

        case 'dismiss': {
          await interaction.deferUpdate()
          await interaction.deleteReply()
          break
        }
      }
    }

    if (interaction.isStringSelectMenu()) {
      const userId = interaction.user.id
      switch (interaction.customId) {
        case PLAYLIST.VIEW_PUBLIC:
        case PLAYLIST.VIEW: {
          const playlistId = interaction.values[0]
          state.playlist.id = playlistId
          await renderPlaylistView({
            session,
            interaction,
            playlistId,
          })
          break
        }

        case PLAYLIST.DELETE_SELECT: {
          const playlistIds = interaction.values
          const userPlaylists = await playlistCtrl.getByUserId(userId)
          const selectMenu = createPlaylistSelectMenu({
            playlists: userPlaylists,
            customId: PLAYLIST.DELETE_SELECT,
            placeholderText: `🗑️ Select playlist(s) to remove`,
            selectedValues: playlistIds,
            multiselect: true,
          })

          let navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)
          if (playlistIds.length > 0) {
            const confirmButton = new ButtonBuilder()
              .setCustomId('playlist:delete:confirm')
              .setLabel('🗑️ Delete')
              .setStyle(ButtonStyle.Danger)
            navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, confirmButton)

            state.selectedPlaylistIds = playlistIds
          }

          await interaction.update({
            components: [selectMenu, navigationRow],
          })

          break
        }

        // generic multiselect
        case PLAYLIST.TRACK_SELECT: {
          state.playlist.selectedTracks = interaction.values
          await interaction.deferUpdate()
          break
        }
      }
    }

    if (interaction.isModalSubmit()) {
      const userId = interaction.user.id
      switch (interaction.customId) {
        case PLAYLIST.CREATE_FROM_TRACK_CONFIRM:
        case PLAYLIST.CREATE_CONFIRM: {
          const newPlaylistNameInputField = interaction.fields.getTextInputValue('name').trim()
          const publicInputField = interaction.fields.getTextInputValue('public').trim()
          const isPublic = publicInputField.toLowerCase() === 'y' ? true : false

          try {
            const newPlaylist = isPublic
              ? await playlistCtrl.createPublic({
                  name: newPlaylistNameInputField,
                  userId,
                  guildId,
                })
              : await playlistCtrl.create({
                  userId,
                  name: newPlaylistNameInputField,
                })
            if (interaction.customId === PLAYLIST.CREATE_FROM_TRACK_CONFIRM) {
              await playlistCtrl.addTrack(newPlaylist.id, state.selectedVideo.id)
            }

            state.playlist.id = newPlaylist.id.toString()
            await interaction.reply({
              content: `"${newPlaylistNameInputField}" created successfully`,
              components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                  new ButtonBuilder()
                    .setCustomId(isPublic ? PLAYLIST.VIEW_PUBLIC : PLAYLIST.VIEW)
                    .setLabel('👀 View playlist')
                    .setStyle(ButtonStyle.Secondary)
                ),
              ],
              flags: MessageFlags.Ephemeral,
            })
          } catch (error: any) {
            await interaction.reply({
              content: error?.message,
              flags: MessageFlags.Ephemeral,
            })
            return
          }
        }
      }
    }
  },
}

// Collectors and conditional rendering logic must be within the renderPlaylistFunction
// because it's impossible to update the ephemeral message (menu) otherwise
export const renderPlaylistView = async ({
  session,
  interaction,
  playlistId,
  newVideo,
  textContent = '',
  reply = false,
}: {
  session: GuildSession
  interaction: any
  playlistId: string
  newVideo?: FormattedYoutubeVideo
  textContent?: string
  reply?: boolean
}) => {
  if (newVideo && newVideo.title && newVideo.url) {
    textContent = `Added [${newVideo.title}](${newVideo.url}) to the playlist!`
  }

  const userId = interaction.user.id
  const state = session.getUserState(userId)
  state.playlist = {
    id: playlistId,
    selectedTracks: [],
    collectors: [],
  }
  let playlist = await playlistCtrl.getById(parseInt(playlistId, 10))

  let videos = playlist.tracks.map((playlistTrack: any) => uncompressTrack(playlistTrack.track)) as any[]

  const backButton = new ButtonBuilder()
    .setCustomId(PLAYLIST.LIST_UPDATE)
    .setLabel('Back')
    .setEmoji('⬅️')
    .setStyle(ButtonStyle.Secondary)

  let navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)

  if (videos.length === 0) {
    const emptyPayload = {
      content: 'Playlist is empty!',
      components: [navigationRow],
      ephemeral: true,
    }

    try {
      if (reply) {
        await interaction.reply(emptyPayload)
      } else {
        await interaction.update(emptyPayload)
      }
    } catch (error) {
      console.error('Failed to respond to empty playlist interaction:', error)
    }
    return
  }

  const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    createTrackSelectMenu({
      customId: PLAYLIST.TRACK_SELECT,
      videos,
      multiselect: true,
    })
  )

  const playlistEmbedText = videos
    .map((video, i) => {
      const title = truncateText(escapeDiscordMarkdown(video.title), 45)
      const isNew = newVideo && video.id === newVideo.id
      return `[${i + 1}] [${title}](${video.url}) - (${isoToTimestamp(video.duration)}) ${isNew ? ' ⭐️ [NEW]' : ''}`
    })
    .join('\n')

  const playlistViewEmbed = createCustomEmbed({
    headerText: `${playlist.name}`,
    text: playlistEmbedText,
  })

  let message: any

  try {
    const responsePayload = {
      content: textContent,
      embeds: [playlistViewEmbed],
      components: [selectMenu, navigationRow],
      ephemeral: true,
    }

    if (reply) {
      await interaction.reply(responsePayload)
      message = await interaction.fetchReply()
      state.interaction = interaction
    } else {
      message = await interaction.update(responsePayload)
    }
  } catch (error) {
    console.error('Failed to respond to interaction:', error)
    return
  }

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: (i: any) => i.user.id === userId && i.customId === PLAYLIST.TRACK_SELECT,
  })
  state.playlist.collectors.push(collector)

  collector.on('collect', async (selectInteraction: any) => {
    try {
      const selectedTrackIds = selectInteraction.values

      const updatedMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        createTrackSelectMenu({
          customId: PLAYLIST.TRACK_SELECT,
          videos,
          defaultValues: selectedTrackIds,
          multiselect: true,
        })
      )

      const queueButton = new ButtonBuilder()
        .setCustomId(PLAYLIST.QUEUE_TRACK_CONFIRM)
        .setLabel('✅ Send to queue')
        .setStyle(ButtonStyle.Success)

      const removeButton = new ButtonBuilder()
        .setCustomId(PLAYLIST.REMOVE_TRACK_CONFIRM)
        .setLabel('Remove from playlist')
        .setStyle(ButtonStyle.Danger)

      const clearButton = new ButtonBuilder()
        .setCustomId(PLAYLIST.SELECTION_CLEAR)
        .setLabel('❌ Clear selection')
        .setStyle(ButtonStyle.Secondary)

      const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        backButton,
        queueButton,
        removeButton,
        clearButton
      )

      if (reply) {
        const replyInteraction = state.interaction
        await replyInteraction.editReply({
          embeds: [playlistViewEmbed],
          components: [updatedMenu, navRow],
        })
      } else {
        await message.edit({
          embeds: [playlistViewEmbed],
          components: [updatedMenu, navRow],
        })
      }

      state.textContent = selectInteraction.message.content
    } catch (error) {
      console.error('Error handling select menu collect event:', error)
      try {
        await selectInteraction.followUp({ content: 'An error occurred. Please try again.', ephemeral: true })
      } catch {}
    }
  })

  const collector2 = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i: any) =>
      i.user.id === userId &&
      [PLAYLIST.QUEUE_TRACK_CONFIRM, PLAYLIST.REMOVE_TRACK_CONFIRM, PLAYLIST.SELECTION_CLEAR].includes(i.customId),
  })
  state.playlist.collectors.push(collector2)

  collector2.on('collect', async (buttonInteraction: any) => {
    try {
      const session = client.guildSessions.get(buttonInteraction.guildId)

      if (buttonInteraction.customId === PLAYLIST.QUEUE_TRACK_CONFIRM) {
        const connected = await ensureVoiceConnectionOrReply(buttonInteraction, session, userId, true)
        if (!connected) return
      }

      playlist = await playlistCtrl.getById(parseInt(state.playlist.id, 10))

      const updatedVideos = playlist.tracks.map((playlistTrack) => uncompressTrack(playlistTrack.track))

      if (updatedVideos.length === 0) {
        const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)

        if (reply) {
          const replyInteraction = state.interaction
          await replyInteraction.editReply({
            content: 'Playlist is empty!',
            components: [navRow],
            embeds: [],
          })
        } else {
          await message.edit({
            content: 'Playlist is empty!',
            components: [navRow],
            embeds: [],
          })
        }
        return
      }

      const updatedText = updatedVideos
        .map((video, i) => {
          const title = truncateText(escapeDiscordMarkdown(video.title), 45)
          const isNew = newVideo && video.id === newVideo.id
          return `[${i + 1}] [${title}](${video.url}) - (${isoToTimestamp(video.duration)})${isNew ? ' ⭐️ [NEW]' : ''}`
        })
        .join('\n')

      const updatedEmbed = createCustomEmbed({
        headerText: `${playlist.name}`,
        text: updatedText,
      })

      const updatedMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        createTrackSelectMenu({
          customId: PLAYLIST.TRACK_SELECT,
          videos: updatedVideos as any,
          multiselect: true,
        })
      )

      const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)

      const content = state.textContent
      if (reply) {
        const replyInteraction = state.interaction
        await replyInteraction.editReply({
          content,
          embeds: [updatedEmbed],
          components: [updatedMenu, navRow],
        })
      } else {
        await message.edit({
          content,
          embeds: [updatedEmbed],
          components: [updatedMenu, navRow],
        })
      }

      state.textContent = ''
    } catch (error) {
      console.error('Error handling button collect event:', error)
      try {
        await buttonInteraction.followUp({ content: 'An error occurred. Please try again.', ephemeral: true })
      } catch {}
    }
  })
}
