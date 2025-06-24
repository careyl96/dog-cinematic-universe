import { GuildController } from './GuildController'
import { CachedTrackController } from './CachedTrackController'
import { PlaylistController } from './PlaylistController'
import { TrackController } from './TrackController'
import { UserController } from './UserController'
import { UserHistoryController } from './UserHistoryController'

export const guildCtrl = new GuildController()
export const cachedTrackCtrl = new CachedTrackController()
export const playlistCtrl = new PlaylistController()
export const trackCtrl = new TrackController()
export const userCtrl = new UserController()
export const userHistoryCtrl = new UserHistoryController()
