import fs from 'fs'
import path from 'path'
import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { BOT_USER_ID, PATH } from '../../constants'
import { createErrorEmbed } from '../../helpers/embedHelpers'
import { client } from '../..'
import { removeFromQueue } from '../../helpers/playerFunctions'

export default {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Blacklist a song')
    .addIntegerOption((option) =>
      option
        .setName('queueitem')
        .setMaxValue(10)
        .setDescription('Item in queue to blacklist (0 = current track)')
        .setRequired(true)
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction: any) {
    const userId = interaction.user.id
    const queueItemIndex = interaction.options.getInteger('queueitem') || 0

    const dirPath = path.join(PATH.USER_DATA, BOT_USER_ID)
    const filePath = path.join(dirPath, 'blacklisted_music.json')

    try {
      const currentlyPlaying = client.musicPlayer.currentlyPlaying
      const queue = client.musicPlayer.queue
      queue.unshift(currentlyPlaying)

      const itemToBlacklist = queue[queueItemIndex].video

      fs.mkdirSync(dirPath, { recursive: true })
      let blacklist: string[] = []
      if (fs.existsSync(dirPath)) {
        blacklist = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        if (blacklist.indexOf(itemToBlacklist.id) !== -1) return
      }
      blacklist.push(itemToBlacklist.id)

      if (queueItemIndex === 0) {
        client.musicPlayer.skip(userId)
      } else {
        removeFromQueue({ videoId: itemToBlacklist.id })
      }
      fs.writeFileSync(filePath, JSON.stringify(blacklist))

      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle('Blacklisted item:').setDescription(`- ${itemToBlacklist.title}`)],
        flags: MessageFlags.Ephemeral,
      })
    } catch (err) {
      console.error('Error reading or parsing existing blacklisted_music.json:', err)
      interaction.reply(
        createErrorEmbed({
          errorMessage: 'Error blacklisting item',
          flags: MessageFlags.Ephemeral,
        }) as any
      )
    }
  },
}
