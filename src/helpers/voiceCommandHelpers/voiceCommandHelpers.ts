import { EndBehaviorType } from '@discordjs/voice'
import { GuildMember } from 'discord.js'
import { pipeline } from 'node:stream/promises'
import prism from 'prism-media'
import { createWriteStream } from 'fs'
import { ClientWithCommands } from '../../ClientWithCommands'
import path from 'node:path'
import { PATH } from '../../constants'
import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import { createReadStream, unlink } from 'node:fs'
import FormData from 'form-data'
import https from 'https'
import axios from 'axios'
import dotenv from 'dotenv'
import { client } from '../..'

dotenv.config()
ffmpeg.setFfmpegPath(ffmpegPath!)

export const parseCommandWordAndQuery = (
  words: string[],
  commands: string[]
): [string, string] => {
  let commandWord = ''
  let query = ''

  const firstTriggerWords = [
    'dog',
    'dawg',
    'dogs',
    'e-dog',
    'yogg',
    'bot',
    'bought',
  ]

  const startsWithTrigger = firstTriggerWords.includes(words[0]!)

  if (startsWithTrigger) {
    if (commands.includes(words[1]!)) {
      commandWord = words[1]!
      query = words.slice(2).join(' ')
    } else {
      query = words.slice(1).join(' ')
    }
  } else {
    if (commands.includes(words[0]!)) {
      commandWord = words[0]!
      query = words.slice(1).join(' ')
    } else {
      query = words.join(' ')
    }
  }

  return [commandWord, query]
}

// transcodes discord voice input to text and checks for voice commands
export const transcodeUserVoiceInput = async (
  client: ClientWithCommands,
  user: GuildMember
) => {
  // prevent creation of unnecessary extra streams
  if (client.activeSpeakers.has(user.id)) return
  client.activeSpeakers.add(user.id)

  try {
    const userIdAndName = `${user.id}_${user.displayName}`
    const userIdAndNameWithDatePcm = `${Date.now()}_${userIdAndName}`

    const pcmOutputPath = path.join(
      PATH.AUDIO_FILES.GENERATED.PCM,
      `${userIdAndNameWithDatePcm}.pcm`
    )
    const wavOutputPath = path.join(
      PATH.AUDIO_FILES.GENERATED.WAV,
      `${userIdAndNameWithDatePcm}.wav`
    )

    // https://discord.js.org/docs/packages/voice/main/VoiceReceiver:Class#subscribe
    // receiver.subscribe returns raw discord audio output as readable stream of Opus packets
    const readStream = client.connection!.receiver.subscribe(user.id, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 1000,
      },
    })
    readStream
      .once('end', () => {
        client.activeSpeakers.delete(user.id)
      })
      .on('error', (err) => {
        console.error(err)
      })

    // create write stream for pcm output file
    const writeStream = createWriteStream(
      path.join(
        PATH.AUDIO_FILES.GENERATED.PCM,
        `${userIdAndNameWithDatePcm}.pcm`
      )
    )
    writeStream.on('error', (err) => {
      console.error(err)
    })

    // middleware to transcode raw discord audio output to PCM format
    const opusDecoder = new prism.opus.Decoder({
      rate: 48000,
      frameSize: 960,
      channels: 1,
    })

      // transcode raw discord input to pcm file
    await pipeline(readStream, opusDecoder, writeStream)

    // transcode pcm file to wav file
    await transcodePcmToWav(pcmOutputPath, wavOutputPath)

    // transcribe audio file using whisper api
    const responseText = await transcribeAudioWithWhisper(wavOutputPath)
    return responseText
    // ignore common hallucinations from faster-whisper based models
  } catch (err: any) {
    client.activeSpeakers.delete(user.id)
    console.error(err)
  }
}

export const transcodePcmToWav = async (
  pcmPath: string,
  outputPath: string // output path for wav file
): Promise<string> => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(pcmPath)
      .inputFormat('s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .output(outputPath)
      // current implementation always deletes pcm file regardless of success or fail 2/12/25
      .on('error', function (err, stdout, stderr) {
        unlink(pcmPath, (err) => {
          if (err) console.error(err)
        })
        reject(err)
        console.log('##### FFmpeg: Cannot process audio: ' + err.message)
      })
      .on('end', function (stdout, stderr) {
        unlink(pcmPath, (err) => {
          if (err) console.error(err)
        })
        resolve(outputPath)
      })
      .run()
  })
}

export const transcribeAudioWithWhisper = async (
  audioFilePath: string
): Promise<string> => {
  // Perform a POST request using axios
  let responseText
  try {
    const formData = new FormData()
    const audioFileStream = createReadStream(audioFilePath)

    formData.append('model', 'Systran/faster-distil-whisper-large-v3')
    // formData.append('model', 'Systran/faster-whisper-tiny')
    formData.append('language', 'en')
    formData.append('response_format', 'text')
    formData.append('temperature', '0')
    formData.append('vad_filter', 'true')
    formData.append('file', audioFileStream)

    const agent = new https.Agent({
      rejectUnauthorized: false, // Ignore SSL errors
    })

    const config = {
      headers: {
        ...formData.getHeaders(),
      },
      httpsAgent: agent,
      timeout: 30000,
    }

    const whisperApi = `${process.env.WHISPER_API}/v1/audio/transcriptions`
    const response = await axios.post(whisperApi, formData, config)
    // Extract and log the transcription result
    responseText = response.data
    unlink(audioFilePath, (err) => {
      if (err) console.error(err)
    })
  } catch (err: any) {
    console.error(err.message)
    client.setVoiceCommands(false)
    unlink(audioFilePath, (err) => {
      if (err) console.error(err)
    })
  }

  return responseText
}

export const fetchModels = async () => {
  const agent = new https.Agent({
    rejectUnauthorized: false, // Ignore SSL errors
  })

  const config = {
    httpsAgent: agent,
    timeout: 2000,
  }

  try {
    const models = await axios.get(
      `${process.env.WHISPER_API}/v1/models`,
      config
    )
    console.log(
      models.data.data
        .filter((model: any) => model.id.includes('whisper-large-v3-turbo'))
        .map((model: any) => model.id)
    )
    client.setVoiceCommands(true)
    return models.data.data
  } catch (err: any) {
    console.error(err.message)
    client.setVoiceCommands(false)
  }
}
