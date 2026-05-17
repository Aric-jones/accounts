const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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

  if (action === 'history') {
    try {
      const skip = (page - 1) * pageSize
      const _ = db.command
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
