const { GAME_TYPES, formatRelativeTime, getDefaultAvatar, getClientId, resolveCloudFileUrls, shouldRenderAvatar } = require('../../utils/util')
const { applyTheme } = require('../../utils/theme')
const { cleanupExpiredPlayingRooms, isExpiredPlayingRoom, removeRoomReferences } = require('../../utils/room-expiration')

Page({
  data: {
    theme: 'light',
    colors: {},
    userInfo: null,
    userDisplayAvatarUrl: '',
    activeRooms: [],
    loading: false
  },

  onLoad() {
    applyTheme(this)
    this.avatarUrlMap = {}
  },

  onShow() {
    applyTheme(this)
    const app = getApp()
    const userInfo = app.globalData.userInfo
    this.setData({ userInfo })
    this.resolveUserAvatar(userInfo)
    this.loadRooms()
  },

  onPullDownRefresh() {
    this.loadRooms()
    wx.stopPullDownRefresh()
  },

  async loadRooms() {
    this.setData({ loading: true })
    await cleanupExpiredPlayingRooms()
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
      if (isExpiredPlayingRoom(room)) return false
      const localRoom = localRoomMap[room._id]
      if (localRoom && localRoom.status !== 'playing') return false
      if (localRoom && isExpiredPlayingRoom(localRoom)) return false
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
      const cloudRoomMap = {}
      ;(cloudRooms || []).forEach(room => {
        if (room && room._id) cloudRoomMap[room._id] = room
        if (isActiveMyRoom(room)) roomMap[room._id] = pickLatestRoom(room)
      })
      localRooms.forEach(room => {
        if (cloudRoomMap[room._id] && cloudRoomMap[room._id].status !== 'playing') return
        if (isActiveMyRoom(room) && !roomMap[room._id]) roomMap[room._id] = room
      })
      return Object.keys(roomMap)
        .map(id => roomMap[id])
        .filter(room => room.status === 'playing')
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .map(room => this.formatRoom(room))
    }

    if (openid && wx.cloud && typeof wx.cloud.callFunction === 'function') {
      try {
        const res = await wx.cloud.callFunction({
          name: 'getHistory',
          data: { action: 'myRooms', page: 1, pageSize: 100 }
        })
        const cloudRooms = (res.result && res.result.data) || []
        this.setData({ activeRooms: buildActiveRooms(cloudRooms), loading: false })
        return
      } catch (err) {
        console.warn('load my rooms via cloud function failed, fallback to db queries', err)
      }
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
    if (!openid && clientId) {
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

  resolveUserAvatar(userInfo) {
    const avatarUrl = userInfo && userInfo.avatarUrl
    const avatarFileId = userInfo && userInfo.avatarFileId
    if (avatarFileId) {
      const cached = this.avatarUrlMap && this.avatarUrlMap[avatarFileId]
      if (cached) {
        this.setData({ userDisplayAvatarUrl: cached })
        return
      }
      this.setData({ userDisplayAvatarUrl: '' })
      resolveCloudFileUrls([avatarFileId]).then(map => {
        const displayUrl = map && map[avatarFileId]
        if (!displayUrl) return
        this.avatarUrlMap = { ...(this.avatarUrlMap || {}), ...map }
        const nextUserInfo = { ...(this.data.userInfo || {}), avatarUrl: displayUrl, avatarFileId }
        wx.setStorageSync('userInfo', nextUserInfo)
        getApp().globalData.userInfo = nextUserInfo
        this.setData({ userInfo: nextUserInfo, userDisplayAvatarUrl: displayUrl })
      }).catch(err => console.warn('resolve index avatar failed', err))
      return
    }
    if (!avatarUrl) {
      this.setData({ userDisplayAvatarUrl: '' })
      return
    }
    if (avatarUrl.startsWith('cloud://')) {
      const cached = this.avatarUrlMap && this.avatarUrlMap[avatarUrl]
      if (cached) {
        this.setData({ userDisplayAvatarUrl: cached })
        return
      }
      this.setData({ userDisplayAvatarUrl: '' })
      resolveCloudFileUrls([avatarUrl]).then(map => {
        const displayUrl = map && map[avatarUrl]
        if (!displayUrl) return
        this.avatarUrlMap = { ...(this.avatarUrlMap || {}), ...map }
        this.setData({ userDisplayAvatarUrl: displayUrl })
      }).catch(err => console.warn('resolve index avatar failed', err))
      return
    }
    this.setData({
      userDisplayAvatarUrl: shouldRenderAvatar(avatarUrl, avatarUrl, true) ? avatarUrl : ''
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
      canDelete: this.isCreatedByMe(room),
      swipeX: 0,
      timeAgo: formatRelativeTime(new Date(room.updatedAt || room.createdAt)),
      winner: room.winner || null
    }
  },

  isCreatedByMe(room) {
    if (!room) return false
    const app = getApp()
    const openid = app.globalData.openid || ''
    const clientId = getClientId()
    if (openid && room.createdBy === openid) return true
    return (room.players || []).some(player => {
      if (!player || !player.isCreator) return false
      if (openid && player.openid === openid) return true
      return clientId && player.clientId === clientId
    })
  },

  onRoomTouchStart(e) {
    const room = e.currentTarget.dataset.room
    if (!room || !room.canDelete) return
    this.touchRoomId = room._id
    this.touchStartX = e.touches && e.touches[0] ? e.touches[0].clientX : 0
    this.touchStartY = e.touches && e.touches[0] ? e.touches[0].clientY : 0
    this.touchMoved = false
  },

  onRoomTouchMove(e) {
    if (!this.touchRoomId) return
    const touch = e.touches && e.touches[0]
    if (!touch) return
    const dx = touch.clientX - this.touchStartX
    const dy = touch.clientY - this.touchStartY
    if (Math.abs(dy) > Math.abs(dx)) return
    if (Math.abs(dx) > 12) this.touchMoved = true
  },

  onRoomTouchEnd(e) {
    const room = e.currentTarget.dataset.room
    if (!room || !room.canDelete || this.touchRoomId !== room._id) {
      this.resetTouchState()
      return
    }
    const touch = e.changedTouches && e.changedTouches[0]
    const dx = touch ? touch.clientX - this.touchStartX : 0
    if (dx < -40) {
      this.setRoomSwipe(room._id, -144)
      this.justSwipedRoomId = room._id
    } else if (dx > 40) {
      this.setRoomSwipe(room._id, 144)
      this.justSwipedRoomId = room._id
    } else if (Math.abs(dx) > 12) {
      this.setRoomSwipe(room._id, 0)
    }
    setTimeout(() => {
      if (this.justSwipedRoomId === room._id) this.justSwipedRoomId = ''
    }, 300)
    this.resetTouchState()
  },

  resetTouchState() {
    this.touchRoomId = ''
    this.touchStartX = 0
    this.touchStartY = 0
    this.touchMoved = false
  },

  setRoomSwipe(roomId, swipeX) {
    const activeRooms = (this.data.activeRooms || []).map(room => ({
      ...room,
      swipeX: room._id === roomId ? swipeX : 0
    }))
    this.setData({ activeRooms })
  },

  onCreateRoom() {
    wx.navigateTo({ url: '/pages/create/create' })
  },

  onJoinRoom() {
    wx.navigateTo({ url: '/pages/join/join' })
  },

  onEnterRoom(e) {
    const room = e.currentTarget.dataset.room
    if (this.justSwipedRoomId === room._id || room.swipeX !== 0) {
      this.setRoomSwipe(room._id, 0)
      return
    }
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
  },

  onDeleteRoom(e) {
    const room = e.currentTarget.dataset.room
    if (!room || !room.canDelete) return
    wx.showModal({
      title: '删除房间',
      content: '确定删除“' + (room.name || '未命名房间') + '”？删除后其他人也无法继续进入。',
      confirmText: '删除',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (!res.confirm) {
          this.setRoomSwipe(room._id, 0)
          return
        }
        try {
          if (wx.cloud && typeof wx.cloud.callFunction === 'function') {
            const result = await wx.cloud.callFunction({
              name: 'getHistory',
              data: {
                action: 'deleteOwnedRoom',
                roomId: room._id,
                clientId: getClientId()
              }
            })
            if (!result.result || result.result.code !== 0) {
              const errMsg = (result.result && result.result.errMsg) || 'delete failed'
              if (!errMsg.includes('room not found')) throw new Error(errMsg)
            }
          }
          removeRoomReferences([room._id])
          this.setData({
            activeRooms: (this.data.activeRooms || []).filter(item => item._id !== room._id)
          })
          wx.showToast({ title: '已删除', icon: 'success' })
        } catch (err) {
          console.warn('delete owned room failed', err)
          this.setRoomSwipe(room._id, 0)
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  }
})
