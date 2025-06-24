import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { playlistCtrl } from '../../backend/controllers/Controllers'
import { renderPlaylistView } from '../../events/musicPlayerMenu'
import { client } from '../..'

export default {
  data: new SlashCommandBuilder()
    .setName('likedsongs')
    .setDescription('Your liked songs')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction: any) {
    const userId = interaction.user.id
    const session = client.guildSessions.get(interaction.guildId)

    try {
      const { playlist } = await playlistCtrl.getUserFavorites(userId)
      await renderPlaylistView({
        session,
        interaction,
        playlistId: playlist.id.toString(),
        reply: true,
      })
    } catch (err) {
      console.error('Error in liked songs slash command: ', err)
      interaction.reply({
        content: 'No liked songs found. Like a song by reacting to it!',
        flags: MessageFlags.Ephemeral,
      })
    }
  },
}
