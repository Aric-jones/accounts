const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { shareCode } = event

  try {
    const res = await db.collection('rooms')
      .where({ shareCode, status: 'playing' })
      .get()

    if (res.data.length === 0) {
      return { code: -1, errMsg: '房间不存在或已结算' }
    }

    const room = res.data[0]
    return { code: 0, data: room }
  } catch (e) {
    return { code: -1, errMsg: e.message }
  }
}
