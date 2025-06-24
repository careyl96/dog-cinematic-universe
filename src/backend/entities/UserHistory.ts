import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { IsNotEmpty, IsInt, IsOptional, Min, IsString } from 'class-validator'
import { User } from './User'
import { Track } from './Track'
import { Guild } from './Guild'

@Entity('user_history')
export class UserHistory {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'user_id', type: 'varchar' })
  userId: string

  @Column({ name: 'track_id', type: 'varchar' })
  @IsString()
  @IsNotEmpty()
  trackId: string

  @Column({
    name: 'played_at',
    type: 'timestamptz',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  @IsOptional()
  playedAt?: Date

  @Column({ name: 'guild_id', type: 'varchar' })
  @IsString()
  @IsNotEmpty()
  guildId: string

  @ManyToOne(() => User, (user) => user.history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @ManyToOne(() => Track, (track) => track.history, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'track_id' })
  track: Track

  @ManyToOne(() => Guild, (guild) => guild.userHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guild_id' })
  guild: Guild
}
