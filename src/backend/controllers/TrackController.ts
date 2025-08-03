import { EntityManager, In } from 'typeorm'
import { Track } from '../entities/Track'
import { GuildTrackProfile } from '../entities/GuildTrackProfile'
import { BaseController } from './BaseController'
import { uncompressTrack } from '../../helpers/youtubeHelpers/youtubeFormatterHelpers'
import { BOT_USER_ID } from '../../constants'
import { FormattedYoutubeVideo } from '../../helpers/youtubeHelpers/youtubeHelpers'
import { ExtendedTrack } from '../../EmbedManager'
import { guildCtrl } from './Controllers'

export class TrackController extends BaseController<Track> {
  private profileRepo

  constructor(manager?: EntityManager) {
    super(Track, manager)
    this.profileRepo = this.repo.manager.getRepository(GuildTrackProfile)
  }

  async upsert(trackData: Partial<Track> & Partial<GuildTrackProfile>, guildId?: string): Promise<ExtendedTrack> {
    const { id } = trackData
    if (!id) {
      throw new Error('Must provide id to upsert a Track')
    }

    const existing = await this.repo.findOneBy({ id })

    let track: Track
    if (existing) {
      const merged = this.repo.merge(existing, trackData)
      track = await this.repo.save(merged)
    } else {
      const newTrack = this.repo.create(trackData)
      track = await this.repo.save(newTrack)
    }

    let profile
    if (guildId) {
      profile = await this.profileRepo.findOneBy({ guildId, trackId: id })

      if (profile) {
        profile.userPlayCount = trackData.userPlayCount ? trackData.userPlayCount : (profile.userPlayCount ?? 0)
        profile.blacklisted = trackData.blacklisted ?? profile.blacklisted
        profile.firstPlayedBy = profile.firstPlayedBy || trackData.firstPlayedBy
        profile.lastPlayedAt = trackData.lastPlayedAt ?? profile.lastPlayedAt
        profile.volume = trackData.volume ?? profile.volume
        profile = await this.profileRepo.save(profile)
      } else {
        profile = this.profileRepo.create({
          guildId,
          trackId: id,
          userPlayCount: trackData.userPlayCount ?? 0,
          blacklisted: trackData.blacklisted ?? false,
          firstPlayedBy: trackData.firstPlayedBy,
          lastPlayedAt: trackData.lastPlayedAt,
          volume: trackData.volume,
        })
        profile = await this.profileRepo.save(profile)
      }
    }
    return this.formatTrack(track, profile)
  }

  async ensureValidTrackDataOrUpsert(
    trackData: ExtendedTrack | FormattedYoutubeVideo,
    userId: string,
    guildId: string
  ): Promise<ExtendedTrack> {
    if (!trackData.id) throw new Error('Track data must have an id')

    const existingTrack = await this.getById(trackData.id, guildId)

    const needsUpdate =
      !existingTrack ||
      !existingTrack.title ||
      !existingTrack.duration ||
      !existingTrack.liveBroadcastContent ||
      !existingTrack.firstPlayedBy

    if (needsUpdate) {
      const upsertData: Partial<Track> & Partial<GuildTrackProfile> = { ...trackData }
      if ((!existingTrack || !existingTrack.firstPlayedBy) && userId !== BOT_USER_ID) {
        upsertData.firstPlayedBy = userId
      }

      return await this.upsert(upsertData, guildId)
    }

    return existingTrack
  }

  async getAll(): Promise<Track[]> {
    return this.repo.find()
  }

  async getAllNonBlacklisted(guildId: string): Promise<ExtendedTrack[]> {
    const tracks = await this.repo
      .createQueryBuilder('track')
      .innerJoinAndSelect(
        'track.guildTrackProfiles',
        'profile',
        'profile.guildId = :guildId AND profile.blacklisted = false',
        { guildId }
      )
      .getMany()

    return tracks.map((track) => this.formatTrack(this.mergeTrackAndProfile(track)))
  }

