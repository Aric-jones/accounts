const { GAME_TYPES, formatRelativeTime, getDefaultAvatar, getClientId } = require('../../utils/util')
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

  async loadRooms() {
    this.setData({ loading: true })
    const localRooms = wx.getStorageSync('localRooms') || []
    const roomPlayerIds = wx.getStorageSync('roomPlayerIds') || {}
    const myRoomIds = wx.getStorageSync('myRoomIds') || []
    const app = getApp()
    let openid = app.globalData.openid || ''
    if (!openid && wx.cloud) {
      try {
        const res = await wx.cloud.callFunction({ name: 'getHistory', data: { action: 'getOpenid' } })
        openid = (res.result && res.result.openid) || ''
        if (openid) app.globalData.openid = openid
      } catch (err) {
        console.warn('get openid for active rooms failed', err)
      }
    }
    const clientId = getClientId()
    const localRoomMap = {}

    localRooms.forEach(room => {
      if (room && room._id) localRoomMap[room._id] = room
    })

    const isMyRoom = room => {
      if (!room || !room._id) return false
      if (roomPlayerIds[room._id] || myRoomIds.includes(room._id)) return true
      if (openid && room.createdBy === openid) return true
      return (room.players || []).some(player => {
        if (openid && player.openid === openid) return true
        return clientId && player.clientId === clientId
      })
    }

    const isActiveMyRoom = room => {
      if (!room || room.status !== 'playing') return false
      const localRoom = localRoomMap[room._id]
      if (localRoom && localRoom.status !== 'playing') return false
      return isMyRoom(room) || isMyRoom(localRoom)
    }

    const pickLatestRoom = room => {
      const localRoom = localRoomMap[room._id]
      const cloudTime = new Date(room.updatedAt || room.createdAt || 0).getTime()
      const localTime = localRoom ? new Date(localRoom.updatedAt || localRoom.createdAt || 0).getTime() : 0
      return localRoom && localTime > cloudTime ? localRoom : room
    }

    const buildActiveRooms = cloudRooms => {
      const roomMap = {}
      ;(cloudRooms || []).forEach(room => {
        if (isActiveMyRoom(room)) roomMap[room._id] = pickLatestRoom(room)
      })
      localRooms.forEach(room => {
        if (isActiveMyRoom(room) && !roomMap[room._id]) roomMap[room._id] = room
      })
      return Object.keys(roomMap)
        .map(id => roomMap[id])
        .filter(room => room.status === 'playing')
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .map(room => this.formatRoom(room))
    }

    const db = wx.cloud.database()
    const _ = db.command
    const queries = []
    if (openid) {
      queries.push(db.collection('rooms').where({
        status: 'playing',
        createdBy: openid
      }).get())
      queries.push(db.collection('rooms').where({
        status: 'playing',
        players: _.elemMatch({ openid })
      }).get())
    }
    if (clientId) {
      queries.push(db.collection('rooms').where({
        status: 'playing',
        players: _.elemMatch({ clientId })
      }).get())
    }

    Promise.all(queries).then(results => {
      const cloudRooms = []
      results.forEach(res => {
        cloudRooms.push(...(res.data || []))
      })
      this.setData({ activeRooms: buildActiveRooms(cloudRooms), loading: false })
    }).catch(err => {
      console.error('load active rooms failed', err)
      this.setData({ activeRooms: buildActiveRooms([]), loading: false })
    })
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
