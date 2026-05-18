const ROOM_EXPIRATION_HOURS = 24
const ROOM_EXPIRATION_MS = ROOM_EXPIRATION_HOURS * 60 * 60 * 1000

const parseTime = value => {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const time = new Date(value).getTime()
    return Number.isNaN(time) ? 0 : time
  }
  if (typeof value.toDate === 'function') {
    const time = value.toDate().getTime()
    return Number.isNaN(time) ? 0 : time
  }
  if (value.$date) return parseTime(value.$date)
  if (value.seconds) return value.seconds * 1000
  if (value._seconds) return value._seconds * 1000
  return 0
}

const getCreatedTime = room => parseTime(room && room.createdAt)

const isExpiredPlayingRoom = (room, now = Date.now()) => {
  if (!room || room.status !== 'playing') return false
  const createdTime = getCreatedTime(room)
  return createdTime > 0 && now - createdTime >= ROOM_EXPIRATION_MS
}

const removeRoomReferences = roomIds => {
  const ids = [...new Set((roomIds || []).filter(Boolean))]
  if (ids.length === 0) return []
  const idSet = new Set(ids)

  const localRooms = wx.getStorageSync('localRooms') || []
  const keptRooms = localRooms.filter(room => !room || !idSet.has(room._id))
  if (keptRooms.length !== localRooms.length) wx.setStorageSync('localRooms', keptRooms)

  const roomPlayerIds = wx.getStorageSync('roomPlayerIds') || {}
  let changedPlayerIds = false
  ids.forEach(id => {
    if (Object.prototype.hasOwnProperty.call(roomPlayerIds, id)) {
      delete roomPlayerIds[id]
      changedPlayerIds = true
    }
  })
  if (changedPlayerIds) wx.setStorageSync('roomPlayerIds', roomPlayerIds)

  const myRoomIds = wx.getStorageSync('myRoomIds') || []
  const keptMyRoomIds = myRoomIds.filter(id => !idSet.has(id))
  if (keptMyRoomIds.length !== myRoomIds.length) wx.setStorageSync('myRoomIds', keptMyRoomIds)

  return ids
}

const pruneExpiredLocalRooms = (now = Date.now()) => {
  const localRooms = wx.getStorageSync('localRooms') || []
  const expiredIds = localRooms
    .filter(room => isExpiredPlayingRoom(room, now))
    .map(room => room._id)
    .filter(Boolean)
  removeRoomReferences(expiredIds)
  return expiredIds
}

const cleanupExpiredPlayingRooms = async (options = {}) => {
  const localExpiredIds = pruneExpiredLocalRooms()
  if (options.cloud === false || !wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    return { localExpiredIds, cloudExpiredIds: [] }
  }

  try {
    const res = await wx.cloud.callFunction({
      name: 'getHistory',
      data: { action: 'cleanupExpiredRooms' }
    })
    const cloudExpiredIds = ((res.result && res.result.data && res.result.data.roomIds) || [])
      .filter(Boolean)
    removeRoomReferences(cloudExpiredIds)
    return { localExpiredIds, cloudExpiredIds }
  } catch (err) {
    console.warn('cleanup expired rooms failed', err)
    return { localExpiredIds, cloudExpiredIds: [], error: err }
  }
}

module.exports = {
  ROOM_EXPIRATION_HOURS,
  ROOM_EXPIRATION_MS,
  isExpiredPlayingRoom,
  removeRoomReferences,
  pruneExpiredLocalRooms,
  cleanupExpiredPlayingRooms
}
