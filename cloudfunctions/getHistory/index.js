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
      await db.collection('rooms').doc(event.roomId).remove()
      return { code: 0 }
    } catch (e) {
      return { code: -1, errMsg: e.message }
    }
  }

  if (action === 'history') {
    try {
      const skip = (page - 1) * pageSize
      const res = await db.collection('rooms')
        .where({ createdBy: wxContext.OPENID })
        .orderBy('updatedAt', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
      return { code: 0, data: res.data }
    } catch (e) {
      return { code: -1, errMsg: e.message }
    }
  }
}
