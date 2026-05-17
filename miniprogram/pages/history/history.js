const { GAME_TYPES, formatTime, getDefaultAvatar, resolveCloudFileUrls, shouldRenderAvatar } = require('../../utils/util')
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
    this.avatarUrlMap = {}
  },

  onShow() {
    applyTheme(this)
    this.loadHistory()
  },

  onPullDownRefresh() {
    this.loadHistory().then(() => wx.stopPullDownRefresh())
  },

  async loadHistory() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getHistory',
        data: { action: 'history', page: 1, pageSize: 100 }
      })
      const cloudRooms = (res.result && res.result.data) || []
      const localRooms = wx.getStorageSync('localRooms') || []
      const hiddenRoomIds = wx.getStorageSync('hiddenHistoryRoomIds') || []
      const hiddenMap = {}
      hiddenRoomIds.forEach(id => { hiddenMap[id] = true })
      const roomMap = {}
      cloudRooms.concat(localRooms).forEach(room => {
        if (!room || !room._id) return
        if (hiddenMap[room._id]) return
        roomMap[room._id] = {
          ...(roomMap[room._id] || {}),
          ...room
        }
      })
      const settledRooms = Object.values(roomMap)
        .filter(r => r.status === 'settled')
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))

      this.resolveHistoryAvatarUrls(settledRooms)
      const formatted = settledRooms.map(room => this.formatHistoryRoom(room))

      let totalTxns = 0
      settledRooms.forEach(room => {
        totalTxns += (room.transactions || []).length
      })

      this.setData({
        allRooms: formatted,
        historyList: formatted,
        stats: {
          totalGames: settledRooms.length,
          totalTxns,
          totalScore: 0
        }
      })
    } catch (err) {
      console.error('加载历史失败', err)
    }
  },

  formatHistoryRoom(room) {
    const gameInfo = GAME_TYPES[room.gameType] || GAME_TYPES.poker
    const allPlayers = (room.players || []).map((p, i) => {
      const displayAvatarUrl = this.getDisplayAvatarUrl(p.avatarUrl)
      return {
        ...p,
        displayAvatarUrl,
        hasDisplayAvatar: shouldRenderAvatar(p.avatarUrl, displayAvatarUrl),
        color: p.avatarColor || getDefaultAvatar(i)
      }
    })
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

  getDisplayAvatarUrl(avatarUrl) {
    if (!avatarUrl) return ''
    return (this.avatarUrlMap && this.avatarUrlMap[avatarUrl]) || avatarUrl
  },

  resolveHistoryAvatarUrls(rooms) {
    const urls = []
    ;(rooms || []).forEach(room => {
      ;(room.players || []).forEach(player => {
        if (player.avatarUrl && player.avatarUrl.startsWith('cloud://') && !(this.avatarUrlMap && this.avatarUrlMap[player.avatarUrl])) {
          urls.push(player.avatarUrl)
        }
      })
    })
    if (urls.length === 0) return
    resolveCloudFileUrls(urls).then(map => {
      if (!map || Object.keys(map).length === 0) return
      this.avatarUrlMap = { ...(this.avatarUrlMap || {}), ...map }
      this.loadHistory()
    }).catch(err => {
      console.warn('resolve history avatar urls failed', err)
    })
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
        wx.cloud.callFunction({
          name: 'getHistory',
          data: { action: 'delete', roomId }
        }).then(() => {
          const hidden = wx.getStorageSync('hiddenHistoryRoomIds') || []
          if (!hidden.includes(roomId)) {
            hidden.push(roomId)
            wx.setStorageSync('hiddenHistoryRoomIds', hidden)
          }
          this.loadHistory()
          wx.showToast({ title: '已删除', icon: 'success' })
        }).catch(() => {
          wx.showToast({ title: '删除失败', icon: 'none' })
        })
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
        const roomIds = this.data.allRooms.map(room => room._id)
        wx.cloud.callFunction({
          name: 'getHistory',
          data: { action: 'clear', roomIds }
        }).finally(() => {
          const hidden = wx.getStorageSync('hiddenHistoryRoomIds') || []
          roomIds.forEach(id => {
            if (!hidden.includes(id)) hidden.push(id)
          })
          wx.setStorageSync('hiddenHistoryRoomIds', hidden)
          this.loadHistory()
        })
        wx.showToast({ title: '已清空', icon: 'success' })
      }
    })
  }
})
