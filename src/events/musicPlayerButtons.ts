import { Events, Interaction, Message, MessageFlags } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import {
  createQueueEmbed,
  createYoutubeEmbed,
  getVideoDataFromMessage,
  NowPlayingEmbedState,
} from '../helpers/embedHelpers'
import { EMBED_CONTROLS, TEXT_CHANNELS } from '../constants'
import { createOrUpdateUsersLikedMusic, LikedMusic } from '../helpers/musicDataHelpers'
import { isoToTimestamp, timestampToISO, truncateText } from '../helpers/formatterHelpers'
import { fetchMessages } from '../helpers/otherHelpers'
import { roulette } from '../helpers/playerFunctions'
import { FormattedYoutubeVideo, extractYouTubeIdFromUrl } from '../helpers/youtubeHelpers/youtubeFormatterHelpers'
import { NowPlayingEmbedInfo } from '../MusicPlayer'
import { createPlaylistSelectMenu, getAllPlaylistsForUser, updatePlaylistForUserById } from '../helpers/playlistHelpers'

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(client: ClientWithCommands, interaction: Interaction) {
    if (!interaction.isButton()) return
    const userId = interaction.user.id

    const message = interaction.message
    const videoData: FormattedYoutubeVideo = getVideoDataFromMessage(message)
    if (!videoData) return

    const playerState: NowPlayingEmbedState = client.musicPlayer.nowPlayingEmbedInfo.state

    const currentlyPlaying = client.musicPlayer.currentlyPlaying
    const trackTimer = client.musicPlayer.trackTimer
    switch (interaction.customId) {
      case EMBED_CONTROLS.VOLUME_DOWN:
        await interaction.deferUpdate()
        await client.musicPlayer.volDown()
        break
      case EMBED_CONTROLS.VOLUME_UP:
        await interaction.deferUpdate()
        await client.musicPlayer.volUp()
        break
      case EMBED_CONTROLS.BACK:
        await interaction.deferUpdate()
        client.musicPlayer.pause()
        const timeElapsedBeforePlayPrevTrack = 3000
        if (
          videoData.title === currentlyPlaying?.video?.title &&
          trackTimer?.elapsedTime >= timeElapsedBeforePlayPrevTrack
        ) {
          await client.musicPlayer.forcePlay({
            query: videoData.url,
            userId,
            overrideCurrentEmbed: true,
            saveToHistory: true,
          })
        } else if (trackTimer?.elapsedTime < timeElapsedBeforePlayPrevTrack) {
          let currentEmbedMessage = client.musicPlayer.nowPlayingEmbedInfo?.message

          try {
            currentEmbedMessage.delete()
          } catch (error) {
            console.error('Failed to delete current embed message:', error)
          }

          const musicBotChannel = client.channels.cache.get(TEXT_CHANNELS.MUSIC_BOT)
          const messages = await fetchMessages(musicBotChannel, 10)

          const prevMessage = messages.find(
            (m) => m.embeds?.[0]?.data?.fields?.[0]?.name?.includes('Requested by') && m.id !== currentEmbedMessage?.id
          )

          if (prevMessage) {
            const embedData = prevMessage.embeds[0].data
            const videoData: FormattedYoutubeVideo = {
              title: embedData.title,
              url: embedData.url,
              id: extractYouTubeIdFromUrl(embedData.url),
              duration: timestampToISO(
                embedData.fields.find((field: any) => field.name === '🕗 Duration')?.value.replace(/`(.*?)`/g, '$1')
              ),
              thumbnail: embedData.thumbnail?.url || '',
              liveBroadcastContent: 'none',
            }
            const embedInfo: NowPlayingEmbedInfo = {
              video: videoData,
              userId,
              state: NowPlayingEmbedState.Loading,
              roulette: false,
              message: prevMessage, // Add a valid message object if available
              saveToHistory: false, // Set to true or false based on your logic
              playNextInQueue: false,
            }

            client.musicPlayer.nowPlayingEmbedInfo = embedInfo
            client.musicPlayer.currentlyPlaying = {
              video: videoData,
              userId,
              saveToHistory: false,
            }
            prevMessage?.edit(createYoutubeEmbed(embedInfo)).catch((err: any) => {
              console.error(err.message)
            })
            await client.musicPlayer.forcePlay({
              query: videoData.url,
              userId,
              overrideCurrentEmbed: true,
              saveToHistory: true,
            })
          }
        }
        break
      case EMBED_CONTROLS.PLAY:
        await client.musicPlayer.unpause()
        await interaction.deferUpdate()
        break
      case EMBED_CONTROLS.PAUSE:
        await client.musicPlayer.pause()
        await interaction.deferUpdate()
        break
      case EMBED_CONTROLS.SKIP:
        if (
          playerState === NowPlayingEmbedState.Playing ||
          playerState === NowPlayingEmbedState.Paused ||
          playerState === NowPlayingEmbedState.Loading
        ) {
          await interaction.deferUpdate()
          await client.musicPlayer.skip(userId)
        } else {
          await interaction.reply({
            content: 'Nothing currently playing.',
            ephemeral: true,
          })
        }
        break

      // ROW 2
      case EMBED_CONTROLS.QUEUE:
        client.musicPlayer.enqueue({
          videosToQueue: videoData,
          userId: userId,
          queueInPosition: 0,
          saveToHistory: true,
        })
        await interaction.deferUpdate()
        break
      case EMBED_CONTROLS.VIEW_QUEUE:
        const queueEmbedText =
          client.musicPlayer.queue
            .map(
              (item, index) =>
                `‎ [${index + 1}] ‎ [${truncateText(item.video.title, 50)}](${item.video.url}) - (${isoToTimestamp(item.video.duration)}) <@${item.userId}>`
            )
            .join('\n') || '<a:emoji:1132934927382499388> No songs queued.'

        await interaction.reply({
          embeds: [createQueueEmbed({ text: queueEmbedText })],
          flags: MessageFlags.Ephemeral,
        })
        break
      case EMBED_CONTROLS.LIKE:
        try {
          updatePlaylistForUserById({
            userId,
            playlistId: 'liked_music',
            video: videoData,
          })
          interaction.reply({
            content: `Added [${videoData.title}](<${videoData.url}>) to your liked music!`,
            ephemeral: true,
          })
        } catch (error: any) {
          interaction.reply({
            content: error?.message || 'Something wrong like',
            flags: MessageFlags.Ephemeral,
          })
        }
        break
      case EMBED_CONTROLS.AUTOPLAY:
        await interaction.deferUpdate()
        await client.musicPlayer.handleAutoplay(!client.musicPlayer.autoplay)
        break
      case EMBED_CONTROLS.ROULETTE:
        await interaction.deferUpdate()
        await roulette({ userId: interaction.user.id, count: 1 })
        break
      // playlist menu event handler is in musicPlayerMenu.ts
      // add to playlist event handler is in musicPlayerMenu
    }
  },
}
