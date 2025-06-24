import { FormattedYoutubeVideo } from './helpers/youtubeHelpers/youtubeHelpers'

type UserStatePlaylist = {
  id: string | null
  selectedTracks: string[]
  collectors: any[]
}

type UserStateQueueManager = {
  totalPages: number
  currentPage: number
  collector: any
}

export class UserState {
  interaction: any | null = null
  selectedVideo: FormattedYoutubeVideo | null = null
  selectedPlaylistIds: string[] | null = null
  private _playlist: UserStatePlaylist = {
    id: null as string | null,
    selectedTracks: [] as string[],
    collectors: [] as any[],
  }
  private _queueManager: UserStateQueueManager = {
    totalPages: 1,
    currentPage: 0,
    collector: null as any,
  }
  textContent: string = ''

  constructor(initialState?: Partial<UserState>) {
    Object.assign(this, initialState)

    if (initialState?.playlist) this.playlist = initialState.playlist
    if (initialState?.queueManager) this.queueManager = initialState.queueManager
  }

  cleanup() {
    this._playlist.collectors.forEach((collector) => {
      collector.stop()
    })
    this._queueManager.collector?.stop()
  }

  get playlist() {
    return this._playlist
  }
  set playlist(value: Partial<UserState['_playlist']>) {
    this._playlist = {
      ...this._playlist,
      ...value,
    }
  }

  get queueManager() {
    return this._queueManager
  }
  set queueManager(value: Partial<UserState['_queueManager']>) {
    this._queueManager = {
      ...this._queueManager,
      ...value,
    }
  }
}
