import { ExtendedTrack } from './EmbedManager'

type UserStatePlaylist = {
  id: string | null
  selectedTracks: string[]
  allTracks: ExtendedTrack[]
  collectors: any[]
}

type UserStateQueueEmbedManager = {
  totalPages: number
  currentPage: number
  collector: any
}

export class UserState {
  interaction: any | null = null
  selectedVideo: ExtendedTrack | null = null
  selectedPlaylistIds: string[] | null = null
  private _playlist: UserStatePlaylist = {
    id: null,
    selectedTracks: [],
    allTracks: [],
    collectors: [],
  }
  private _queueManager: UserStateQueueEmbedManager = {
    totalPages: 1,
    currentPage: 0,
    collector: null as any,
  }
  textContent: string = ''
  queuedTracks: ExtendedTrack[]
  interactionWithIds: any = {}

  constructor(initialState?: Partial<UserState>) {
    Object.assign(this, initialState)

    if (initialState?.playlist) this.playlist = initialState.playlist
    if (initialState?.queueManager) this.queueManager = initialState.queueManager
  }

  // doesn't really work as intended, but good enough for now. The intention for this logic
  // is to be able to keep track of which tracks were queued so we can undo them with a button click
  // but it's unable to track the interaction if multiple of the same track is queued.
  // functionally, clicking undo will still remove the track from the queue, but embed won't disappear
  addQueueInteraction({ videoId, interaction }: { videoId: string; interaction: any }) {
    if (this.interactionWithIds[videoId]) {
      const randomId = '-' + randomIdGenerator()
      this.interactionWithIds[`${videoId + randomId}`] = interaction
    } else {
      this.interactionWithIds[videoId] = interaction
    }
  }

  async clearInteraction(interactionId?: string) {
    if (this.interactionWithIds[interactionId]) {
      try {
        const interaction = this.interactionWithIds[interactionId]
        await interaction.deleteReply()
        delete this.interactionWithIds[interactionId]
      } catch {
        console.error('invalid interaction')
      }
    } else {
      try {
        await this.interaction.deleteReply()
      } catch {
        console.error('invalid interaction')
      }
    }
  }

  cleanup() {
    this._playlist.collectors.forEach((collector) => {
      collector.stop()
    })
    this._queueManager.collector?.stop()
    this.queuedTracks = []
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

const randomIdGenerator = (length = 10) =>
  Math.random()
    .toString(36)
    .substring(2, 2 + length)
