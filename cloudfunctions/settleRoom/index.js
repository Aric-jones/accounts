const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { roomId } = event

  try {
    const room = await db.collection('rooms').doc(roomId).get()
    const { players, rounds = [], transactions = [] } = room.data

    const netScores = {}
    players.forEach(p => { netScores[p.id] = 0 })
    if (transactions.length > 0) {
      transactions.forEach(t => {
        if (netScores[t.from] !== undefined) netScores[t.from] -= t.amount
        if (netScores[t.to] !== undefined) netScores[t.to] += t.amount
      })
    } else {
      rounds.forEach(round => {
        Object.keys(round.scores || {}).forEach(pid => {
          if (netScores[pid] !== undefined) {
            netScores[pid] += round.scores[pid]
          }
        })
      })
    }

    let maxScore = -Infinity
    let winner = null
    players.filter(p => p.id !== '__tea__' && p.id !== '__table__').forEach(p => {
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
