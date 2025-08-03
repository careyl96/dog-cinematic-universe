import { Readable } from 'stream'
import ffmpeg from 'fluent-ffmpeg'
import { createYoutubeAudioStream, FormattedYoutubeVideo } from './youtubeHelpers/youtubeHelpers'
import { CachedTrackController } from '../backend/controllers/CachedTrackController'
import { TrackController } from '../backend/controllers/TrackController'
import { cachedTrackCtrl } from '../backend/controllers/Controllers'
import { Track } from '../backend/entities/Track'
import { AppDataSource } from '../backend/db/data-source'
import { ExtendedTrack } from '../EmbedManager'

export const cacheAudioResource = async (
  stream: Readable,
  video: ExtendedTrack | FormattedYoutubeVideo
): Promise<void> => {
  const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
  const cachedTrackCtrl = new CachedTrackController()
  const trackCtrl = new TrackController()

  const track = await trackCtrl.getById(video.id)
  if (!track) {
    console.warn(`⚠️ Track not found for video ${video.id}. Skipping cache.`)
    return
  }

  const alreadyCached = await cachedTrackCtrl.getById(video.id)
  if (alreadyCached) return

  const chunks: Buffer[] = []
  let totalSize = 0
  let exceeded = false

  await new Promise<void>((resolve) => {
    const ffmpegProcess = ffmpeg(stream)
      // .inputFormat('webm')
      .audioCodec('libvorbis')
      .format('ogg')
      .on('error', (err) => {
        console.warn(`⚠️ FFmpeg caching error for ${video.id}:`, err.message)
        resolve()
      })

    const output = ffmpegProcess.pipe()

    output.on('data', (chunk: Buffer) => {
      if (exceeded) return

      totalSize += chunk.length
      if (totalSize > MAX_SIZE) {
        console.warn(`⚠️ Skipped caching: Audio exceeds 10MB limit for video ${video.id}`)
        exceeded = true
        chunks.length = 0 // Clear accumulated data
        return
      }

      chunks.push(chunk)
    })

    output.on('end', async () => {
      if (exceeded || chunks.length === 0) return resolve()

      try {
        const trackEntity = Object.assign(new Track(), track)
        const oggBuffer = Buffer.concat(chunks)
        const cachedTrack = await cachedTrackCtrl.upsert(video.id, oggBuffer, trackEntity)
        const { data, ...rest } = cachedTrack
        console.log(`💾 Cached audio!`, rest)
      } catch (e) {
        console.error(`❌ Error saving cached audio for ${video.id}:`, e)
      }

      resolve()
    })
  })
}

export const getAudioSource = async (video: ExtendedTrack | FormattedYoutubeVideo) => {
  const cachedTrack = await cachedTrackCtrl.getById(video.id)

  return {
    cachedTrack: !!cachedTrack,
    audioStream: cachedTrack?.data
      ? Readable.from([cachedTrack.data]) // note: safer than just .from(cachedTrack.data)
      : await createYoutubeAudioStream(video),
  }
}
