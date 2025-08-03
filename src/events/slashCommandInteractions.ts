import { Events, Interaction, MessageFlags } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { createErrorEmbed } from '../helpers/embedHelpers'
import { GuildSession } from '../GuildSession'

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(client: ClientWithCommands, session: GuildSession, interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return

    const command = client.commands.get(interaction.commandName)
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`)
      return
    }

    try {
      const deferEarly = [
        'play',
        'remove',
        // 'tts',
        // 'groq',
      ]

      const deferThenDelete = [
        'stop',
        'skip',
        'shuffle',
        'pause',
        'unpause',
        // 'roulette',
        // 'enablevoicecommands',
        // 'disablevoicecommands',
      ]

      if (deferEarly.includes(interaction.commandName)) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
      }

      if (deferThenDelete.includes(interaction.commandName)) {
        await interaction.deferReply()
        await interaction.deleteReply()
      }

      await command.execute(interaction)
    } catch (error: any) {
      const errorMessage = error?.message || 'Something went very wrong oopsie woopsie woof report to Carey'
      console.error('interactionCreate error:', error)

      const replyPayload = createErrorEmbed({
        errorMessage,
      }) as any

      if (interaction.replied || interaction.deferred) {
        interaction.deleteReply()
        await session.musicBotTextChannel.send(replyPayload)
      } else {
        console.log(replyPayload)
        // await interaction.reply(replyPayload)
      }
    }
  },
}
