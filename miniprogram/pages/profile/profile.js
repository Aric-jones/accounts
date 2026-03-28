const { showToast } = require('../../utils/util')
const { applyTheme } = require('../../utils/theme')
const { calculateNetScores } = require('../../utils/settlement')

Page({
  data: {
    theme: 'light',
    colors: {},
    userInfo: { nickName: '', avatarUrl: '' },
    stats: {
      totalGames: 0,
      totalTxns: 0,
      winRate: 0,
      totalScore: 0
    }
  },

  onLoad() {
    applyTheme(this)
    this.loadUserInfo()
    this.loadStats()
  },

  onShow() {
    applyTheme(this)
    this.loadStats()
  },

  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo') || { nickName: '', avatarUrl: '' }
    this.setData({ userInfo })
  },

  loadStats() {
    const localRooms = wx.getStorageSync('localRooms') || []
    const settledRooms = localRooms.filter(r => r.status === 'settled')

    let totalTxns = 0
    let totalWins = 0
    let totalScore = 0

    settledRooms.forEach(room => {
      totalTxns += (room.transactions || []).length
      const allPlayers = room.players || []
      const players = allPlayers.filter(p => p.id !== '__tea__' && p.id !== '__table__')
      if (players.length > 0) {
        const netScores = calculateNetScores(room.transactions || [], allPlayers)
        const myScore = netScores[players[0].id] || 0
        totalScore += myScore
        if (myScore > 0) totalWins++
      }
    })

    const winRate = settledRooms.length > 0
      ? Math.round((totalWins / settledRooms.length) * 100)
      : 0

    this.setData({
      stats: {
        totalGames: settledRooms.length,
        totalTxns,
        winRate,
        totalScore
      }
    })
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    const userInfo = { ...this.data.userInfo, avatarUrl }
    this.setData({ userInfo })
    wx.setStorageSync('userInfo', userInfo)
    getApp().globalData.userInfo = userInfo
    showToast('头像已更新')
  },

  onNicknameBlur(e) {
    const nickName = e.detail.value
    if (nickName) {
      const userInfo = { ...this.data.userInfo, nickName }
      this.setData({ userInfo })
      wx.setStorageSync('userInfo', userInfo)
      getApp().globalData.userInfo = userInfo
    }
  },

  onToggleTheme() {
    const app = getApp()
    const newTheme = app.toggleTheme()
    applyTheme(this)

    const pages = getCurrentPages()
    pages.forEach(page => {
      if (page.route !== this.route && typeof page.setData === 'function') {
        page.setData({ theme: newTheme })
      }
    })

    showToast(newTheme === 'dark' ? '已切换深色模式' : '已切换亮色模式')
  },

  onClearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '将清除所有本地牌局数据，此操作不可撤销。确定继续吗？',
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          this.setData({
            stats: { totalGames: 0, totalTxns: 0, winRate: 0, totalScore: 0 }
          })
          showToast('缓存已清除')
        }
      }
    })
  },

  onAbout() {
    wx.showModal({
      title: '关于牌记',
      content: '牌记 v1.0.0\n\nAI智能打牌记账小程序\n\n功能亮点：\n• 多人实时记分\n• AI智能结算\n• 趣味牌局分析\n• 一键分享战绩\n\n© 2026 牌记团队',
      showCancel: false
    })
  },

  onFeedback() {},

  onShare() {},

  onAdError(e) {
    console.warn('广告加载失败:', e.detail)
  },

  onShareAppMessage() {
    return {
      title: '牌记 - AI智能打牌记账，告别手动算账！',
      path: '/pages/index/index'
    }
  }
})