  private async fetchTracksWithProfiles(ids: string[], guildId: string): Promise<Track[]> {
    // Fetch all tracks
    const tracks = await this.repo.findBy({ id: In(ids) })
    if (!tracks.length) return []

    // Fetch profiles for these tracks and guild
    const profiles = await this.profileRepo.findBy({
      guildId,
      trackId: In(tracks.map((t) => t.id)),
    })

    const profileMap = new Map<string, GuildTrackProfile>()
    for (const profile of profiles) {
      profileMap.set(profile.trackId, profile)
    }

    // Find missing profiles
    const tracksMissingProfiles = tracks.filter((track) => !profileMap.has(track.id))

    if (tracksMissingProfiles.length) {
      const newProfiles = tracksMissingProfiles.map((track) =>
        this.profileRepo.create({
          guildId,
          trackId: track.id,
          userPlayCount: 0,
          blacklisted: false,
        })
      )
      await this.profileRepo.save(newProfiles)

      // Add newly created profiles to the map
      for (const profile of newProfiles) {
        profileMap.set(profile.trackId, profile)
      }
    }

    // Attach profiles to the tracks
    return tracks.map((track) => {
      track.guildTrackProfiles = [profileMap.get(track.id)!] // guaranteed to exist now
      return track
    })
  }

  private mergeTrackAndProfile(track: Track | ExtendedTrack): Partial<Track> & Partial<GuildTrackProfile> {
    const profile = track.guildTrackProfiles?.[0]
    return profile ? { ...track, ...profile } : track
  }

  async getById(id: string, guildId?: string): Promise<ExtendedTrack | null> {
    let track: Track | undefined

    if (guildId) {
      ;[track] = await this.fetchTracksWithProfiles([id], guildId)
      return track ? this.formatTrack(this.mergeTrackAndProfile(track)) : null
    }

    track = await this.repo.findOne({ where: { id } })

    return track ? this.formatTrack(track) : null
  }

  async getByIds(ids: string[], guildId: string): Promise<ExtendedTrack[]> {
    const tracks = await this.fetchTracksWithProfiles(ids, guildId)
    const trackMap = new Map(tracks.map((track) => [track.id, track]))

    return ids
      .map((id) => {
        const track = trackMap.get(id)
        return track ? this.formatTrack(this.mergeTrackAndProfile(track)) : null
      })
      .filter((t): t is ExtendedTrack => !!t)
  }

  async getByIdAndFormat(id: string, guildId: string): Promise<ExtendedTrack | null> {
    return this.getById(id, guildId)
  }

  async blacklistById(trackId: string, guildId: string): Promise<void> {
    // Ensure the track and guild exist
    await this.repo.findOneByOrFail({ id: trackId })
    await guildCtrl.findOneByOrFail({ id: guildId })

    let profile = await this.profileRepo.findOneBy({ guildId, trackId })
    if (!profile) {
      profile = this.profileRepo.create({ guildId, trackId, blacklisted: true })
    } else {
      profile.blacklisted = true
    }

    await this.profileRepo.save(profile)
  }

  async unBlacklistById(guildId: string, trackId: string): Promise<void> {
    const profile = await this.profileRepo.findOneBy({ guildId, trackId })
    if (profile) {
      profile.blacklisted = false
      await this.profileRepo.save(profile)
    }
  }

  async getAllBlacklisted(guildId: string): Promise<Track[]> {
    const profiles = await this.profileRepo.find({ where: { guildId, blacklisted: true }, select: ['trackId'] })
    const blacklistedIds = profiles.map((p) => p.trackId)
    return blacklistedIds.length ? this.repo.findBy({ id: In(blacklistedIds) }) : []
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repo.delete({ id })
    return result.affected !== 0
  }

  private formatTrack(track: Partial<Track> & Partial<GuildTrackProfile>, profile?: GuildTrackProfile): ExtendedTrack {
    return uncompressTrack({
      id: track.id,
      title: track.title,
      duration: track.duration,
      liveBroadcastContent: track.liveBroadcastContent,
      userPlayCount: (profile?.userPlayCount || track.userPlayCount) ?? 0,
      blacklisted: (profile?.blacklisted || track.blacklisted) ?? false,
      firstPlayedBy: profile?.firstPlayedBy || track.firstPlayedBy,
      lastPlayedAt: profile?.lastPlayedAt || track.lastPlayedAt,
      volume: profile?.volume || track.volume,
    })
  }
}
