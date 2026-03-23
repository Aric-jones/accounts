const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { roomId } = event

  try {
    const room = await db.collection('rooms').doc(roomId).get()
    const { players, rounds } = room.data

    const netScores = {}
    players.forEach(p => { netScores[p.id] = 0 })
    rounds.forEach(round => {
      Object.keys(round.scores || {}).forEach(pid => {
        if (netScores[pid] !== undefined) {
          netScores[pid] += round.scores[pid]
        }
      })
    })

    let maxScore = -Infinity
    let winner = null
    players.forEach(p => {
      if (netScores[p.id] > maxScore) {
        maxScore = netScores[p.id]
        winner = { id: p.id, nickname: p.nickname, totalScore: maxScore }
      }
    })

    await db.collection('rooms').doc(roomId).update({
      data: {
        status: 'settled',
        winner,
        netScores,
        settledAt: new Date(),
        updatedAt: new Date()
      }
    })

    return { code: 0, data: { winner, netScores } }
  } catch (e) {
    return { code: -1, errMsg: e.message }
  }
}
