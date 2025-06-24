import { Entity, PrimaryColumn, Column, OneToMany, OneToOne } from 'typeorm'
import { IsDate, IsNotEmpty, IsOptional, IsString, Matches, Min } from 'class-validator'
import { UserHistory } from './UserHistory'
import { PlaylistTrack } from './PlaylistTrack'
import { CachedTrack } from './CachedTrack'

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

  @Column({ name: 'user_play_count', type: 'int', default: 0 })
  @IsOptional()
  @Min(0)
  userPlayCount?: number

  @Column({
    name: 'last_played_at',
    type: 'timestamptz',
    nullable: true,
  })
  @IsOptional()
  @IsDate()
  lastPlayedAt?: Date

  @Column({ name: 'first_played_by', type: 'varchar', nullable: true })
  @IsOptional()
  @IsString()
  firstPlayedBy?: string

  @Column({ name: 'blacklisted', type: 'boolean', default: false })
  blacklisted?: boolean

  @OneToMany(() => UserHistory, (hist) => hist.track)
  history?: UserHistory[]

  @OneToMany(() => PlaylistTrack, (pt) => pt.track)
  playlistTracks?: PlaylistTrack[]

  @OneToOne(() => CachedTrack, (cachedTrack) => cachedTrack.track, {
    cascade: true,
  })
  cachedTrack?: CachedTrack
}
