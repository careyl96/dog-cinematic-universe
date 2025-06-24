import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm'
import { IsOptional, IsInt, Min, IsString } from 'class-validator'
import { Playlist } from './Playlist'
import { Track } from './Track'

@Entity('playlist_tracks')
export class PlaylistTrack {
  @PrimaryColumn({ name: 'playlist_id', type: 'int' })
  playlistId: number

  @PrimaryColumn({ name: 'track_id', type: 'varchar' })
  @IsString()
  trackId: string

  @Column({ type: 'int', nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number

  @Column({
    name: 'added_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  addedAt?: Date

  @ManyToOne(() => Playlist, (playlist) => playlist.tracks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlist_id' })
  playlist: Playlist

  @ManyToOne(() => Track, (track) => track.playlistTracks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'track_id' })
  track: Track
}
