import fs from 'fs'
import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { queue } from '../../helpers/playerFunctions'
import { createYoutubeUrlFromId } from '../../helpers/youtubeHelpers/youtubeFormatterHelpers'
import { getCachedTracks, getUserMusicHistory } from '../../helpers/musicDataHelpers'
import { getGuildMember } from '../../helpers/otherHelpers'
import { BOT_USER_ID, PATH } from '../../constants'
import path from 'path'

export default {
  data: new SlashCommandBuilder()
    .setName('noncached')
    .setDescription('Plays non-cached tracks')
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((option) =>
      option.setName('count').setMaxValue(50).setDescription('Number of random songs to queue').setRequired(false)
    ),
  async execute(interaction: any) {
    const user = await getGuildMember(interaction.user.id)
    const count = interaction.options.getInteger('count') || 1
    const blacklist = Object.keys(getCachedTracks())

    const rawBlacklist = fs.readFileSync(path.join(PATH.USER_DATA, `${BOT_USER_ID}/blacklisted_music.json`), 'utf-8')
    const blacklist2 = JSON.parse(rawBlacklist)

    await interaction.followUp({
      allowedMentions: {
        parse: [],
      },
      content: `<@${interaction.user.id}> used noncached ${count}!`.trim(),
    })

    const userMusicHistory = getUserMusicHistory(BOT_USER_ID)
    let youtubeUrls = getRandomKeys(userMusicHistory, count)
      .filter((videoId) => !blacklist.includes(videoId))
      .filter((videoId) => !blacklist2.includes(videoId))
      .map((videoId) => userMusicHistory[videoId].url || createYoutubeUrlFromId(videoId))

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
