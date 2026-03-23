const { GAME_TYPES, formatRelativeTime, getDefaultAvatar } = require('../../utils/util')
const { applyTheme } = require('../../utils/theme')
const api = require('../../utils/api')

Page({
  data: {
    theme: 'light',
    colors: {},
    userInfo: null,
    activeRooms: [],
    recentRooms: [],
    loading: true
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
    this.loadRooms().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  async loadRooms() {
    this.setData({ loading: true })
    try {
      const db = wx.cloud.database()
      const _ = db.command
      const openid = getApp().globalData.openid

      // 本地存储的房间ID列表
      const myRoomIds = wx.getStorageSync('myRoomIds') || []

      if (myRoomIds.length > 0) {
        const res = await db.collection('rooms')
          .where({ _id: _.in(myRoomIds) })
          .orderBy('updatedAt', 'desc')
          .limit(20)
          .get()

        const rooms = res.data.map(room => this.formatRoom(room))
        const activeRooms = rooms.filter(r => r.status === 'playing')
        const recentRooms = rooms.filter(r => r.status === 'settled').slice(0, 10)

        this.setData({ activeRooms, recentRooms })
      }
    } catch (e) {
      console.error('加载房间失败:', e)
      this.loadFromLocal()
    }
    this.setData({ loading: false })
  },

  loadFromLocal() {
    const rooms = wx.getStorageSync('localRooms') || []
    const activeRooms = rooms.filter(r => r.status === 'playing').map(r => this.formatRoom(r))
    const recentRooms = rooms.filter(r => r.status === 'settled').slice(0, 10).map(r => this.formatRoom(r))
    this.setData({ activeRooms, recentRooms })
  },

  formatRoom(room) {
    const gameInfo = GAME_TYPES[room.gameType] || GAME_TYPES.poker
    const players = (room.players || []).map((p, i) => ({
      ...p,
      color: getDefaultAvatar(i)
    }))

    return {
      ...room,
      gameIcon: gameInfo.icon,
      players,
      currentRound: (room.rounds || []).length,
      totalRounds: (room.rounds || []).length,
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
      wx.navigateTo({ url: `/pages/room/room?id=${room._id}` })
    } else {
      wx.navigateTo({ url: `/pages/settlement/settlement?id=${room._id}` })
    }
  },

  onViewHistory() {
    wx.switchTab({ url: '/pages/history/history' })
  },

  onTapAvatar() {
    wx.switchTab({ url: '/pages/profile/profile' })
  }
})
