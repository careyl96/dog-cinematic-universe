import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { queue } from '../../helpers/playerFunctions'
import { createYoutubeUrlFromId } from '../../helpers/youtubeHelpers/youtubeFormatterHelpers'
import { getCachedTracks } from '../../helpers/musicDataHelpers'
import { getGuildMember, getRandomKeys } from '../../helpers/otherHelpers'

export default {
  data: new SlashCommandBuilder()
    .setName('cache')
    .setDescription('Plays tracks from cache')
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((option) =>
      option.setName('count').setMaxValue(50).setDescription('Number of random songs to queue').setRequired(false)
    ),
  async execute(interaction: any) {
    const user = await getGuildMember(interaction.user.id)
    const count = interaction.options.getInteger('count') || 1

    await interaction.followUp({
      allowedMentions: {
        parse: [],
      },
      content: `<@${interaction.user.id}> used cache ${count}!`.trim(),
    })

    const cachedTracks = getCachedTracks()
    let youtubeUrls = getRandomKeys(cachedTracks).map(
      (videoId) => cachedTracks[videoId].url || createYoutubeUrlFromId(videoId)
    )

    await queue({
      user,
      query: youtubeUrls,
      saveToHistory: false,
    })
  },
}
