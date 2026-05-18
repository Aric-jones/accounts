const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const ROOM_EXPIRATION_MS = 24 * 60 * 60 * 1000

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { shareCode, player = {} } = event

  try {
    const res = await db.collection('rooms')
      .where({ shareCode, status: 'playing' })
      .get()

    const rooms = res.data || []
    const now = Date.now()
    const expiredRooms = rooms.filter(room => isExpiredPlayingRoom(room, now))
    if (expiredRooms.length > 0) {
      await Promise.all(expiredRooms.map(room => db.collection('rooms').doc(room._id).remove().catch(() => null)))
    }
    const validRooms = rooms.filter(room => !isExpiredPlayingRoom(room, now))

    if (validRooms.length === 0) {
      return { code: -1, errMsg: 'room not found, settled, or expired' }
    }

    const room = validRooms[0]
    const players = room.players || []
    let currentPlayer = null

    if (wxContext.OPENID) {
      currentPlayer = players.find(p => p.openid === wxContext.OPENID)
    }
    if (!currentPlayer && player.clientId) {
      currentPlayer = players.find(p => p.clientId === player.clientId)
    }

    let shouldUpdatePlayers = false

    if (!currentPlayer) {
      currentPlayer = {
        id: player.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`,
        nickname: player.nickname || `牌友${players.filter(p => p.id !== '__tea__' && p.id !== '__table__' && !p.isTea && !p.isTable).length + 1}`,
        avatarUrl: player.avatarUrl || '',
        clientId: player.clientId || '',
        openid: wxContext.OPENID || player.openid || '',
        isCreator: false
      }
      players.push(currentPlayer)
      shouldUpdatePlayers = true
    } else {
      if (player.nickname && currentPlayer.nickname !== player.nickname) {
        currentPlayer.nickname = player.nickname
        shouldUpdatePlayers = true
      }
      if (player.avatarUrl && currentPlayer.avatarUrl !== player.avatarUrl) {
        currentPlayer.avatarUrl = player.avatarUrl
        shouldUpdatePlayers = true
      }
      if (player.clientId && currentPlayer.clientId !== player.clientId) {
        currentPlayer.clientId = player.clientId
        shouldUpdatePlayers = true
      }
      if ((wxContext.OPENID || player.openid) && currentPlayer.openid !== (wxContext.OPENID || player.openid)) {
        currentPlayer.openid = wxContext.OPENID || player.openid
        shouldUpdatePlayers = true
      }
    }

    if (shouldUpdatePlayers) {
      const updatedAt = new Date()
      await db.collection('rooms').doc(room._id).update({
        data: {
          players,
          updatedAt
        }
      })
      room.players = players
      room.updatedAt = updatedAt
    }

    return { code: 0, data: room, myPlayerId: currentPlayer.id }
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
