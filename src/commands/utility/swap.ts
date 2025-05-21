import { SlashCommandBuilder, MessageFlags, EmbedBuilder } from 'discord.js'
import { YoutubeMusicPlayer } from '../../MusicPlayer'

// Utility to swap two items in an array
const swapTracks = async (musicPlayer: YoutubeMusicPlayer, queue: any[], indexA: number, indexB: number) => {
  ;[queue[indexA], queue[indexB]] = [queue[indexB], queue[indexA]]
  await musicPlayer.sendOrUpdateQueueEmbed()
}

export default {
  data: new SlashCommandBuilder()
    .setName('swap')
    .setDescription('Swap the position of two tracks in the queue')
    .addIntegerOption((option) => option.setName('position1').setDescription('First track position').setRequired(true))
    .addIntegerOption((option) =>
      option.setName('position2').setDescription('Second track position').setRequired(true)
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

    const pos1 = interaction.options.getInteger('position1')! - 1
    const pos2 = interaction.options.getInteger('position2')! - 1

    if (pos1 < 0 || pos2 < 0 || pos1 >= queue.length || pos2 >= queue.length) {
      interaction.reply({
        content: 'One or both positions are invalid.',
        flags: MessageFlags.Ephemeral,
      })
      setTimeout(() => {
        interaction.deleteReply().catch(console.error)
      }, 5000)
      return
    }

    await swapTracks(musicPlayer, queue, pos1, pos2)

    const track1 = queue[pos1]
    const track2 = queue[pos2]
    const reply = `[${pos2 + 1}] [${track2.video.title}](${track2.video.url}) \n [${pos1 + 1}] [${track1.video.title}](${track1.video.url})`
    await interaction.reply({
      embeds: [new EmbedBuilder().setTitle('Updated track positions:').setDescription(reply)],
      flags: MessageFlags.Ephemeral,
    })
  },
}
