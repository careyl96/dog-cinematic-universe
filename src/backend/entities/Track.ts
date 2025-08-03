import { Entity, PrimaryColumn, Column, OneToMany, OneToOne } from 'typeorm'
import { IsOptional, IsString, Matches } from 'class-validator'
import { UserHistory } from './UserHistory'
import { PlaylistTrack } from './PlaylistTrack'
import { CachedTrack } from './CachedTrack'
import { GuildTrackProfile } from './GuildTrackProfile'

@Entity('tracks')
export class Track {
  @PrimaryColumn({ type: 'varchar' })
  id: string

  @Column({ type: 'varchar', nullable: true })
  @IsOptional()
  @IsString()
  title?: string

  @Column({ type: 'varchar', nullable: true })
  @IsOptional()
  @Matches(/^P(T(\d+H)?(\d+M)?(\d+S)?)?$/, {
    message: 'Duration must be a valid ISO 8601 duration string',
  })
  duration?: string

  @Column({ name: 'live_broadcast_content', type: 'varchar', nullable: true })
  @IsOptional()
  @IsString()
  liveBroadcastContent?: string

  @OneToMany(() => UserHistory, (hist) => hist.track)
  history?: UserHistory[]

  @OneToMany(() => PlaylistTrack, (pt) => pt.track)
  playlistTracks?: PlaylistTrack[]

  @OneToOne(() => CachedTrack, (cachedTrack) => cachedTrack.track, {
    cascade: true,
  })
  cachedTrack?: CachedTrack

  @OneToMany(() => GuildTrackProfile, (profile) => profile.track)
  guildTrackProfiles?: GuildTrackProfile[]
}
