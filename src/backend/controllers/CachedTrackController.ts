import { EntityManager } from 'typeorm'
import { BaseController } from './BaseController'
import { CachedTrack } from '../entities/CachedTrack'
import { Track } from '../entities/Track'

export class CachedTrackController extends BaseController<CachedTrack> {
  constructor(manager?: EntityManager) {
    super(CachedTrack, manager)
  }

  async upsert(trackId: string, oggData: Buffer, track?: Track): Promise<CachedTrack> {
    let cachedTrack = await this.repo.findOne({ where: { id: trackId } })
    const now = new Date()

    if (cachedTrack) {
      cachedTrack.data = oggData
      cachedTrack.cachedAt = now
      if (track) cachedTrack.track = track
    } else {
      cachedTrack = this.repo.create({
        id: trackId,
        data: oggData,
        cachedAt: now,
        track,
      })
    }

    return this.repo.save(cachedTrack)
  }

  async getById(trackId: string): Promise<CachedTrack | null> {
    const cachedTrack = await this.repo.findOne({
      where: { id: trackId },
      relations: ['track'],
    })

    if (cachedTrack) {
      cachedTrack.lastPulledAt = new Date()
      await this.repo.save(cachedTrack)
    }

    return cachedTrack
  }

  async getAllCached(): Promise<CachedTrack[]> {
    return this.repo.find()
  }

  async delete(trackId: string): Promise<CachedTrack | null> {
    const cachedTrack = await this.repo.findOneBy({ id: trackId })
    if (!cachedTrack) return null

    await this.repo.delete(trackId)
    return cachedTrack
  }
}
