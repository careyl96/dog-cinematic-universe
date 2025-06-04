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
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { createCustomEmbed } from '../helpers/embedHelpers'
import {
  escapeDiscordMarkdown,
  isoToTimestamp,
  sanitizeFilename,
  timestampToISO,
  truncateText,
} from '../helpers/formatterHelpers'
import { getGuildMember } from '../helpers/otherHelpers'
import { queue } from '../helpers/playerFunctions'
import {
  FormattedYoutubeVideo,
  extractYouTubeIdFromUrl,
  uncompressYoutubeVideo,
} from '../helpers/youtubeHelpers/youtubeFormatterHelpers'
import {
  getAllPlaylistsForUser,
  createPlaylistSelectMenu,
  deletePlaylistForUserByPlaylistId,
  getPlaylistForUserById,
  updatePlaylistForUserById,
  createNewPlaylist,
  createTrackSelectMenu,
} from '../helpers/playlistHelpers'
import { playlistManager } from '..'
import { BOT_USER_ID } from '../constants'

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
  REMOVE_TRACK_SELECT: 'playlist:track:remove:select',
  REMOVE_TRACK_CLEAR: 'playlist:track:remove:clear',

  QUEUE_TRACK: 'playlist:queue',
  QUEUE_TRACK_CONFIRM: 'playlist:queue:confirm',

  SELECTION_CLEAR: 'playlist:track:selection:clear',

  MULTI_SELECT: 'multi-select',
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
  async execute(client: ClientWithCommands, interaction: Interaction) {
    console.log(interaction.customId)
    const userId = interaction.user.id
    const userPlaylists = getAllPlaylistsForUser(userId)
    const publicPlaylists = getAllPlaylistsForUser(BOT_USER_ID)
    if (interaction.isButton()) {
      const playlistOptions = [{ name: '🌱 - Create new playlist', customId: PLAYLIST.CREATE }]

      if (userPlaylists?.length > 0) {
        playlistOptions.unshift({ name: '📁 - View playlists', customId: 'playlist:list:update' })
        playlistOptions.push({ name: '🗑️ - Delete Playlist', customId: PLAYLIST.DELETE })
      }

      switch (interaction.customId) {
        // no changes necessary
        case PLAYLIST.MAIN_MENU:
        case PLAYLIST.MAIN_MENU_UPDATE: {
          playlistManager.getUserState(userId)?.collector?.stop()
          const content = playlistManager.getUserState(userId).text
          await interaction.update({
            content,
            embeds: [],
            components: playlistOptions.map(({ name, customId }) =>
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId(customId).setLabel(name).setStyle(ButtonStyle.Secondary)
              )
            ),
          })
          playlistManager.setUserState(userId, { text: '' })
          break
        }

        case PLAYLIST.LIST:
        case PLAYLIST.LIST_UPDATE: {
          playlistManager.getUserState(userId)?.collector?.stop()
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

          const content = playlistManager.getUserState(userId).text
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
          playlistManager.setUserState(userId, { text: '' })
          break
        }

        case PLAYLIST.VIEW_PUBLIC:
        case PLAYLIST.VIEW: {
          const isPublic = interaction.customId === PLAYLIST.VIEW_PUBLIC
          await renderPlaylistView({
            interaction,
            playlistId: playlistManager.getUserState(userId).playlistId,
            isPublic,
          })
          break
        }

        case PLAYLIST.CREATE_FROM_TRACK:
        case PLAYLIST.CREATE: {
          let customId
          if (interaction.customId === PLAYLIST.CREATE_FROM_TRACK) {
            customId = PLAYLIST.CREATE_FROM_TRACK_CONFIRM
          } else {
            playlistManager.setUserState(userId, { video: null })
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
          const selectMenu = createPlaylistSelectMenu({
            playlists: userPlaylists,
            customId: PLAYLIST.DELETE_SELECT,
            placeholderText: `🗑️ Select playlist(s) to delete`,
            multiselect: true,
          })
          const navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)

          const content = playlistManager.getUserState(userId).text
          await interaction.update({
            content,
            embeds: [],
            components: [selectMenu, navigationRow],
          })
          playlistManager.setUserState(userId, { text: '' })
          break
        }
        case PLAYLIST.DELETE_CONFIRM: {
          try {
            const navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)
            const deletedPlaylists = await deletePlaylistForUserByPlaylistId(
              userId,
              playlistManager.getUserState(userId).selectedPlaylistIds
            )
            playlistManager.setUserState(userId, { selectedPlaylistIds: [] })
            let reply = deletedPlaylists.map((name) => `- ${name}`).join('\n')

            await interaction.update({
              embeds: [new EmbedBuilder().setTitle('Removed playlist(s)').setDescription(reply)],
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

          playlistManager.setUserState(userId, {
            video: videoData,
          })

          const state = playlistManager.getUserState(userId)
          await interaction.reply({
            content: `Add [${state.video.title}](${state.video.url}) to playlist:`,
            embeds: [],
            components: [publicPlaylistSelectMenu, selectMenu, navigationRow],
            flags: [MessageFlags.Ephemeral, MessageFlags.SuppressEmbeds],
          })
          playlistManager.setUserState(userId, { text: '' })

          const message = await interaction.fetchReply()
          message
            .createMessageComponentCollector({
              componentType: ComponentType.StringSelect,
              filter: (i: any) =>
                i.user.id === interaction.user.id &&
                (i.customId === PLAYLIST.ADD_TRACK_CONFIRM || i.customId === PLAYLIST.ADD_TRACK_PUBLIC_CONFIRM),
            })
            .on('collect', async (selectInteraction: any) => {
              const isPublic = selectInteraction.customId === PLAYLIST.ADD_TRACK_PUBLIC_CONFIRM
              const playlistId = selectInteraction.values[0]
              playlistManager.setUserState(userId, { playlistId })

              const state = playlistManager.getUserState(userId)
              try {
                updatePlaylistForUserById({
                  userId,
                  playlistId,
                  video: state.video,
                  isPublic,
                })
                console.log('rendering playlist after adding track through select menu')
                await renderPlaylistView({
                  interaction: selectInteraction,
                  playlistId,
                  newVideo: state.video,
                  isPublic,
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
          await queue({
            user: await getGuildMember(userId),
            query: playlistManager.getUserState(userId).selectedTracks,
            saveToHistory: true,
          })
          break
        }

        case PLAYLIST.REMOVE_TRACK_CONFIRM: {
          const state = playlistManager.getUserState(userId)
          const playlistId = state.playlistId
          const tracksToDelete = state.selectedTracks

          try {
            await updatePlaylistForUserById({ userId, playlistId, remove: true, removeUrls: tracksToDelete })
            playlistManager.setUserState(userId, { selectedTracks: [] })
          } catch (error: any) {
            let navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)
            await interaction.update({
              content: error?.message,
              components: [navigationRow],
            })
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
          playlistManager.setUserState(userId, { playlistId })
          await renderPlaylistView({
            interaction,
            playlistId,
            isPublic: interaction.customId === PLAYLIST.VIEW_PUBLIC,
          })
          break
        }

        case PLAYLIST.DELETE_SELECT: {
          const playlistIds = interaction.values
          const userPlaylists = await getAllPlaylistsForUser(userId)
          const selectMenu = createPlaylistSelectMenu({
            playlists: userPlaylists,
            customId: PLAYLIST.DELETE_SELECT,
            placeholderText: `🗑️ Select playlist(s) to remove`,
            selectedValues: playlistIds,
            multiselect: true,
          })

          let navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)
          const playlistIdsToDelete = playlistIds
          if (playlistIdsToDelete.length > 0) {
            const confirmButton = new ButtonBuilder()
              .setCustomId('playlist:delete:confirm')
              .setLabel('🗑️ Delete')
              .setStyle(ButtonStyle.Danger)
            navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, confirmButton)

            playlistManager.setUserState(userId, { selectedPlaylistIds: playlistIdsToDelete })
          }

          await interaction.update({
            components: [selectMenu, navigationRow],
          })

          break
        }

        // generic multiselect
        case PLAYLIST.MULTI_SELECT:
          playlistManager.setUserState(userId, { selectedTracks: interaction.values })
          await interaction.deferUpdate()
          break
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
            const playlistUserId = await createNewPlaylist({
              userId,
              name: newPlaylistNameInputField,
              isPublic,
            })
            if (interaction.customId === PLAYLIST.CREATE_FROM_TRACK_CONFIRM) {
              await updatePlaylistForUserById({
                userId: playlistUserId,
                playlistId: sanitizeFilename(newPlaylistNameInputField),
                video: playlistManager.getUserState(userId).video,
              })
            }

            playlistManager.setUserState(userId, {
              playlistId: sanitizeFilename(newPlaylistNameInputField),
            })
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

// reasoning behind putting all of the collectors and conditional rendering logic within the renderPlaylistFunction
// is that it's impossible to update the ephemeral interaction (menu) otherwise
const renderPlaylistView = async ({
  interaction,
  playlistId,
  newVideo,
  isPublic = false,
  textContent = '',
}: {
  interaction: any
  playlistId: string
  newVideo?: FormattedYoutubeVideo
  isPublic?: boolean
  textContent?: string
}) => {
  const userId = interaction.user.id
  let playlistJSON = isPublic
    ? getPlaylistForUserById(BOT_USER_ID, playlistId)
    : getPlaylistForUserById(userId, playlistId)
  let videos = Object.values(playlistJSON.videos).map(uncompressYoutubeVideo)

  const backButton = new ButtonBuilder()
    .setCustomId(PLAYLIST.LIST_UPDATE)
    .setLabel('Back')
    .setEmoji('⬅️')
    .setStyle(ButtonStyle.Secondary)
  let navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)

  if (videos.length === 0) {
    await interaction.update({
      content: 'Playlist is empty!',
      components: [navigationRow],
    })
    return
  }

  const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    createTrackSelectMenu({
      customId: PLAYLIST.MULTI_SELECT,
      videos,
      multiselect: true,
    })
  )

  navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)

  let playlistEmbedText = videos
    .map((video, i) => {
      const title = truncateText(escapeDiscordMarkdown(video.title), 50)
      const isNew = newVideo && video.id === newVideo.id
      return `[${i + 1}] [${title}](${video.url}) - (${isoToTimestamp(video.duration)}) ${isNew ? ' ⭐️ [NEW]' : ''}`
    })
    .join('\n')

  let playlistViewEmbed = createCustomEmbed({ headerText: `${playlistJSON.name}`, text: playlistEmbedText })

  const message = await interaction.update({
    content: textContent,
    embeds: [playlistViewEmbed],
    components: [selectMenu, navigationRow],
  })

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: (i: any) => i.user.id === interaction.user.id && i.customId === PLAYLIST.MULTI_SELECT,
  })
  playlistManager.setUserState(userId, { collector })
  collector.on('collect', async (selectInteraction: any) => {
    const selectedUrls = selectInteraction.values
    const updatedMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      createTrackSelectMenu({
        customId: PLAYLIST.MULTI_SELECT,
        videos,
        defaultValues: selectedUrls,
        multiselect: true,
      })
    )

    const queueButton = new ButtonBuilder()
      .setCustomId(PLAYLIST.QUEUE_TRACK_CONFIRM)
      .setLabel('✅ Send to queue')
      .setStyle(ButtonStyle.Success)
    const removeFromPlaylistButton = new ButtonBuilder()
      .setCustomId(PLAYLIST.REMOVE_TRACK_CONFIRM)
      .setLabel('Remove from playlist')
      .setStyle(ButtonStyle.Danger)
    const clearButton = new ButtonBuilder()
      .setCustomId(PLAYLIST.SELECTION_CLEAR)
      .setLabel('❌ Clear selection')
      .setStyle(ButtonStyle.Secondary)

    const navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      backButton,
      queueButton,
      removeFromPlaylistButton,
      clearButton
    )

    await message.edit({
      embeds: [playlistViewEmbed],
      components: [updatedMenu, navigationRow],
    })
  })

  const collector2 = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (i: any) =>
      i.user.id === interaction.user.id &&
      (i.customId === PLAYLIST.SELECTION_CLEAR ||
        i.customId === PLAYLIST.QUEUE_TRACK_CONFIRM ||
        i.customId === PLAYLIST.REMOVE_TRACK_CONFIRM),
  })

  collector2.on('collect', async () => {
    playlistJSON = getPlaylistForUserById(userId, playlistManager.getUserState(userId).playlistId)
    videos = Object.values(playlistJSON.videos).map(uncompressYoutubeVideo)
    if (videos.length === 0) {
      let navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)
      await interaction.update({
        content: 'Playlist is empty!',
        components: [navigationRow],
      })
      return
    }

    playlistEmbedText = videos
      .map((video, i) => {
        const title = truncateText(escapeDiscordMarkdown(video.title), 50)
        const isNew = newVideo && video.id === newVideo.id
        return `[${i + 1}] [${title}](${video.url})${isNew ? ' ⭐️ [NEW]' : ''}`
      })
      .join('\n')
    playlistViewEmbed = createCustomEmbed({ headerText: `${playlistJSON.name}`, text: playlistEmbedText })
    const updatedMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      createTrackSelectMenu({
        customId: PLAYLIST.MULTI_SELECT,
        videos,
        multiselect: true,
      })
    )

    const navigationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton)

    const content = playlistManager.getUserState(userId).text
    await message.edit({
      content,
      embeds: [playlistViewEmbed],
      components: [updatedMenu, navigationRow],
    })
    playlistManager.setUserState(userId, { text: '' })
  })
}
