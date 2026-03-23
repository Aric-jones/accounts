const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { roomId, roundScores, action } = event

  try {
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
