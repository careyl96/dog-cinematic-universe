import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm'
import { UserHistory } from './UserHistory'
import { Playlist } from './Playlist'
import { GuildTrackProfile } from './GuildTrackProfile' // import this

@Entity('guilds')
export class Guild {
  @PrimaryColumn({ type: 'varchar' })
  id: string

  @Column({ name: 'name', type: 'varchar' })
  name: string

  @Column({ name: 'music_bot_channel', type: 'varchar', nullable: true })
  musicBotTextChannel?: string

  @OneToMany(() => UserHistory, (history) => history.guild)
  userHistory?: UserHistory[]

  @OneToMany(() => Playlist, (playlist) => playlist.guild)
  playlists?: Playlist[]

  // Add this inverse relation for guildTrackProfiles:
  @OneToMany(() => GuildTrackProfile, (profile) => profile.guild)
  guildTrackProfiles?: GuildTrackProfile[]
}
