const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { roomId } = event

  try {
    const res = await db.collection('rooms').doc(roomId).get()
    return { code: 0, data: res.data }
  } catch (e) {
    return { code: -1, errMsg: e.message }
  }
}
