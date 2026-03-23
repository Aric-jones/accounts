const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { name, gameType, players, unitPrice, shareCode } = event

  try {
    const now = new Date()
    const roomData = {
      name: name || '牌局',
      gameType: gameType || 'guandan',
      players: players || [],
      rounds: [],
      unitPrice: unitPrice || 1,
      status: 'playing',
      shareCode: shareCode || generateCode(),
      createdBy: wxContext.OPENID,
      createdAt: now,
      updatedAt: now
    }

    const res = await db.collection('rooms').add({ data: roomData })

    return {
      code: 0,
      data: { _id: res._id, ...roomData }
    }
  } catch (e) {
    return { code: -1, errMsg: e.message }
  }
}

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
