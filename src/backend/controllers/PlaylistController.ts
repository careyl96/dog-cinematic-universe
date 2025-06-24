import { EntityManager, In } from 'typeorm'
import { BaseController } from './BaseController'
import { Playlist } from '../entities/Playlist'
import { PlaylistTrack } from '../entities/PlaylistTrack'
import {
  Track,
  TrackCompressed,
  uncompressTrack,
} from '../../helpers/youtubeHelpers/youtubeFormatterHelpers'

export class PlaylistController extends BaseController<Playlist> {
  constructor(manager?: EntityManager) {
    super(Playlist, manager)
  }

  async create(data: Partial<Playlist>): Promise<Playlist> {
    const playlist = this.repo.create({
      ...data,
      public: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return await this.repo.save(playlist)
  }

  async createPublic(data: Partial<Playlist>): Promise<Playlist> {
    const playlist = this.repo.create({
      ...data,
      public: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return await this.repo.save(playlist)
  }

  async getAll(): Promise<Playlist[]> {
    return await this.repo.find({
      order: { updatedAt: 'DESC' },
      relations: ['tracks', 'tracks.track'],
    })
  }

  async getById(playlistId: number): Promise<Playlist | null> {
    return await this.repo.findOne({
      where: { id: playlistId },
      order: { updatedAt: 'DESC' },
      relations: ['tracks', 'tracks.track'],
    })
  }

  async getByUserId(userId: string): Promise<Playlist[]> {
    return await this.repo.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      relations: ['tracks', 'tracks.track'],
    })
  }

  async getUserFavorites(userId: string): Promise<{ playlist: Playlist; tracks: any[] } | null> {
    const playlist = await this.repo.findOne({
      where: {
        userId,
        deletable: false,
      },
      relations: ['tracks', 'tracks.track'],
    })

    if (!playlist) return null

    return {
      playlist,
      tracks: playlist.tracks.map((playlistTrack) => uncompressTrack(playlistTrack.track)),
    }
  }

  async getPublicByGuildId(guildId: string): Promise<Playlist[]> {
    return await this.repo.find({
      where: {
        public: true,
        guild: { id: guildId },
      },
      order: { updatedAt: 'DESC' },
      relations: ['tracks', 'tracks.track'],
    })
  }

  async update(id: number, data: Partial<Playlist>): Promise<Playlist | null> {
    const playlist = await this.repo.findOneBy({ id })
    if (!playlist) return null
    this.repo.merge(playlist, { ...data, updatedAt: new Date() })
    return await this.repo.save(playlist)
  }

  async delete(ids: number[]): Promise<Playlist[]> {
    const deletableEntries = await this.repo.findBy({
      id: In(ids),
      deletable: true,
    })

    if (deletableEntries.length === 0) {
      return []
    }

    const deletableIds = deletableEntries.map((p) => p.id)
    await this.repo.delete(deletableIds)

    return deletableEntries
  }

  // --- PlaylistTrack management methods ---

  async addTrack(playlistId: number, trackId: string, position?: number): Promise<PlaylistTrack> {
    const playlistTrackRepo = this.repo.manager.getRepository(PlaylistTrack)

    if (position === undefined) {
      const lastTrack = await playlistTrackRepo
        .createQueryBuilder('pt')
        .where('pt.playlistId = :playlistId', { playlistId })
        .orderBy('pt.position', 'DESC')
        .limit(1)
        .getOne()

      position = lastTrack?.position != null ? lastTrack.position + 1 : 0
    }

    const playlistTrack = playlistTrackRepo.create({
      playlistId,
      trackId,
      position,
      addedAt: new Date(),
    })

    const savedTrack = await playlistTrackRepo.save(playlistTrack)

    await this.updatePlaylistUpdatedAt(playlistId)

    return savedTrack
  }

  async addFavorite(userId: string, trackId: string): Promise<PlaylistTrack> {
    // Try to find the non-deletable playlist (Favorites)
    const likedTracksPlaylist = await this.repo.findOne({
      where: {
        userId,
        deletable: false,
      },
    })

    // Add the track to the favorites playlist
    return await this.addTrack(likedTracksPlaylist.id, trackId)
  }

  async removeFavorite(userId: string, trackId: string): Promise<PlaylistTrack> {
    // Try to find the non-deletable playlist (Favorites)
    const likedTracksPlaylist = await this.repo.findOne({
      where: {
        userId,
        deletable: false,
      },
    })

    const removedTrack = await this.removeTrack(likedTracksPlaylist.id, trackId)
    await this.updatePlaylistUpdatedAt(likedTracksPlaylist.id)

    return removedTrack
  }

  async removeTrack(playlistId: number, trackId: string): Promise<PlaylistTrack | null> {
    const playlistTrackRepo = this.repo.manager.getRepository(PlaylistTrack)

    // Find the playlist track with the related track entity
    const track = await playlistTrackRepo.findOne({
      where: { playlistId, trackId },
      relations: ['track'],
    })
    if (!track) return null

    const result = await playlistTrackRepo.delete({ playlistId, trackId })

    if (result.affected) {
      await this.updatePlaylistUpdatedAt(playlistId)
      return track
    }

    return null
  }

  async removeTracks(playlistId: number, trackIds: string[]): Promise<PlaylistTrack[]> {
    if (trackIds.length === 0) return []

    const playlistTrackRepo = this.repo.manager.getRepository(PlaylistTrack)

    // Fetch playlist tracks WITH their related track entities
    const tracks = await playlistTrackRepo.find({
      where: {
        playlistId,
        trackId: In(trackIds),
      },
      relations: ['track'],
    })

    if (tracks.length === 0) return []

    const result = await playlistTrackRepo.delete({
      playlistId,
      trackId: In(trackIds),
    })

    if (result.affected) {
      await this.updatePlaylistUpdatedAt(playlistId)
      return tracks
    }

    return []
  }

  private async updatePlaylistUpdatedAt(playlistId: number): Promise<void> {
    await this.repo.update(playlistId, { updatedAt: new Date() })
  }
}
