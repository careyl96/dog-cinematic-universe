import { SlashCommandBuilder, MessageFlags, EmbedBuilder, InteractionContextType } from 'discord.js'
import { YoutubeMusicPlayer } from '../../MusicPlayer'

// Utility to move an item in an array from one position to another
const moveTrack = async (musicPlayer: YoutubeMusicPlayer, queue: any[], fromIndex: number, toIndex: number) => {
  const item = queue.splice(fromIndex, 1)[0]
  queue.splice(toIndex, 0, item)
  await musicPlayer.sendOrUpdateQueueEmbed()
}

export default {
  data: new SlashCommandBuilder()
    .setName('movetotop')
    .setDescription('Move or swap tracks in the queue')
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((option) =>
      option.setName('position').setDescription('Position of item to move to the top of the queue').setRequired(true)
    ),

  async execute(interaction: any) {
    const musicPlayer = interaction.client.musicPlayer
    const queue = musicPlayer.queue

    if (!queue || queue.length === 0) {
      interaction.reply({
        content: 'The queue is currently empty.',
        flags: MessageFlags.Ephemeral,
      })

      setTimeout(() => {
        interaction.deleteReply().catch(console.error)
      }, 5000)
      return
    }

    const position = interaction.options.getInteger('position')! - 1

    if (position < 0 || position >= queue.length) {
      interaction.reply({
        content: 'Invalid position selected.',
        flags: MessageFlags.Ephemeral,
      })

      setTimeout(() => {
        interaction.deleteReply().catch(console.error)
      }, 5000)
      return
    }

    const item = queue[position]
    await moveTrack(musicPlayer, queue, position, 0)

    interaction.client.musicPlayer.sendOrUpdateQueueEmbed()
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('Updated track position:')
          .setDescription(`[1] [${item.video.title}](${item.video.url})`),
      ],
      flags: MessageFlags.Ephemeral,
    })
    return
  },
}
