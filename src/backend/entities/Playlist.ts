import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm'
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator'
import { User } from './User'
import { PlaylistTrack } from './PlaylistTrack'
import { Guild } from './Guild'
import { IsGuildIdRequired } from './validators/guildIdRequired'

@Entity('playlists')
export class Playlist {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ name: 'user_id', type: 'varchar' })
  @IsNotEmpty()
  @IsString()
  userId: string

  @Column({ name: 'guild_id', type: 'varchar', nullable: true })
  @IsOptional()
  @IsString()
  @IsGuildIdRequired()
  guildId?: string

  @Column({ type: 'varchar', nullable: true })
  @IsOptional()
  @IsString()
  name?: string

  @Column({ type: 'boolean', default: false })
  @IsOptional()
  @IsBoolean()
  public?: boolean

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt?: Date

  @Column({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt?: Date

  @Column({ type: 'boolean', default: true })
  @IsOptional()
  @IsBoolean()
  deletable?: boolean

  @ManyToOne(() => User, (user) => user.playlists, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User

  @ManyToOne(() => Guild, (guild) => guild.playlists, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'guild_id' })
  @IsGuildIdRequired()
  guild?: Guild

  @OneToMany(() => PlaylistTrack, (playlistTrack) => playlistTrack.playlist)
  tracks: PlaylistTrack[]
}
