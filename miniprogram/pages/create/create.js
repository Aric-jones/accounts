const { GAME_TYPES, generateId, showToast } = require('../../utils/util')
const { applyTheme } = require('../../utils/theme')

Page({
  data: {
    theme: 'light',
    roomName: '',
    selectedGame: 'guandan',
    gameTypes: [],
    unitPrice: 1,
    teaFee: 0,
    creating: false
  },

  onLoad() {
    applyTheme(this)
    this.initGameTypes()
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
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const day = weekDays[new Date().getDay()]
    const gameInfo = GAME_TYPES[this.data.selectedGame]
    this.setData({ roomName: '周' + day + gameInfo.name + '局' })
  },

  onNameInput(e) {
    this.setData({ roomName: e.detail.value })
  },

  onSelectGame(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ selectedGame: key })
    this.setDefaultRoomName()
  },

  onUnitPriceInput(e) {
    this.setData({ unitPrice: parseFloat(e.detail.value) || 0 })
  },

  onTeaFeeInput(e) {
    this.setData({ teaFee: parseInt(e.detail.value) || 0 })
  },

  onCreateRoom() {
    const { roomName, selectedGame, unitPrice, teaFee } = this.data
    if (!roomName.trim()) {
      showToast('请输入牌局名称')
      return
    }

    this.setData({ creating: true })

    const app = getApp()
    const shareCode = app.generateRoomCode()
    const now = new Date()
    const userInfo = wx.getStorageSync('userInfo') || {}

    // Only the creator is in the room initially
    const creator = {
      id: generateId(),
      nickname: userInfo.nickName || '房主',
      avatarUrl: userInfo.avatarUrl || '',
      isCreator: true
    }

    const roomData = {
      _id: generateId(),
      name: roomName,
      gameType: selectedGame,
      players: [creator],
      rounds: [],
      unitPrice: unitPrice,
      teaFee: teaFee,
      status: 'playing',
      shareCode: shareCode,
      createdBy: app.globalData.openid || 'local',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }

    // Save locally
    const localRooms = wx.getStorageSync('localRooms') || []
    localRooms.unshift(roomData)
    wx.setStorageSync('localRooms', localRooms)

    const myRoomIds = wx.getStorageSync('myRoomIds') || []
    myRoomIds.unshift(roomData._id)
    wx.setStorageSync('myRoomIds', myRoomIds)

    this.setData({ creating: false })

    // Go directly to room page (which will show QR code and waiting state)
    wx.redirectTo({ url: '/pages/room/room?id=' + roomData._id })
  }
})
