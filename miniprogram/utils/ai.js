/**
 * AI文案生成模块
 * 用于生成牌局趣味总结、玩家点评等AI文案
 */

const WINNER_TEMPLATES = [
  '{name}今晚手气爆棚，豪取{score}分，堪称牌桌之王！',
  '恭喜{name}以{score}分的绝对优势称霸牌桌！',
  '{name}今晚运势逆天，{score}分收官，请大家叫TA"牌神"！',
  '赢麻了！{name}狂揽{score}分，今晚的快乐源泉！',
  '{name}稳如老狗，{score}分轻松拿下，实力与运气并存！'
]

const LOSER_TEMPLATES = [
  '{name}今晚为大家的快乐"慷慨解囊"，下次一定翻盘！',
  '{name}表示不服，下次一定赢回来！加油！',
  '虽然{name}输了{score}分，但TA收获了友情（大概）',
  '{name}今晚"散财童子"已上线，期待下次逆袭！',
  '{name}：我不是输了，我是在战略性投资！'
]

const GAME_SUMMARY_TEMPLATES = [
  '本场{gameType}激战{rounds}局，{winner}以{score}分封王！{loser}表示下次再来！',
  '精彩绝伦！{rounds}局{gameType}大战落幕，{winner}笑到最后，{loser}已在谋划复仇！',
  '{gameType}之夜圆满结束！{rounds}局鏖战，{winner}实力夺冠，全场最佳！',
  '今晚{gameType}局战况激烈，{rounds}回合较量后，{winner}以{score}分的成绩胜出！'
]

const COMEBACK_TEMPLATES = [
  '逆风翻盘！{name}从落后{deficit}分到最终赢得{score}分，这就是不放弃的力量！',
  '{name}上演教科书级别的逆转！一度落后{deficit}分，最终反超登顶！'
]

const STREAK_TEMPLATES = [
  '{name}连赢{count}局，气势如虹！',
  '{name}豪取{count}连胜，对手们瑟瑟发抖...',
  '连胜王者{name}，{count}局全胜，今晚谁都挡不住！'
]

const LUCKY_COMMENTS = [
  '手气指数爆表🔥',
  '今日欧皇非你莫属✨',
  '财运亨通，挡都挡不住💰',
  '运气好到可以去买彩票了🎰',
  '牌桌锦鲤本鲤🐟'
]

const UNLUCKY_COMMENTS = [
  '今日宜静养，不宜上桌😅',
  '没关系，运气守恒定律说下次必赢💪',
  '越挫越勇，下次就是你的主场🔥',
  '先蓄力，下次一鸣惊人💥'
]

/**
 * 生成牌局AI摘要（本地版本，不调用API）
 */
const generateLocalSummary = (roomData) => {
  const { players, rounds, gameType, netScores, rankings } = roomData

  if (!rankings || rankings.length === 0) return '暂无数据'

  const winner = rankings[0]
  const loser = rankings[rankings.length - 1]
  const totalRounds = rounds.length
  const gameTypeName = getGameTypeName(gameType)

  const parts = []

  const summaryTemplate = randomPick(GAME_SUMMARY_TEMPLATES)
  parts.push(fillTemplate(summaryTemplate, {
    gameType: gameTypeName,
    rounds: totalRounds,
    winner: winner.nickname,
    loser: loser.nickname,
    score: Math.abs(winner.totalScore)
  }))

  const winnerComment = randomPick(WINNER_TEMPLATES)
  parts.push(fillTemplate(winnerComment, {
    name: winner.nickname,
    score: winner.totalScore
  }))

  let maxStreak = 0
  let streakPlayer = null
  players.forEach(p => {
    let streak = 0
    let maxS = 0
    rounds.forEach(r => {
      if (r.scores && r.scores[p.id] > 0) {
        streak++
        maxS = Math.max(maxS, streak)
      } else {
        streak = 0
      }
    })
    if (maxS > maxStreak) {
      maxStreak = maxS
      streakPlayer = p
    }
  })

  if (maxStreak >= 3 && streakPlayer) {
    const streakComment = randomPick(STREAK_TEMPLATES)
    parts.push(fillTemplate(streakComment, {
      name: streakPlayer.nickname,
      count: maxStreak
    }))
  }

  return parts.join('\n\n')
}

/**
 * 调用云函数生成AI摘要（DeepSeek API版本）
 */
const generateAISummary = async (roomData) => {
  try {
    const res = await wx.cloud.callFunction({
      name: 'aiSummary',
      data: { roomData }
    })
    if (res.result && res.result.summary) {
      return res.result.summary
    }
    return generateLocalSummary(roomData)
  } catch (e) {
    console.warn('AI摘要生成失败，使用本地版本', e)
    return generateLocalSummary(roomData)
  }
}

/**
 * 生成玩家点评
 */
const generatePlayerComment = (player, stats, rank, totalPlayers) => {
  if (rank === 0) {
    return randomPick(LUCKY_COMMENTS)
  }
  if (rank === totalPlayers - 1 && stats.totalScore < 0) {
    return randomPick(UNLUCKY_COMMENTS)
  }
  if (stats.winStreak >= 3) {
    return `连赢${stats.winStreak}局，势不可挡！`
  }
  if (stats.wins > stats.losses) {
    return '稳扎稳打，发挥不错！'
  }
  return '下次加油，期待翻盘！'
}

/**
 * 生成手气指数 (0-100)
 */
const calculateLuckIndex = (stats, totalRounds) => {
  if (totalRounds === 0) return 50
  const winRate = stats.wins / totalRounds
  const streakBonus = Math.min(stats.winStreak * 5, 20)
  const index = Math.round(winRate * 80 + streakBonus)
  return Math.max(0, Math.min(100, index))
}

/**
 * 生成玩家风格标签
 */
const getPlayerStyle = (stats, totalRounds) => {
  if (totalRounds < 3) return { label: '新手上路', type: 'neutral' }

  const winRate = stats.wins / totalRounds
  const hasHighVariance = Math.abs(stats.maxWin) > 100 || Math.abs(stats.maxLoss) > 100

  if (winRate > 0.6 && stats.winStreak >= 3) return { label: '运势爆棚', type: 'hot' }
  if (winRate > 0.5 && !hasHighVariance) return { label: '稳健玩家', type: 'stable' }
  if (hasHighVariance) return { label: '大起大落', type: 'volatile' }
  if (winRate < 0.3) return { label: '蓄力待发', type: 'charging' }
  return { label: '中规中矩', type: 'neutral' }
}

function getGameTypeName(type) {
  const names = {
    mahjong: '麻将', guandan: '掼蛋', doudizhu: '斗地主',
    paodekuai: '跑得快', poker: '扑克'
  }
  return names[type] || '牌局'
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function fillTemplate(template, data) {
  let result = template
  Object.keys(data).forEach(key => {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), data[key])
  })
  return result
}

module.exports = {
  generateLocalSummary,
  generateAISummary,
  generatePlayerComment,
  calculateLuckIndex,
  getPlayerStyle
}
