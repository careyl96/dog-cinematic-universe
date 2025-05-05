import fs from 'fs'
import path from 'path'
import { InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { PATH } from '../../constants'
import { createLikedEmbed } from '../../helpers/embedHelpers'
import { escapeDiscordMarkdown } from '../../helpers/formatterHelpers'

export default {
  data: new SlashCommandBuilder()
    .setName('likedsongs')
    .setDescription('Your liked songs')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction: any) {
    const userId = interaction.user.id

    const dirPath = path.join(PATH.USER_DATA, userId)
    const filePath = path.join(dirPath, 'liked_music.json')

    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8')
        const parsedContent = JSON.parse(fileContent)
        const likedSongs = Object.keys(parsedContent).map((key) => parsedContent[key])

        if (likedSongs.length > 0) {
          const likedSongsEmbedText = likedSongs
            .map((item, index) => `[${index + 1}] [${escapeDiscordMarkdown(item.title)}](${item.url})`)
            .join('\n')

          interaction.reply({
            embeds: [createLikedEmbed({ text: likedSongsEmbedText })],
            flags: MessageFlags.Ephemeral,
          })
        } else {
          interaction.reply({
            content: 'No liked songs found. Like a song by reacting to it!',
            flags: MessageFlags.Ephemeral,
          })
        }
      } catch (err) {
        console.error('Error reading or parsing existing liked_music.json:', err)
        interaction.reply({
          content: 'No liked songs found. Like a song by reacting to it!',
          flags: MessageFlags.Ephemeral,
        })
      }
    }
  },
}
