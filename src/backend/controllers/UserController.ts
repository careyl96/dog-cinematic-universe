import { EntityManager } from 'typeorm'
import { BaseController } from './BaseController'
import { User } from '../entities/User'
import { playlistCtrl } from './Controllers'

export class UserController extends BaseController<User> {
  constructor(manager?: EntityManager) {
    super(User, manager)
  }

  async upsert(userId: string, data: Partial<User> = {}): Promise<User> {
    if (!userId) {
      throw new Error('userId is required for upsert user')
    }

    let user = await this.repo.findOneBy({ id: userId })

    if (user) {
      // Merge new data into the existing user
      this.repo.merge(user, data)
      return await this.repo.save(user)
    } else {
      // Create new user
      user = this.repo.create({ id: userId, ...data })
      const newUser = await this.repo.save(user)

      const playlists = await playlistCtrl.getByUserId(userId)
      const hasDefaultPlaylist = playlists.some((pl) => pl.deletable === false)

      if (!hasDefaultPlaylist) {
        await playlistCtrl.create({
          userId,
          name: 'Liked Songs',
          public: false,
          deletable: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }

      return newUser
    }
  }

  async getById(userId: string): Promise<User | null> {
    return await this.repo.findOneBy({ id: userId })
  }

  async getUsers(): Promise<User[]> {
    return await this.repo.find()
  }

  async deleteUser(userId: string): Promise<boolean> {
    const result = await this.repo.delete({ id: userId })
    return result.affected !== 0
  }
}
