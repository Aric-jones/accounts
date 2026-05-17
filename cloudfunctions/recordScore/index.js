const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { roomId, roundScores, action, room = {} } = event

  try {
    if (action === 'saveRoom') {
      await db.collection('rooms').doc(roomId).update({
        data: {
          players: room.players || [],
          transactions: room.transactions || [],
          teaFeePercent: room.teaFeePercent || 0,
          teaCollectMode: room.teaCollectMode || 'immediate',
          lastTeaCollectIdx: room.lastTeaCollectIdx || 0,
          status: room.status || 'playing',
          winner: room.winner || null,
          settledAt: room.settledAt || null,
          updatedAt: room.updatedAt || new Date()
        }
      })
      return { code: 0, data: { message: '已保存' } }
    }

    if (action === 'undo') {
      await db.collection('rooms').doc(roomId).update({
        data: {
          rounds: _.pop(),
          updatedAt: new Date()
        }
      })
      return { code: 0, data: { message: '已撤销' } }
    }

    const roundNum = Date.now()
    const newRound = {
      roundNum,
      scores: roundScores,
      timestamp: new Date()
    }

    await db.collection('rooms').doc(roomId).update({
      data: {
        rounds: _.push(newRound),
        updatedAt: new Date()
      }
    })

    return { code: 0, data: { roundNum } }
  } catch (e) {
    return { code: -1, errMsg: e.message }
  }
}
