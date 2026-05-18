const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const ROOM_EXPIRATION_MS = 24 * 60 * 60 * 1000

exports.main = async (event, context) => {
  const { roomId } = event

  try {
    const res = await db.collection('rooms').doc(roomId).get()
    if (isExpiredPlayingRoom(res.data, Date.now())) {
      await db.collection('rooms').doc(roomId).remove().catch(() => null)
      return { code: -1, errMsg: 'room expired' }
    }
    return { code: 0, data: res.data }
  } catch (e) {
    return { code: -1, errMsg: e.message }
  }
}

function parseTime(value) {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const time = new Date(value).getTime()
    return Number.isNaN(time) ? 0 : time
  }
  if (value.$date) return parseTime(value.$date)
  if (value.seconds) return value.seconds * 1000
  if (value._seconds) return value._seconds * 1000
  return 0
}

function isExpiredPlayingRoom(room, now) {
  if (!room || room.status !== 'playing') return false
  const createdTime = parseTime(room.createdAt)
  return createdTime > 0 && now - createdTime >= ROOM_EXPIRATION_MS
}
