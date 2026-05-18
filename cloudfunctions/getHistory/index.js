const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const ROOM_EXPIRATION_MS = 24 * 60 * 60 * 1000

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, page = 1, pageSize = 20 } = event

  if (action === 'getOpenid') {
    return { code: 0, openid: wxContext.OPENID }
  }

  if (action === 'stats') {
    try {
      const res = await db.collection('rooms')
        .where({ createdBy: wxContext.OPENID, status: 'settled' })
        .count()
      return { code: 0, data: { totalGames: res.total } }
    } catch (e) {
      return { code: -1, errMsg: e.message }
    }
  }

  if (action === 'delete') {
    try {
      await db.collection('userHiddenRooms').add({
        data: {
          roomId: event.roomId,
          openid: wxContext.OPENID,
          hiddenAt: new Date()
        }
      })
      return { code: 0 }
    } catch (e) {
      return { code: -1, errMsg: e.message }
    }
  }

  if (action === 'clear') {
    try {
      const roomIds = event.roomIds || []
      await Promise.all(roomIds.map(roomId => db.collection('userHiddenRooms').add({
        data: {
          roomId,
          openid: wxContext.OPENID,
          hiddenAt: new Date()
        }
      })))
      return { code: 0 }
    } catch (e) {
      return { code: -1, errMsg: e.message }
    }
  }

  if (action === 'cleanupExpiredRooms') {
    try {
      const now = new Date()
      const cutoffDate = new Date(now.getTime() - ROOM_EXPIRATION_MS)
      const cutoffIso = cutoffDate.toISOString()
      const [dateRes, stringRes] = await Promise.all([
        db.collection('rooms')
          .where({ status: 'playing', createdAt: _.lt(cutoffDate) })
          .limit(100)
          .get(),
        db.collection('rooms')
          .where({ status: 'playing', createdAt: _.lt(cutoffIso) })
          .limit(100)
          .get()
      ])
      const roomMap = {}
      ;(dateRes.data || []).concat(stringRes.data || []).forEach(room => {
        if (room && room._id && isExpiredPlayingRoom(room, now.getTime())) roomMap[room._id] = room
      })
      const roomIds = Object.keys(roomMap)
      const results = await Promise.all(roomIds.map(roomId => db.collection('rooms').doc(roomId).remove()
        .then(() => ({ roomId, ok: true }))
        .catch(e => ({ roomId, ok: false, errMsg: e.message }))))
      return {
        code: 0,
        data: {
          roomIds: results.filter(item => item.ok).map(item => item.roomId),
          failed: results.filter(item => !item.ok)
        }
      }
    } catch (e) {
      return { code: -1, errMsg: e.message }
    }
  }

  if (action === 'myRooms') {
    try {
      const skip = (page - 1) * pageSize
      const res = await db.collection('rooms')
        .where(_.or([
          { createdBy: wxContext.OPENID },
          { players: _.elemMatch({ openid: wxContext.OPENID }) }
        ]))
        .orderBy('updatedAt', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
      return { code: 0, data: res.data || [] }
    } catch (e) {
      return { code: -1, errMsg: e.message }
    }
  }

  if (action === 'history') {
    try {
      const skip = (page - 1) * pageSize
      const hiddenRes = await db.collection('userHiddenRooms')
        .where({ openid: wxContext.OPENID })
        .get()
      const hiddenRoomIds = new Set((hiddenRes.data || []).map(item => item.roomId))
      const res = await db.collection('rooms')
        .where(_.or([
          { createdBy: wxContext.OPENID },
          { players: _.elemMatch({ openid: wxContext.OPENID }) }
        ]))
        .orderBy('updatedAt', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
      return { code: 0, data: (res.data || []).filter(room => !hiddenRoomIds.has(room._id)) }
    } catch (e) {
      return { code: -1, errMsg: e.message }
    }
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
