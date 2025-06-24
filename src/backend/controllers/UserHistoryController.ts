import { EntityManager } from 'typeorm'
import { UserHistory } from '../entities/UserHistory'
import { BaseController } from './BaseController'

export class UserHistoryController extends BaseController<UserHistory> {
  constructor(manager?: EntityManager) {
    super(UserHistory, manager)
  }

  async logUserTrackPlay({
    userId,
    trackId,
    guildId,
    playedAt,
  }: {
    userId: string
    trackId: string
    guildId: string
    playedAt: Date
  }): Promise<UserHistory> {
    const newEntry = this.repo.create({ userId, guildId, trackId, playedAt })
    return await this.repo.save(newEntry)
  }

  async getUserHistory(userId: string): Promise<UserHistory[]> {
    return this.repo.find({ where: { userId }, order: { playedAt: 'DESC' } })
  }
}
