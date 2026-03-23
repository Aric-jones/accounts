/**
 * AI最优转账方案算法
 * 使用贪心算法计算最少转账次数，使所有人结清账目
 */

/**
 * 计算每个玩家的净输赢
 * @param {Array} rounds - 每局记录 [{scores: {playerId: score}}]
 * @param {Array} players - 玩家列表
 * @returns {Object} 每个玩家的净得分 {playerId: netScore}
 */
const calculateNetScores = (rounds, players) => {
  const netScores = {}
  players.forEach(p => {
    netScores[p.id] = 0
  })

  rounds.forEach(round => {
    if (round.scores) {
      Object.keys(round.scores).forEach(playerId => {
        if (netScores[playerId] !== undefined) {
          netScores[playerId] += round.scores[playerId]
        }
      })
    }
  })

  return netScores
}

/**
 * 计算最优转账方案（最少转账次数）
 * 使用贪心算法：每次让最大债务人向最大债权人转账
 * @param {Object} netScores - {playerId: netScore}
 * @param {Array} players - 玩家列表
 * @param {Number} unitPrice - 每分对应金额（默认1）
 * @returns {Array} 转账方案 [{from, to, amount}]
 */
const calculateOptimalTransfers = (netScores, players, unitPrice = 1) => {
  const balances = []
  const playerMap = {}

  players.forEach(p => {
    playerMap[p.id] = p
    const balance = (netScores[p.id] || 0) * unitPrice
    if (Math.abs(balance) > 0.001) {
      balances.push({ id: p.id, balance: balance })
    }
  })

  const transfers = []
  const debtors = balances.filter(b => b.balance < 0).sort((a, b) => a.balance - b.balance)
  const creditors = balances.filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance)

  let i = 0, j = 0

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]
    const creditor = creditors[j]
    const amount = Math.min(-debtor.balance, creditor.balance)

    if (amount > 0.001) {
      transfers.push({
        from: {
          id: debtor.id,
          nickname: playerMap[debtor.id]?.nickname || '未知',
          avatarUrl: playerMap[debtor.id]?.avatarUrl || ''
        },
        to: {
          id: creditor.id,
          nickname: playerMap[creditor.id]?.nickname || '未知',
          avatarUrl: playerMap[creditor.id]?.avatarUrl || ''
        },
        amount: Math.round(amount * 100) / 100
      })
    }

    debtor.balance += amount
    creditor.balance -= amount

    if (Math.abs(debtor.balance) < 0.001) i++
    if (Math.abs(creditor.balance) < 0.001) j++
  }

  return transfers
}

/**
 * 生成排行榜
 * @param {Object} netScores - {playerId: netScore}
 * @param {Array} players - 玩家列表
 * @returns {Array} 排名列表
 */
const generateRankings = (netScores, players) => {
  return players.map(p => ({
    ...p,
    totalScore: netScores[p.id] || 0
  })).sort((a, b) => b.totalScore - a.totalScore)
}

/**
 * 计算统计数据
 */
const calculateStats = (rounds, players) => {
  const stats = {}

  players.forEach(p => {
    stats[p.id] = {
      totalScore: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      maxWin: 0,
      maxLoss: 0,
      winStreak: 0,
      currentStreak: 0
    }
  })

  rounds.forEach(round => {
    if (!round.scores) return
    const scores = round.scores

    players.forEach(p => {
      const score = scores[p.id] || 0
      const stat = stats[p.id]
      stat.totalScore += score

      if (score > 0) {
        stat.wins++
        stat.currentStreak = Math.max(0, stat.currentStreak) + 1
        stat.maxWin = Math.max(stat.maxWin, score)
      } else if (score < 0) {
        stat.losses++
        stat.currentStreak = Math.min(0, stat.currentStreak) - 1
        stat.maxLoss = Math.min(stat.maxLoss, score)
      } else {
        stat.draws++
        stat.currentStreak = 0
      }
      stat.winStreak = Math.max(stat.winStreak, stat.currentStreak)
    })
  })

  return stats
}

/**
 * 找出赢家
 */
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
