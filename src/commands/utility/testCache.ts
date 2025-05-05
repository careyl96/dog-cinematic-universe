import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { queue, roulette } from '../../helpers/playerFunctions'
import { createYoutubeUrlFromId } from '../../helpers/youtubeHelpers/youtubeFormatterHelpers'
import { getCachedTracks, getUserMusicHistory } from '../../helpers/musicDataHelpers'
import { getGuildMember } from '../../helpers/otherHelpers'

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
    let youtubeUrls = getRandomKeys(cachedTracks, count).map(
      (videoId) => cachedTracks[videoId].url || createYoutubeUrlFromId(videoId)
    )

    await queue({
      user,
      query: youtubeUrls,
      saveToHistory: false,
    })
  },
}

export const getRandomKeys = (obj: Record<string, any>, n: number): string[] => {
  // Get all keys of the object
  const keys = Object.keys(obj)

  // Shuffle the keys array using Fisher-Yates algorithm
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[keys[i], keys[j]] = [keys[j], keys[i]] // Swap the elements
  }

  // Return the first `n` keys from the shuffled array
  return keys.slice(0, n)
}
