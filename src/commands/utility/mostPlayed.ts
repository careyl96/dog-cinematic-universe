import fs from 'fs'
import path from 'path'
import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { BOT_USER_ID, PATH } from '../../constants'
import { escapeDiscordMarkdown } from '../../helpers/formatterHelpers'

export default {
  data: new SlashCommandBuilder()
    .setName('mostplayed')
    .setDescription('Most played songs in the server!')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction: any) {
    const dirPath = path.join(PATH.USER_DATA, BOT_USER_ID)
    const filePath = path.join(dirPath, 'music_queue_history.json')

    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8')
        const parsedContent = JSON.parse(fileContent)
        const playedSongs = Object.keys(parsedContent).map((key) => parsedContent[key])

        const mostPlayed = playedSongs.sort((a, b) => b.requestCount - a.requestCount).slice(0, 20)

        if (mostPlayed.length > 0) {
          const mostPlayedEmbedText = mostPlayed
            .map(
              (item, index) =>
                `[${index + 1}] [${escapeDiscordMarkdown(item.title)}](${item.url}): ${item.requestCount}`
            )
            .join('\n')

          const mostPlayedEmbed = new EmbedBuilder()
            .setColor(0xf47fff)
            .setDescription(`### Most played songs: \n${mostPlayedEmbedText}`)
          await interaction.reply({
            embeds: [mostPlayedEmbed],
          })
        } else {
          interaction.reply({
            content: 'No songs found. Play a song by using the </play:1340153428248100907> command!',
          })
        }
      } catch (err) {
        console.error('Error reading or parsing existing music_queue_history.json:', err)
        interaction.reply({
          content: 'No songs found. Play a song by using the </play:1340153428248100907> command!',
        })
      }
    }
  },
}
