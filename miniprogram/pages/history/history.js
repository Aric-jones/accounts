const { GAME_TYPES, formatTime, getDefaultAvatar } = require('../../utils/util')
const { calculateNetScores, generateRankings, findWinner } = require('../../utils/settlement')
const { applyTheme } = require('../../utils/theme')

Page({
  data: {
    theme: 'light',
    colors: {},
    historyList: [],
    activeFilter: 'all',
    stats: {
      totalGames: 0,
      totalRounds: 0,
      totalScore: 0
    },
    allRooms: []
  },

  onLoad() {
    applyTheme(this)
  },

  onShow() {
    applyTheme(this)
    this.loadHistory()
  },

  onPullDownRefresh() {
    this.loadHistory().then(() => wx.stopPullDownRefresh())
  },

  async loadHistory() {
    const localRooms = wx.getStorageSync('localRooms') || []
    const settledRooms = localRooms
      .filter(r => r.status === 'settled')
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))

    const formatted = settledRooms.map(room => this.formatHistoryRoom(room))

    let totalRounds = 0
    let totalScore = 0
    settledRooms.forEach(room => {
      totalRounds += (room.rounds || []).length
    })

    this.setData({
      allRooms: formatted,
      historyList: formatted,
      stats: {
        totalGames: settledRooms.length,
        totalRounds,
        totalScore
      }
    })
  },

  formatHistoryRoom(room) {
    const gameInfo = GAME_TYPES[room.gameType] || GAME_TYPES.poker
    const players = (room.players || []).map((p, i) => ({
      ...p,
      color: getDefaultAvatar(i)
    }))
    const netScores = calculateNetScores(room.rounds || [], players)
    const rankings = generateRankings(netScores, players)
    const winner = findWinner(netScores, players)

    return {
      ...room,
      gameIcon: gameInfo.icon,
      dateStr: formatTime(new Date(room.updatedAt || room.createdAt)),
      totalRounds: (room.rounds || []).length,
      rankings,
      winner
    }
  },

  onFilter(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ activeFilter: type })

    if (type === 'all') {
      this.setData({ historyList: this.data.allRooms })
    } else {
      const filtered = this.data.allRooms.filter(r => r.gameType === type)
      this.setData({ historyList: filtered })
    }
  },

  onTapHistory(e) {
    const room = e.currentTarget.dataset.room
    wx.navigateTo({ url: `/pages/settlement/settlement?id=${room._id}` })
  }
})
