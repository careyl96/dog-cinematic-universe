import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { queue, roulette } from '../../helpers/playerFunctions'
import { createYoutubeUrlFromId } from '../../helpers/youtubeHelpers/youtubeFormatterHelpers'
import { getUserMusicHistory } from '../../helpers/musicDataHelpers'
import { getGuildMember } from '../../helpers/otherHelpers'

export default {
  data: new SlashCommandBuilder()
    .setName('roulette')
    .setDescription('Plays random previously played tracks')
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((option) =>
      option.setName('count').setMaxValue(50).setDescription('Number of random songs to queue').setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('user')
        .setDescription('Filter by user')
        .setRequired(false)
        .addChoices([
          { name: 'Carey', value: '118585025905164291' },
          { name: 'Alan', value: '119671396807737347' },
          { name: 'Rudy', value: '119718851402268674' },
          { name: 'Jesse', value: '120031401948086272' },
          { name: 'Steven', value: '121543449664159744' },
          { name: 'Tyler', value: '130770349234192384' },
          { name: 'Aurlin', value: '177932180725563392' },
          { name: 'Johny', value: '258161760366886913' },
          { name: 'Chris', value: '298354211580674048' },
          { name: 'CLIFFORD', value: '333842059150753794' },
        ])
    ),
  async execute(interaction: any) {
    const user = await getGuildMember(interaction.user.id)
    const count = interaction.options.getInteger('count') || 1
    const userIdFilter = interaction.options.getString('user')

    await interaction.followUp({
      allowedMentions: {
        parse: [],
      },
      content: `<@${interaction.user.id}> used </roulette:1356769593208606791> ${count}!`.trim(),
    })

    if (userIdFilter) {
      const userMusicHistory = getUserMusicHistory(userIdFilter)
      if (userMusicHistory) {
        const youtubeUrls = getRandomKeys(userMusicHistory, count).map((videoId) => createYoutubeUrlFromId(videoId))

        await queue({
          user,
          query: youtubeUrls,
          saveHistory: false,
          interaction,
        })
      }
    } else {
      await roulette(user.id, count)
    }
  },
}

const getRandomKeys = (obj: Record<string, any>, n: number): string[] => {
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
