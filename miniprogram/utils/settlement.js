/**
 * 结算工具
 * 支持两种数据格式：
 *   1. transactions: [{from, to, amount}] — 直接支付模式（新）
 *   2. rounds: [{scores: {playerId: netScore}}] — 按局模式（旧，兼容）
 */

const calculateNetScores = (data, players) => {
  const net = {}
  players.forEach(p => { net[p.id] = 0 })

  if (!Array.isArray(data) || data.length === 0) return net

  if (data[0].from !== undefined && data[0].to !== undefined) {
    data.forEach(t => {
      if (net[t.from] !== undefined) net[t.from] -= t.amount
      if (net[t.to] !== undefined) net[t.to] += t.amount
    })
  } else {
    data.forEach(round => {
      if (!round.scores) return
      Object.keys(round.scores).forEach(pid => {
        if (net[pid] !== undefined) net[pid] += round.scores[pid]
      })
    })
  }

  return net
}

const calculateOptimalTransfers = (netScores, players, unitPrice = 1) => {
  const balances = []
  const playerMap = {}

  players.forEach(p => {
    playerMap[p.id] = p
    const balance = (netScores[p.id] || 0) * unitPrice
    if (Math.abs(balance) > 0.001) {
      balances.push({ id: p.id, balance })
    }
  })

  const transfers = []
  const debtors = balances.filter(b => b.balance < 0).sort((a, b) => a.balance - b.balance)
  const creditors = balances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance)

  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i], c = creditors[j]
    const amount = Math.min(-d.balance, c.balance)

    if (amount > 0.001) {
      transfers.push({
        from: {
          id: d.id,
          nickname: playerMap[d.id]?.nickname || '未知',
          avatarUrl: playerMap[d.id]?.avatarUrl || ''
        },
        to: {
          id: c.id,
          nickname: playerMap[c.id]?.nickname || '未知',
          avatarUrl: playerMap[c.id]?.avatarUrl || ''
        },
        amount: Math.round(amount * 100) / 100
      })
    }

    d.balance += amount
    c.balance -= amount
    if (Math.abs(d.balance) < 0.001) i++
    if (Math.abs(c.balance) < 0.001) j++
  }

  return transfers
}

const generateRankings = (netScores, players) => {
  return players.map(p => ({
    ...p,
    totalScore: netScores[p.id] || 0
  })).sort((a, b) => b.totalScore - a.totalScore)
}

const calculateStats = (transactions, players) => {
  const stats = {}
  players.forEach(p => {
    stats[p.id] = { totalScore: 0, wins: 0, losses: 0, maxWin: 0, maxLoss: 0 }
  })

  transactions.forEach(t => {
    if (stats[t.to]) {
      stats[t.to].totalScore += t.amount
      stats[t.to].wins++
      stats[t.to].maxWin = Math.max(stats[t.to].maxWin, t.amount)
    }
    if (stats[t.from]) {
      stats[t.from].totalScore -= t.amount
      stats[t.from].losses++
      stats[t.from].maxLoss = Math.min(stats[t.from].maxLoss, -t.amount)
    }
  })

  return stats
}

const findWinner = (netScores, players) => {
  let maxScore = -Infinity
  let winner = null
  players.forEach(p => {
    const score = netScores[p.id] || 0
    if (score > maxScore) {
      maxScore = score
      winner = { ...p, totalScore: score }
    }
  })
  return winner
}

module.exports = {
  calculateNetScores,
  calculateOptimalTransfers,
  generateRankings,
  calculateStats,
  findWinner
}
