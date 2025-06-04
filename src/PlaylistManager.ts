import { FormattedYoutubeVideo } from './helpers/youtubeHelpers/youtubeFormatterHelpers'

interface UserState {
  interaction: any | null
  video: FormattedYoutubeVideo | null
  selectedPlaylistIds: string[] | null
  playlistId: string | null
  selectedTracks: string[]
  collector: any
  text: string
}

const defaultUserState: UserState = {
  interaction: null,
  video: null,
  selectedPlaylistIds: [],
  playlistId: null,
  selectedTracks: [],
  collector: null,
  text: '',
}

export class PlaylistManager {
  private userStates: Map<string, any>

  constructor() {
    this.userStates = new Map()
  }

  setUserState(userId: string, state: Partial<UserState>) {
    const existingState = this.userStates.get(userId) || defaultUserState

    // Merge state and set new timeout
    this.userStates.set(userId, {
      ...existingState,
      ...state,
    } as UserState)
  }

  getUserState(userId: string): UserState {
    return this.userStates.get(userId) || defaultUserState
  }

  clearUserState(userId: string) {
    const state = this.userStates.get(userId)
    if (state?.timeout) {
      clearTimeout(state.timeout)
    }
    this.userStates.delete(userId)
  }
}
