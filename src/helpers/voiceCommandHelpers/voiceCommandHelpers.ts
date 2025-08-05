import { EndBehaviorType } from '@discordjs/voice'
import prism from 'prism-media'
import ffmpeg from 'fluent-ffmpeg'
import { PassThrough } from 'node:stream'
import dotenv from 'dotenv'
import { GuildSession } from '../../GuildSession'

dotenv.config()

export const handleUserSpeaking = (session: GuildSession, userId: string) => {
  if (!session.ws || session.ws.readyState !== session.ws.OPEN || session.activeSpeakers.has(userId)) return

  const opusStream = session.connection.receiver.subscribe(userId, {
    end: {
      behavior: EndBehaviorType.AfterSilence,
      duration: 1000,
    },
  })

  const decoder = new prism.opus.Decoder({
    rate: 48000,
    channels: 1,
    frameSize: 960,
  })

  const resampledPCMStream = new PassThrough()
  const decodedPCMStream = opusStream.pipe(decoder)

  ffmpeg()
    .input(decodedPCMStream)
    .inputFormat('s16le')
    .audioFrequency(16000)
    .audioChannels(1)
    .audioCodec('pcm_s16le')
    .format('s16le')
    .on('error', (err) => {
      console.error(`FFmpeg error [${userId}]:`, err.message)
    })
    .pipe(resampledPCMStream)

  resampledPCMStream.on('data', (chunk: Buffer) => {
    if (session.ws?.readyState !== session.ws.OPEN) return

    const metadata = {
      sampleRate: 16000,
      user: userId,
      source: 'discord',
    }

    const metadataJson = Buffer.from(JSON.stringify(metadata), 'utf-8')
    const metadataLength = Buffer.alloc(4)
    metadataLength.writeUInt32LE(metadataJson.length, 0)

    const packet = Buffer.concat([metadataLength, metadataJson, chunk])
    session.ws.send(packet)
  })

  resampledPCMStream.on('end', () => {
    opusStream.destroy()
    session.activeSpeakers.delete(userId)

    if (session.ws?.readyState !== session.ws.OPEN) return

    const metadata = {
      sampleRate: 16000,
      user: userId,
      source: 'discord',
      event: 'end',
    }

    const metadataJson = Buffer.from(JSON.stringify(metadata), 'utf-8')
    const metadataLength = Buffer.alloc(4)
    metadataLength.writeUInt32LE(metadataJson.length, 0)

    // ❗ Send only metadata, no chunk
    const packet = Buffer.concat([metadataLength, metadataJson])
    session.ws.send(packet)
  })

  session.activeSpeakers.set(userId, true)
}
