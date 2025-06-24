import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm'
import { UserHistory } from './UserHistory'
import { Playlist } from './Playlist'

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'varchar' })
  id: string

  @Column({ type: 'varchar', nullable: true })
  username?: string

  @Column({
    name: 'created_at',
    type: 'timestamptz',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt?: Date

  @OneToMany(() => UserHistory, (hist) => hist.user)
  history: UserHistory[]

  @OneToMany(() => Playlist, (playlist) => playlist.user)
  playlists: Playlist[]
}
