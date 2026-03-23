const { GAME_TYPES, getDefaultAvatar, generateId, showToast } = require('../../utils/util')
const { applyTheme } = require('../../utils/theme')

Page({
  data: {
    theme: 'light',
    colors: {},
    roomName: '',
    selectedGame: 'guandan',
    gameTypes: [],
    playerCount: 4,
    minPlayers: 2,
    maxPlayers: 8,
    players: [],
    unitPrice: 1,
    creating: false
  },

  onLoad() {
    applyTheme(this)
    this.initGameTypes()
    this.initPlayers(4)
    this.setDefaultRoomName()
  },

  initGameTypes() {
    const gameTypes = Object.keys(GAME_TYPES).map(key => ({
      key,
      ...GAME_TYPES[key]
    }))
    this.setData({ gameTypes })
  },

  setDefaultRoomName() {
    const now = new Date()
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const gameInfo = GAME_TYPES[this.data.selectedGame]
    const name = `周${weekDays[now.getDay()]}${gameInfo.name}局`
    this.setData({ roomName: name })
  },

  initPlayers(count) {
    const players = []
    for (let i = 0; i < count; i++) {
      players.push({
        id: generateId(),
        nickname: '',
        avatarUrl: '',
        color: getDefaultAvatar(i)
      })
    }

    const app = getApp()
    if (app.globalData.userInfo) {
      players[0].nickname = app.globalData.userInfo.nickName || '我'
      players[0].avatarUrl = app.globalData.userInfo.avatarUrl || ''
    } else {
      players[0].nickname = '我'
    }

    this.setData({ players })
  },

  onNameInput(e) {
    this.setData({ roomName: e.detail.value })
  },

  onSelectGame(e) {
    const key = e.currentTarget.dataset.key
    const gameInfo = GAME_TYPES[key]
    const defaultCount = gameInfo.defaultPlayers
    const minPlayers = Math.min(...gameInfo.players)
    const maxPlayers = Math.max(...gameInfo.players)

    this.setData({
      selectedGame: key,
      playerCount: defaultCount,
      minPlayers: key === 'poker' ? 2 : minPlayers,
      maxPlayers: key === 'poker' ? 8 : maxPlayers
    })

    this.initPlayers(defaultCount)
    this.setDefaultRoomName()
  },

  onIncreasePlayer() {
    if (this.data.playerCount >= this.data.maxPlayers) return
    const count = this.data.playerCount + 1
    this.setData({ playerCount: count })
    const players = [...this.data.players]
    players.push({
      id: generateId(),
      nickname: '',
      avatarUrl: '',
      color: getDefaultAvatar(count - 1)
    })
    this.setData({ players })
  },

  onDecreasePlayer() {
    if (this.data.playerCount <= this.data.minPlayers) return
    const count = this.data.playerCount - 1
    this.setData({ playerCount: count })
    const players = this.data.players.slice(0, count)
    this.setData({ players })
  },

  onPlayerNameInput(e) {
    const index = e.currentTarget.dataset.index
    const value = e.detail.value
    const key = `players[${index}].nickname`
    this.setData({ [key]: value })
  },

  onUnitPriceInput(e) {
    this.setData({ unitPrice: parseFloat(e.detail.value) || 0 })
  },

  async onCreateRoom() {
    const { roomName, selectedGame, players, unitPrice } = this.data

    if (!roomName.trim()) {
      showToast('请输入牌局名称')
      return
    }

    const namedPlayers = players.map((p, i) => ({
      ...p,
      nickname: p.nickname || `玩家${i + 1}`
    }))

    this.setData({ creating: true })

    try {
      const app = getApp()
      const shareCode = app.generateRoomCode()
      const now = new Date()

      const roomData = {
        _id: generateId(),
        name: roomName,
        gameType: selectedGame,
        players: namedPlayers,
        rounds: [],
        unitPrice: unitPrice,
        status: 'playing',
        shareCode: shareCode,
        createdBy: app.globalData.openid || 'local',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      }

      // 尝试云端存储
      try {
        const db = wx.cloud.database()
        await db.collection('rooms').add({ data: roomData })
      } catch (e) {
        console.warn('云端存储失败，使用本地存储', e)
      }

      // 同时本地存储
      const localRooms = wx.getStorageSync('localRooms') || []
      localRooms.unshift(roomData)
      wx.setStorageSync('localRooms', localRooms)

      const myRoomIds = wx.getStorageSync('myRoomIds') || []
      myRoomIds.unshift(roomData._id)
      wx.setStorageSync('myRoomIds', myRoomIds)

      showToast('牌局创建成功！')

      setTimeout(() => {
        wx.redirectTo({ url: `/pages/room/room?id=${roomData._id}` })
      }, 500)
    } catch (e) {
      console.error('创建房间失败:', e)
      showToast('创建失败，请重试')
    }
    this.setData({ creating: false })
  }
})
