import { NowPlayingEmbedState } from './helpers/embedHelpers'

type UpdateCallback = (state?: NowPlayingEmbedState) => Promise<void>

interface TimerState {
  startTime: number | null
  pausedAt: number | null
  totalPausedDuration: number
  elapsedTime: number
  updateInterval: number
  isUpdating: boolean
  timerId: NodeJS.Timeout | null
}

export class TimerManager {
  state: TimerState
  private updateCallback: UpdateCallback

  private responseDurations: number[] = [250, 250]
  private averageResponseTime = 250
  private maxSamples = 2

  constructor(updateInterval: number, updateCallback: UpdateCallback) {
    this.state = {
      startTime: null,
      pausedAt: null,
      totalPausedDuration: 0,
      elapsedTime: 0,
      updateInterval,
      isUpdating: false,
      timerId: null,
    }

    this.updateCallback = updateCallback
  }

  public startOrResume() {
    const now = Date.now()

    if (this.state.startTime === null) {
      this.state.startTime = now
      this.state.totalPausedDuration = 0
      this.state.elapsedTime = 0
    } else if (this.state.pausedAt !== null) {
      this.state.totalPausedDuration += now - this.state.pausedAt
      this.state.pausedAt = null
    } else {
      return
    }

    this.scheduleNextUpdate()
  }

  public pause() {
    if (this.state.pausedAt === null && this.state.startTime !== null) {
      this.state.pausedAt = Date.now()
    }
  }

  public stop() {
    const elapsedTime = this.state.elapsedTime
    if (this.state.timerId) {
      clearTimeout(this.state.timerId)
    }
    this.state = {
      ...this.state,
      timerId: null,
      isUpdating: false,
      startTime: null,
      pausedAt: null,
      elapsedTime: 0,
      totalPausedDuration: 0,
    }
    return elapsedTime
  }

  public getElapsedTime(): number {
    if (this.state.startTime === null) return 0
    const now = Date.now()
    const pausedDuration = this.state.pausedAt ? now - this.state.pausedAt : 0
    return Math.floor((now - this.state.startTime - this.state.totalPausedDuration - pausedDuration) / 1000)
  }

  private alignNextTick(now: number = Date.now()): number {
    this.state.elapsedTime = now - this.state.startTime - this.state.totalPausedDuration
    const intervals = Math.floor(this.state.elapsedTime / this.state.updateInterval) + 1
    return this.state.startTime + this.state.totalPausedDuration + intervals * this.state.updateInterval
  }

  private async scheduleNextUpdate() {
    const now = Date.now()
    let delay = Math.max(500, this.alignNextTick() - now)
    if (this.averageResponseTime > 2000) {
      delay = 5000
    }

    this.state.timerId = setTimeout(() => this.handleScheduledUpdate(), delay)
  }

  private async handleScheduledUpdate() {
    if (this.state.isUpdating || this.state.startTime === null || this.state.pausedAt !== null) {
      return
    }

    const currentTime = Date.now()

    this.state.isUpdating = true
    this.state.elapsedTime = currentTime - this.state.startTime - this.state.totalPausedDuration

    const before = Date.now()
    try {
      await this.updateCallback()
    } catch (err: any) {
      console.error('Update failed:', err.message)
    } finally {
      const after = Date.now()
      this.trackResponseDuration(after - before)
      this.state.isUpdating = false
      this.scheduleNextUpdate()
    }
  }

  private trackResponseDuration(duration: number) {
    this.responseDurations.push(duration)

    if (this.responseDurations.length > this.maxSamples) {
      this.responseDurations.shift()
    }

    this.averageResponseTime = this.responseDurations.reduce((sum, d) => sum + d, 0) / this.responseDurations.length
  }
}
