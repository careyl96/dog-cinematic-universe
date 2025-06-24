import { UserState } from './UserState'

export class UserStateManager {
  private userStates: Map<string, UserState>

  constructor() {
    this.userStates = new Map()
  }

  get(userId: string): UserState {
    let state = this.userStates.get(userId)

    if (!state) {
      state = new UserState()
      this.userStates.set(userId, state)
    }

    return state
  }

  clearUserState(userId: string) {
    const userState = this.userStates.get(userId)
    if (!userState) return

    userState.cleanup()
    this.userStates.delete(userId)
  }
}
