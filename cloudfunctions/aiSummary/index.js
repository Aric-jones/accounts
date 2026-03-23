const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// DeepSeek API配置（需替换为实际API Key）
const DEEPSEEK_API_KEY = 'YOUR_DEEPSEEK_API_KEY'
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

exports.main = async (event, context) => {
  const { roomData } = event

  try {
    const { players, rounds, gameType, rankings } = roomData
    const totalRounds = rounds.length
    const gameNames = {
      mahjong: '麻将', guandan: '掼蛋', doudizhu: '斗地主',
      paodekuai: '跑得快', poker: '扑克'
    }
    const gameName = gameNames[gameType] || '牌局'

    const playerSummary = rankings.map((p, i) => {
      return `${i + 1}. ${p.nickname}: ${p.totalScore > 0 ? '+' : ''}${p.totalScore}分`
    }).join('\n')

    const prompt = `你是一个幽默风趣的牌局解说员。请为以下${gameName}牌局生成一段有趣的总结（100字以内）：

牌局信息：
- 玩法：${gameName}
- 总共：${totalRounds}局
- 排名：
${playerSummary}

要求：
1. 语气轻松幽默，适合朋友间分享
2. 夸奖赢家但不忘安慰输家
3. 可以用一些网络热梗
4. 不要使用markdown格式
5. 控制在100字以内`

    const response = await cloud.callContainer({
      config: { env: cloud.DYNAMIC_CURRENT_ENV },
      path: '/api/ai-summary',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { prompt }
    }).catch(async () => {
      // 如果容器调用失败，尝试直接调用DeepSeek API
      const https = require('https')
      return callDeepSeek(prompt)
    })

    if (response && response.data && response.data.summary) {
      return { code: 0, summary: response.data.summary }
    }

    // 兜底方案：使用本地模板
    return { code: 0, summary: generateFallbackSummary(rankings, gameName, totalRounds) }
  } catch (e) {
    console.error('AI摘要生成失败:', e)
    return { code: 0, summary: generateFallbackSummary(
      event.roomData?.rankings || [],
      '牌局',
      event.roomData?.rounds?.length || 0
    )}
  }
}

async function callDeepSeek(prompt) {
  if (DEEPSEEK_API_KEY === 'YOUR_DEEPSEEK_API_KEY') {
    return null
  }

  const https = require('https')
  const data = JSON.stringify({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0.8
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.deepseek.com',
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      }
    }, (res) => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          const summary = json.choices?.[0]?.message?.content || ''
          resolve({ data: { summary } })
        } catch (e) {
          reject(e)
        }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function generateFallbackSummary(rankings, gameName, totalRounds) {
  if (!rankings || rankings.length === 0) return '精彩的牌局！'
  const winner = rankings[0]
  const loser = rankings[rankings.length - 1]
  const templates = [
    `${totalRounds}局${gameName}大战落幕！${winner.nickname}以${winner.totalScore}分封王，${loser.nickname}默默表示下次一定赢回来！`,
    `今晚${gameName}局精彩绝伦，${winner.nickname}笑到最后！${loser.nickname}已在暗中谋划复仇之路...`,
    `恭喜${winner.nickname}以${winner.totalScore}分的成绩称霸今晚${gameName}桌！全场最佳非你莫属！`
  ]
  return templates[Math.floor(Math.random() * templates.length)]
}
