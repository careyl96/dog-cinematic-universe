import { DataSource } from 'typeorm'
import dotenv from 'dotenv'
import { User } from '../entities/User'
import { Track } from '../entities/Track'
import { UserHistory } from '../entities/UserHistory'
import { Playlist } from '../entities/Playlist'
import { PlaylistTrack } from '../entities/PlaylistTrack'
import { CachedTrack } from '../entities/CachedTrack'
import { Guild } from '../entities/Guild'
import { GuildTrackProfile } from '../entities/GuildTrackProfile'

dotenv.config()

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  synchronize: true, // ⚠️ for development only
  logging: false,
  entities: [User, Track, UserHistory, Playlist, PlaylistTrack, CachedTrack, Guild, GuildTrackProfile],
})
