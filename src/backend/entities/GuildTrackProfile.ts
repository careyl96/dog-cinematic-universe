import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { IsBoolean, IsDate, IsOptional, IsString, Min } from 'class-validator'
import { Track } from './Track'
import { Guild } from './Guild'

@Entity('guild_track_profiles')
export class GuildTrackProfile {
  @PrimaryColumn({ name: 'guild_id', type: 'varchar' })
  guildId: string

  @PrimaryColumn({ name: 'track_id', type: 'varchar' })
  trackId: string

  @Column({ name: 'user_play_count', type: 'int', default: 0 })
  @IsOptional()
  @Min(0)
  userPlayCount?: number

  @Column({ type: 'boolean', default: false })
  @IsOptional()
  @IsBoolean()
  blacklisted?: boolean

  @Column({ name: 'first_played_by', type: 'varchar', nullable: true })
  @IsOptional()
  @IsString()
  firstPlayedBy?: string

  @Column({ name: 'last_played_at', type: 'timestamptz', nullable: true })
  @IsOptional()
  @IsDate()
  lastPlayedAt?: Date

  @Column({ type: 'int', nullable: true })
  @IsOptional()
  @Min(0)
  volume?: number

  @ManyToOne(() => Track, (track) => track.guildTrackProfiles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'track_id' })
  track?: Track

  @ManyToOne(() => Guild, (guild) => guild.guildTrackProfiles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guild_id' })
  guild?: Guild
}
