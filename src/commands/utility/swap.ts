import { SlashCommandBuilder, MessageFlags } from 'discord.js'
import { YoutubeMusicPlayer } from '../../MusicPlayer'

// Utility to move an item in an array from one position to another
const moveTrack = async (musicPlayer: YoutubeMusicPlayer, queue: any[], fromIndex: number, toIndex: number) => {
  const item = queue.splice(fromIndex, 1)[0]
  queue.splice(toIndex, 0, item)
  await musicPlayer.sendOrUpdateQueueEmbed()
}

// Utility to swap two items in an array
const swapTracks = async (musicPlayer: YoutubeMusicPlayer, queue: any[], indexA: number, indexB: number) => {
  ;[queue[indexA], queue[indexB]] = [queue[indexB], queue[indexA]]
  await musicPlayer.sendOrUpdateQueueEmbed()
}

export default {
  data: new SlashCommandBuilder()
    .setName('swap')
    .setDescription('Move or swap tracks in the queue')
    .addSubcommand((sub) =>
      sub
        .setName('movetotop')
        .setDescription('Move a track to the top of the queue')
        .addIntegerOption((option) =>
          option.setName('position').setDescription('Position of the track to move to the top').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('swap')
        .setDescription('Swap two tracks in the queue')
        .addIntegerOption((option) =>
          option.setName('position1').setDescription('First track position').setRequired(true)
        )
        .addIntegerOption((option) =>
          option.setName('position2').setDescription('Second track position').setRequired(true)
        )
    ),

  async execute(interaction: any) {
    const musicPlayer = interaction.client.musicPlayer
    const subcommand = interaction.options.getSubcommand()
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

    if (subcommand === 'movetotop') {
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

      const trackName = queue[position].video.title
      await moveTrack(musicPlayer, queue, position, 0)

      interaction.client.musicPlayer.sendOrUpdateQueueEmbed()
      interaction.reply({
        content: `Moved "${trackName}" to the top of the queue.`,
        flags: MessageFlags.Ephemeral,
      })
      setTimeout(() => {
        interaction.deleteReply().catch(console.error)
      }, 5000)
      return
    }

    if (subcommand === 'swap') {
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

      return interaction.reply({
        content: `Swapped track #${pos1 + 1} with track #${pos2 + 1}.`,
      })
    }
  },
}
