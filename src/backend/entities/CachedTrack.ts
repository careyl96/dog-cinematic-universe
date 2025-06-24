import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm'
import { IsDate, IsNotEmpty } from 'class-validator'
import { Track } from './Track'

@Entity('cached_tracks')
export class CachedTrack {
  @PrimaryColumn({ type: 'varchar' })
  id: string

  @OneToOne(() => Track, (track) => track.cachedTrack, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id' })
  track: Track

  @Column({
    name: 'cached_at',
    type: 'timestamptz',
    nullable: true,
  })
  @IsDate()
  cachedAt?: Date

  @Column({
    name: 'last_pulled_at',
    type: 'timestamptz',
    nullable: true,
  })
  @IsDate()
  lastPulledAt?: Date

  @Column({ type: 'bytea' }) // stores .ogg data
  @IsNotEmpty()
  data: Buffer
}
