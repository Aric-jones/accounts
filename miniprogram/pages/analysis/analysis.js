const { getDefaultAvatar } = require('../../utils/util')
const { calculateNetScores, calculateStats } = require('../../utils/settlement')
const { calculateLuckIndex, getPlayerStyle } = require('../../utils/ai')
const { applyTheme } = require('../../utils/theme')

Page({
  data: {
    theme: 'light',
    colors: {},
    aiGreeting: '正在分析你的牌局数据...',
    luckIndex: 50,
    luckLabel: '一般',
    luckComment: '再多打几局，AI才能更准确地分析你的运势哦~',
    trendData: [],
    wins: 0,
    losses: 0,
    winRate: 0,
    styleLabel: '数据不足',
    styleIcon: '🎴',
    dimensions: [],
    partners: [],
    fortuneStars: '⭐⭐⭐',
    fortuneText: '',
    fortuneTip: '',
    fullReportUnlocked: false
  },

  onLoad() {
    applyTheme(this)
  },

  onShow() {
    applyTheme(this)
    this.analyzeData()
  },

  analyzeData() {
    const localRooms = wx.getStorageSync('localRooms') || []
    const settledRooms = localRooms.filter(r => r.status === 'settled')

    if (settledRooms.length === 0) {
      this.setData({
        aiGreeting: '还没有牌局数据，开一桌试试吧！',
        luckIndex: 50,
        luckLabel: '待评估',
        dimensions: [
          { name: '运气', value: 50 },
          { name: '稳定', value: 50 },
          { name: '激进', value: 50 },
          { name: '社交', value: 50 },
          { name: '技术', value: 50 }
        ]
      })
      this.generateFortune()
      return
    }

    let totalWins = 0
    let totalLosses = 0
    let totalRounds = 0
    let maxWinStreak = 0
    const trendData = []
    const partnerMap = {}

    const myId = this.getMyPlayerId(settledRooms)

    settledRooms.slice(0, 10).forEach((room, roomIdx) => {
      const players = room.players || []
      const netScores = calculateNetScores(room.rounds || [], players)
      const myPlayer = players.find(p => p.id === myId) || players[0]

      if (myPlayer) {
        const myScore = netScores[myPlayer.id] || 0
        if (myScore > 0) totalWins++
        else if (myScore < 0) totalLosses++
        totalRounds += (room.rounds || []).length

        trendData.push({
          value: myScore,
          label: `第${settledRooms.length - roomIdx}局`,
          height: Math.min(Math.abs(myScore) * 2, 120)
        })

        players.forEach(p => {
          if (p.id !== myPlayer.id) {
            if (!partnerMap[p.nickname]) {
              partnerMap[p.nickname] = { games: 0, wins: 0 }
            }
            partnerMap[p.nickname].games++
            if (myScore > 0) partnerMap[p.nickname].wins++
          }
        })
      }
    })

    const winRate = settledRooms.length > 0
      ? Math.round((totalWins / settledRooms.length) * 100)
      : 0

    const luckIndex = Math.max(0, Math.min(100, Math.round(winRate * 0.8 + Math.random() * 20)))
    let luckLabel = '一般'
    if (luckIndex >= 80) luckLabel = '爆棚🔥'
    else if (luckIndex >= 60) luckLabel = '不错'
    else if (luckIndex >= 40) luckLabel = '一般'
    else luckLabel = '蓄力中'

    const luckComments = [
      luckIndex >= 70 ? '你最近手气不错，继续保持！' : '坚持就是胜利，下次一定行！',
      `近${settledRooms.length}场牌局，胜率${winRate}%`,
    ]

    const aggressive = Math.min(100, Math.round(totalWins / Math.max(1, settledRooms.length) * 100))
    const stable = Math.min(100, 100 - Math.abs(totalWins - totalLosses) * 10)
    const luck = luckIndex
    const social = Math.min(100, Object.keys(partnerMap).length * 25)
    const tech = Math.min(100, Math.round(winRate * 1.2))

    const partners = Object.entries(partnerMap)
      .map(([name, data], i) => ({
        name,
        games: data.games,
        winRate: data.games > 0 ? Math.round((data.wins / data.games) * 100) : 0,
        color: getDefaultAvatar(i + 1)
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 5)

    let styleLabel = '均衡型'
    let styleIcon = '⚖️'
    if (aggressive > 70) { styleLabel = '激进型'; styleIcon = '🔥' }
    else if (stable > 70) { styleLabel = '稳健型'; styleIcon = '🛡️' }
    else if (luck > 70) { styleLabel = '运气型'; styleIcon = '🍀' }
    else if (social > 70) { styleLabel = '社交型'; styleIcon = '🎉' }

    const totalGames = settledRooms.length
    const greetings = [
      `你已经打了${totalGames}场牌局，胜率${winRate}%！`,
      `${winRate >= 50 ? '你是牌桌上的高手' : '再接再厉'}，AI为你详细分析：`,
    ]

    this.setData({
      aiGreeting: greetings.join(''),
      luckIndex,
      luckLabel,
      luckComment: luckComments.join(' '),
      trendData: trendData.reverse(),
      wins: totalWins,
      losses: totalLosses,
      winRate,
      styleLabel,
      styleIcon,
      dimensions: [
        { name: '运气', value: luck },
        { name: '稳定', value: stable },
        { name: '激进', value: aggressive },
        { name: '社交', value: social },
        { name: '技术', value: tech }
      ],
      partners
    })

    this.generateFortune()
    this.drawLuckRing(luckIndex)
  },

  getMyPlayerId(rooms) {
    if (rooms.length > 0 && rooms[0].players && rooms[0].players.length > 0) {
      return rooms[0].players[0].id
    }
    return ''
  },

  drawLuckRing(index) {
    const ctx = wx.createCanvasContext('luckCanvas')
    const centerX = 75
    const centerY = 75
    const radius = 60
    const lineWidth = 12

    ctx.setLineWidth(lineWidth)
    ctx.setStrokeStyle('#E8E8E0')
    ctx.setLineCap('round')
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, Math.PI * 1.5)
    ctx.stroke()

    const endAngle = -Math.PI / 2 + (Math.PI * 2 * index / 100)
    const gradient = ctx.createLinearGradient(0, 0, 150, 150)
    gradient.addColorStop(0, '#1A6B4A')
    gradient.addColorStop(1, '#2E8B63')
    ctx.setLineWidth(lineWidth)
    ctx.setStrokeStyle(gradient)
    ctx.setLineCap('round')
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, -Math.PI / 2, endAngle)
    ctx.stroke()

    ctx.draw()
  },

  generateFortune() {
    const fortunes = [
      { stars: '⭐⭐⭐⭐⭐', text: '今日牌运大吉！', tip: '宜打牌、宜社交、宜加注' },
      { stars: '⭐⭐⭐⭐', text: '今日手气不错', tip: '稳中求胜，切忌冒进' },
      { stars: '⭐⭐⭐', text: '今日运势平平', tip: '小打小闹即可，见好就收' },
      { stars: '⭐⭐', text: '今日宜谨慎', tip: '不宜豪赌，适合观战学习' },
      { stars: '⭐⭐⭐⭐', text: '今日逢赌必赢？', tip: '相信自己，放手一搏' }
    ]
    const today = new Date().getDate()
    const fortune = fortunes[today % fortunes.length]

    this.setData({
      fortuneStars: fortune.stars,
      fortuneText: fortune.text,
      fortuneTip: fortune.tip
    })
  },

  onShareLuck() {
    wx.showToast({ title: '分享功能开发中', icon: 'none' })
  },

  onShareFortune() {
    wx.showToast({ title: '分享功能开发中', icon: 'none' })
  },

  onUnlockFullReport() {
    if (wx.createRewardedVideoAd) {
      const ad = wx.createRewardedVideoAd({ adUnitId: 'YOUR_REWARDED_AD_ID' })
      ad.show().catch(() => {
        ad.load().then(() => ad.show())
      })
      ad.onClose((res) => {
        if (res && res.isEnded) {
          this.setData({ fullReportUnlocked: true })
          wx.showToast({ title: '已解锁完整报告！', icon: 'success' })
        }
      })
    } else {
      this.setData({ fullReportUnlocked: true })
      wx.showToast({ title: '当前环境不支持广告', icon: 'none' })
    }
  },

  onShareAppMessage() {
    return {
      title: `我的牌桌手气指数${this.data.luckIndex}分，来比比看！`,
      path: '/pages/index/index'
    }
  }
})
