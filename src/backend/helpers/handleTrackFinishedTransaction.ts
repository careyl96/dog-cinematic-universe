import { UserController } from '../controllers/UserController'
import { TrackController } from '../controllers/TrackController'
import { UserHistoryController } from '../controllers/UserHistoryController'
import { AppDataSource } from '../db/data-source'
import { BOT_USER_ID } from '../../constants'

export const handleTrackFinishedTransaction = async ({
  userId,
  guildId,
  trackData,
  startTimestamp,
}: {
  userId: string
  guildId: string
  trackData: Track
  startTimestamp: number
}) => {
  return await AppDataSource.manager.transaction(async (manager) => {
    const userCtrl = new UserController(manager)
    const trackCtrl = new TrackController(manager)
    const historyCtrl = new UserHistoryController(manager)

    // 1. Find or create user
    let user = await userCtrl.getById(userId)
    if (!user) {
      user = await userCtrl.upsert(userId)
    }

    const existingTrack = await trackCtrl.getById(trackData.id)

    let track = existingTrack

    // 2. Only update track stats if user is not a bot
    if (user.id !== BOT_USER_ID) {
      const updatedTrackData = {
        ...trackData,
        lastPlayedAt: new Date(startTimestamp),
        firstPlayedBy: existingTrack?.firstPlayedBy || userId,
        playCount: (existingTrack?.userPlayCount ?? 0) + 1,
      }

      track = await trackCtrl.upsert(updatedTrackData)
    }

    // 3. Always log history
    const userHistory = await historyCtrl.logUserTrackPlay({
      userId: user.id,
      guildId,
      trackId: trackData.id,
      playedAt: new Date(startTimestamp),
    })

    return {
      user,
      track,
      userHistory,
    }
  })
}
