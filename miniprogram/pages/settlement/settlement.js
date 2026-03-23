const { GAME_TYPES, getDefaultAvatar, showToast } = require('../../utils/util')
const { calculateNetScores, calculateOptimalTransfers, generateRankings, findWinner, calculateStats } = require('../../utils/settlement')
const { generateLocalSummary, generateAISummary, generatePlayerComment } = require('../../utils/ai')
const { applyTheme } = require('../../utils/theme')

Page({
  data: {
    theme: 'light',
    colors: {},
    room: null,
    winner: null,
    rankings: [],
    transfers: [],
    totalRounds: 0,
    unitPrice: 1,
    aiSummary: '',
    showAd: false,
    adUnitId: ''
  },

  onLoad(options) {
    applyTheme(this)
    if (options.id) {
      this.loadSettlement(options.id)
    }
  },

  async loadSettlement(roomId) {
    try {
      const localRooms = wx.getStorageSync('localRooms') || []
      let room = localRooms.find(r => r._id === roomId)

      try {
        const db = wx.cloud.database()
        const res = await db.collection('rooms').doc(roomId).get()
        if (res.data) room = res.data
      } catch (e) {}

      if (!room) {
        showToast('房间不存在')
        return
      }

      const players = room.players.map((p, i) => ({
        ...p,
        color: getDefaultAvatar(i)
      }))

      const netScores = calculateNetScores(room.rounds || [], players)
      const rankings = generateRankings(netScores, players)
      const winner = findWinner(netScores, players)
      const unitPrice = room.unitPrice || 1
      const transfers = calculateOptimalTransfers(netScores, players, unitPrice)

      transfers.forEach(t => {
        const fromPlayer = players.find(p => p.id === t.from.id)
        const toPlayer = players.find(p => p.id === t.to.id)
        if (fromPlayer) t.from.color = fromPlayer.color
        if (toPlayer) t.to.color = toPlayer.color
      })

      if (winner) {
        const wp = players.find(p => p.id === winner.id)
        if (wp) winner.color = wp.color
      }

      const gameInfo = GAME_TYPES[room.gameType] || GAME_TYPES.poker

      // Pre-compute display values (WXML cannot call JS methods like .toFixed)
      const rankingsDisplay = rankings.map(r => ({
        ...r,
        scorePrefix: r.totalScore > 0 ? '+' : '',
        amountText: (r.totalScore > 0 ? '+' : '') + (Math.round(r.totalScore * unitPrice * 10) / 10)
      }))

      this.setData({
        room: { ...room, gameTypeName: gameInfo.name },
        winner,
        rankings: rankingsDisplay,
        transfers,
        totalRounds: (room.rounds || []).length,
        unitPrice
      })

      this.generateSummary(room, players, netScores, rankings)
    } catch (e) {
      console.error('加载结算失败:', e)
      showToast('加载失败')
    }
  },

  async generateSummary(room, players, netScores, rankings) {
    const roomData = {
      players,
      rounds: room.rounds || [],
      gameType: room.gameType,
      netScores,
      rankings
    }

    const localSummary = generateLocalSummary(roomData)
    this.setData({ aiSummary: localSummary })

    try {
      const aiSummary = await generateAISummary(roomData)
      if (aiSummary && aiSummary !== localSummary) {
        this.setData({ aiSummary })
      }
    } catch (e) {}
  },

  onSharePoster() {
    wx.navigateTo({
      url: `/pages/settlement/settlement?id=${this.data.room._id}&showPoster=1`,
      fail: () => {
        this.onShareAppMessage()
      }
    })
    showToast('海报生成功能开发中')
  },

  onPlayAgain() {
    wx.redirectTo({ url: '/pages/create/create' })
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onShareAppMessage() {
    const { room, winner, totalRounds } = this.data
    return {
      title: `${room.name}结算：${winner ? winner.nickname + '获胜！' : ''}共${totalRounds}局`,
      path: `/pages/settlement/settlement?id=${room._id}`
    }
  }
})
