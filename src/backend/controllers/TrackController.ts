import { EntityManager, In } from 'typeorm'
import { Track } from '../entities/Track'
import { BaseController } from './BaseController'
import { UncompressedTrack, uncompressTrack } from '../../helpers/youtubeHelpers/youtubeFormatterHelpers'
import { BOT_USER_ID } from '../../constants'
import { FormattedYoutubeVideo } from '../../helpers/youtubeHelpers/youtubeHelpers'

export class TrackController extends BaseController<Track> {
  constructor(manager?: EntityManager) {
    super(Track, manager)
  }

  async upsert(trackData: Partial<Track>): Promise<Track> {
    const { id } = trackData
    if (!id) {
      throw new Error('Must provide id to upsert a Track')
    }

    const existing = await this.repo.findOneBy({ id })

    if (existing) {
      const merged = this.repo.merge(existing, trackData)
      return this.repo.save(merged) // no need to await here
    }

    const newTrack = this.repo.create(trackData)
    return this.repo.save(newTrack)
  }

  async ensureTrackCompleteOrUpsert(trackData: Partial<Track | FormattedYoutubeVideo>, userId: string): Promise<Track> {
    if (!trackData.id) throw new Error('Track data must have an id')

    const track = await this.getById(trackData.id)
    const isMissingFields =
      !track || !track.title || !track.duration || !track.liveBroadcastContent || !track.firstPlayedBy

    if (isMissingFields) {
      const updatedTrackData: Partial<Track> = {
        ...trackData,
      }

      // Only set firstPlayedBy if not set and userId is NOT the bot user
      if ((!track || !track.firstPlayedBy) && userId !== BOT_USER_ID) {
        updatedTrackData.firstPlayedBy = userId
      }

      return this.upsert(updatedTrackData)
    }

    return track
  }

  getAll(): Promise<Track[]> {
    return this.repo.find()
  }

  async getAllNonBlacklisted(): Promise<UncompressedTrack[]> {
    const tracks = await this.repo.find({
      where: { blacklisted: false },
    })

    return tracks.map((track) => this.formatTrack(track) as any)
  }

  getById(id: string): Promise<Track | null> {
    return this.repo.findOneBy({ id })
  }

  async getByIds(ids: string[]): Promise<Track[]> {
    const tracks = await this.repo.findBy({
      id: In(ids),
    })

    // Sort the fetched tracks based on the order of IDs in the input array
    const trackMap = new Map(tracks.map((track) => [track.id, track]))
    const sortedTracks = ids.map((id) => trackMap.get(id)).filter((track): track is Track => !!track)

    return sortedTracks.map((track) => this.formatTrack(track)) as any
  }

  async getByIdAndFormat(id: string): Promise<UncompressedTrack | null> {
    const track = await this.repo.findOneBy({ id })

    if (!track || !track.title || !track.duration || !track.liveBroadcastContent) {
      return null
    }

    return this.formatTrack(track) as any
  }

  async blacklistById(id: string): Promise<Track | null> {
    const existing = await this.repo.findOneBy({ id })

    if (existing) {
      existing.blacklisted = true
      return this.repo.save(existing)
    }

    const newTrack = this.repo.create({ id, blacklisted: true })
    return this.repo.save(newTrack)
  }

  async unBlacklistById(id: string): Promise<Track | null> {
    const existing = await this.repo.findOneBy({ id })

    if (existing) {
      existing.blacklisted = false
      return this.repo.save(existing)
    }

    const newTrack = this.repo.create({ id, blacklisted: false })
    return this.repo.save(newTrack)
  }

  getAllBlacklisted(): Promise<Track[]> {
    return this.repo.find({
      where: { blacklisted: true },
    })
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete({ id })
    return result.affected !== 0
  }

  formatTrack(track: Track) {
    if (!track || !track.title || !track.duration || !track.liveBroadcastContent) {
      return null
    }

    return uncompressTrack(track)
  }
}
