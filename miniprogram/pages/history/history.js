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
      totalTxns: 0,
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

    let totalTxns = 0
    let totalScore = 0
    settledRooms.forEach(room => {
      totalTxns += (room.transactions || []).length
    })

    this.setData({
      allRooms: formatted,
      historyList: formatted,
      stats: {
        totalGames: settledRooms.length,
        totalTxns,
        totalScore
      }
    })
  },

  formatHistoryRoom(room) {
    const gameInfo = GAME_TYPES[room.gameType] || GAME_TYPES.poker
    const allPlayers = (room.players || []).map((p, i) => ({
      ...p,
      color: p.avatarColor || getDefaultAvatar(i)
    }))
    const players = allPlayers.filter(p => p.id !== '__tea__' && p.id !== '__table__')
    const scoreData = room.transactions || room.rounds || []
    const netScores = calculateNetScores(scoreData, allPlayers)
    const rankings = generateRankings(netScores, players)
    const winner = findWinner(netScores, players)
    const count = room.transactions ? room.transactions.length : (room.rounds || []).length

    return {
      ...room,
      gameIcon: gameInfo.icon,
      dateStr: formatTime(new Date(room.updatedAt || room.createdAt)),
      txnCount: count,
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
  },

  onDeleteHistory(e) {
    const roomId = e.currentTarget.dataset.id
    const room = this.data.allRooms.find(r => r._id === roomId)
    wx.showModal({
      title: '删除记录',
      content: '确定删除「' + (room ? room.name : '') + '」？不可恢复。',
      confirmColor: '#EF4444',
      success: (res) => {
        if (!res.confirm) return
        const localRooms = wx.getStorageSync('localRooms') || []
        const updated = localRooms.filter(r => r._id !== roomId)
        wx.setStorageSync('localRooms', updated)
        this.loadHistory()
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  },

  onClearAllHistory() {
    wx.showModal({
      title: '清空全部历史',
      content: '确定清空所有已结算的牌局记录？不可恢复！',
      confirmColor: '#EF4444',
      success: (res) => {
        if (!res.confirm) return
        const localRooms = wx.getStorageSync('localRooms') || []
        const kept = localRooms.filter(r => r.status !== 'settled')
        wx.setStorageSync('localRooms', kept)
        this.loadHistory()
        wx.showToast({ title: '已清空', icon: 'success' })
      }
    })
  }
})
