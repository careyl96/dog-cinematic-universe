import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { writeFileSync } from 'fs'
import { PATH } from '../../constants'
import axios, { AxiosRequestConfig } from 'axios'
import dotenv from 'dotenv'
import https from 'https'
import { client } from '../..'
import { createErrorEmbed } from '../../helpers/embeds'

dotenv.config()

export default {
  data: new SlashCommandBuilder()
    .setName('tts')
    .setDescription('TTS')
    .addStringOption(
      (option) =>
        option
          .setName('text') // Changed from 'youtube link' to 'link'
          .setDescription('Type something to TTS')
          .setRequired(true) // Makes it required
    )
    .addStringOption((option) =>
      option
        .setName('voice') // Changed from 'youtube link' to 'link'
        .setDescription('Voice')
        .addChoices([
          { name: 'af', value: 'af' },
          { name: 'af_bella', value: 'af_bella' },
          { name: 'af_sarah', value: 'af_sarah' },
          { name: 'am_adam', value: 'am_adam' },
          { name: 'am_michael', value: 'am_michael' },
          { name: 'bf_emma', value: 'bf_emma' },
          { name: 'bf_isabella', value: 'bf_isabella' },
          { name: 'bm_george', value: 'bm_george' },
          { name: 'bm_lewis', value: 'bm_lewis' },
          { name: 'af_nicole', value: 'af_nicole' },
          { name: 'af_sky', value: 'af_sky' },
        ])
    )
    .setContexts(InteractionContextType.Guild),

  async execute(interaction: any) {
    const ttsText = interaction.options.getString('text')
    const ttsVoice = interaction.options.getString('voice') || 'am_michael'

    try {
      const currentVoiceChannelId = interaction.member!.voice.channelId
      if (client.voiceChannel?.id !== currentVoiceChannelId) {
        client.joinVoiceChannel(currentVoiceChannelId)
      }

      await playTTSAudio(ttsText, ttsVoice)
      interaction.followUp(`TTS: ${ttsText}`)
    } catch (err: any) {
      if (err.code === 'ECONNABORTED') {
        interaction.followUp(
          createErrorEmbed({
            errorMessage: 'TTS server did not respond',
          }) as any
        )
      } else {
        interaction.followUp(
          createErrorEmbed({
            errorMessage: err.message,
          }) as any
        )
      }
    }
  },
}

export const playTTSAudio = async (
  ttsText: string,
  ttsVoice: string = 'am_michael'
) => {
  if (!ttsText) return

  const body = {
    model: 'hexgrad/Kokoro-82M',
    voice: ttsVoice,
    input: ttsText.replace(/\*/g, ''),
    response_format: 'mp3',
    speed: 1.2,
  }

  const config: AxiosRequestConfig = {
    responseType: 'arraybuffer',
    httpsAgent: new https.Agent({
      rejectUnauthorized: false, // Ignore SSL errors
    }),
    timeout: 10000,
  }

  const response = await axios.post(
    `${process.env.WHISPER_API}/v1/audio/speech`,
    body,
    config
  ).catch((err) => {
    console.error(err)
    throw new Error('TTS server did not respond')
  })

  const ttsOutputPath = `${PATH.AUDIO_FILES.GENERATED.TTS}/output.mp3`
  writeFileSync(ttsOutputPath, response.data)

  client.playAudioFromFilePath({
    audioFilePath: ttsOutputPath,
    temporarilyOverwriteAudio: true,
  })
}
