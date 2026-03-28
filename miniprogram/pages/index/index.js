const { GAME_TYPES, formatRelativeTime, getDefaultAvatar } = require('../../utils/util')
const { applyTheme } = require('../../utils/theme')

Page({
  data: {
    theme: 'light',
    colors: {},
    userInfo: null,
    activeRooms: [],
    loading: false
  },

  onLoad() {
    applyTheme(this)
  },

  onShow() {
    applyTheme(this)
    const app = getApp()
    this.setData({ userInfo: app.globalData.userInfo })
    this.loadRooms()
  },

  onPullDownRefresh() {
    this.loadRooms()
    wx.stopPullDownRefresh()
  },

  loadRooms() {
    const rooms = wx.getStorageSync('localRooms') || []
    const activeRooms = rooms
      .filter(r => r.status === 'playing')
      .map(r => this.formatRoom(r))
    this.setData({ activeRooms })
  },

  formatRoom(room) {
    const gameInfo = GAME_TYPES[room.gameType] || GAME_TYPES.poker
    const players = (room.players || []).filter(p => p.id !== '__tea__' && p.id !== '__table__').map((p, i) => ({
      ...p,
      color: getDefaultAvatar(i)
    }))
    const txnCount = (room.transactions || []).length
    return {
      ...room,
      gameIcon: gameInfo.icon,
      players,
      txnCount,
      timeAgo: formatRelativeTime(new Date(room.updatedAt || room.createdAt)),
      winner: room.winner || null
    }
  },

  onCreateRoom() {
    wx.navigateTo({ url: '/pages/create/create' })
  },

  onJoinRoom() {
    wx.navigateTo({ url: '/pages/join/join' })
  },

  onEnterRoom(e) {
    const room = e.currentTarget.dataset.room
    if (room.status === 'playing') {
      wx.navigateTo({ url: '/pages/room/room?id=' + room._id })
    } else {
      wx.navigateTo({ url: '/pages/settlement/settlement?id=' + room._id })
    }
  },

  onViewHistory() {
    wx.switchTab({ url: '/pages/history/history' })
  },

  onTapAvatar() {
    wx.switchTab({ url: '/pages/profile/profile' })
  }
})
