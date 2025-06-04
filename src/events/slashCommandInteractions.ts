import { Events, Interaction, MessageFlags } from 'discord.js'
import { ClientWithCommands } from '../ClientWithCommands'
import { createErrorEmbed } from '../helpers/embedHelpers'

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(client: ClientWithCommands, interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return

    const command = client.commands.get(interaction.commandName)
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`)
      return
    }

    try {
      const deferEarly = [
        'tts',
        'play',
        'cache', // temp
        'noncached', // temp
        'playprev',
        'groq',
      ]

      const deferThenDelete = [
        'stop',
        'skip',
        'shuffle',
        'pause',
        'roulette',
        'enablevoicecommands',
        'disablevoicecommands',
        'unpause',
      ]

      if (deferEarly.includes(interaction.commandName)) {
        await interaction.deferReply()
      }

      if (interaction.commandName === 'remove') {
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
        flags: MessageFlags.Ephemeral,
      }) as any

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyPayload)
      } else {
        await interaction.reply(replyPayload)
      }
    }
  },
}
