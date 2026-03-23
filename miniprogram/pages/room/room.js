const { GAME_TYPES, showToast, getDefaultAvatar, generateId } = require('../../utils/util')
const { calculateNetScores, findWinner } = require('../../utils/settlement')
const { applyTheme } = require('../../utils/theme')

Page({
  data: {
    theme: 'light',
    room: null,
    currentRound: 0,
    codeChars: [],
    showInvite: false,
    showScoreInput: false,
    showAddPlayer: false,
    currentScores: {},
    scoreSum: 0,
    newPlayerName: ''
  },

  onLoad(options) {
    applyTheme(this)
    if (options.id) {
      this.roomId = options.id
      this.loadRoom(options.id)
    }
  },

  onShow() {
    applyTheme(this)
    if (this.roomId) this.loadRoom(this.roomId)
  },

  loadRoom(roomId) {
    const localRooms = wx.getStorageSync('localRooms') || []
    let room = localRooms.find(r => r._id === roomId)
    if (!room) {
      showToast('房间不存在')
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }

    const gameInfo = GAME_TYPES[room.gameType] || GAME_TYPES.poker
    room.gameTypeName = gameInfo.name

    const netScores = calculateNetScores(room.rounds || [], room.players)
    let maxScore = -Infinity
    room.players = room.players.map((p, i) => {
      const totalScore = netScores[p.id] || 0
      if (totalScore > maxScore) maxScore = totalScore
      return { ...p, color: getDefaultAvatar(i), totalScore }
    })

    const currentScores = {}
    room.players.forEach(p => { currentScores[p.id] = '' })

    this.setData({
      room,
      currentRound: (room.rounds || []).length,
      codeChars: (room.shareCode || '').split(''),
      currentScores,
      showInvite: room.players.length < 2
    })

    wx.setNavigationBarTitle({ title: room.name })
  },

  // === Invite & Share ===

  onToggleInvite() {
    this.setData({ showInvite: !this.data.showInvite })
  },

  onCopyCode() {
    wx.setClipboardData({
      data: this.data.room.shareCode,
      success: () => showToast('房间码已复制')
    })
  },

  onShareAppMessage() {
    const { room } = this.data
    return {
      title: '来加入「' + room.name + '」牌局吧！',
      path: '/pages/join/join?code=' + room.shareCode
    }
  },

  // === Add Player (Manual) ===

  onAddPlayer() {
    this.setData({ showAddPlayer: true, newPlayerName: '' })
  },

  onCloseAddPlayer() {
    this.setData({ showAddPlayer: false })
  },

  onNewPlayerInput(e) {
    this.setData({ newPlayerName: e.detail.value })
  },

  onConfirmAddPlayer() {
    const name = this.data.newPlayerName.trim()
    if (!name) {
      showToast('请输入昵称')
      return
    }

    const { room } = this.data
    const newPlayer = {
      id: generateId(),
      nickname: name,
      avatarUrl: '',
      isCreator: false
    }

    room.players.push(newPlayer)
    this.saveRoom(room)
    this.setData({ showAddPlayer: false })

    // Voice announcement: "[name] joined"
    this.announceJoin(name)

    this.loadRoom(room._id)
    showToast(name + ' 已加入')
  },

  announceJoin(name) {
    // Uses WeChat TTS (requires plugin, see README for setup)
    // Fallback: system vibration + toast
    wx.vibrateShort({ type: 'heavy' })

    // If the "WechatSI" plugin is configured, use it for voice:
    // const plugin = requirePlugin("WechatSI")
    // plugin.textToSpeech({ content: name + '加入了牌局', ... })
  },

  // === Score Input ===

  onOpenScoreInput() {
    if (this.data.room.players.length < 2) {
      showToast('至少需要2位玩家')
      return
    }
    const currentScores = {}
    this.data.room.players.forEach(p => { currentScores[p.id] = '' })
    this.setData({ showScoreInput: true, currentScores, scoreSum: 0 })
  },

  onCloseScoreInput() {
    this.setData({ showScoreInput: false })
  },

  onScoreInput(e) {
    const id = e.currentTarget.dataset.id
    const val = e.detail.value
    const scores = { ...this.data.currentScores }
    scores[id] = val === '' ? '' : parseInt(val) || 0
    const sum = Object.values(scores).reduce((a, b) => a + (parseInt(b) || 0), 0)
    this.setData({ currentScores: scores, scoreSum: sum })
  },

  onQuickScore(e) {
    const { id, delta } = e.currentTarget.dataset
    const scores = { ...this.data.currentScores }
    scores[id] = (parseInt(scores[id]) || 0) + delta
    const sum = Object.values(scores).reduce((a, b) => a + (parseInt(b) || 0), 0)
    this.setData({ currentScores: scores, scoreSum: sum })
  },

  onSubmitScore() {
    const { currentScores, room } = this.data
    const scores = {}
    let hasScore = false
    room.players.forEach(p => {
      scores[p.id] = parseInt(currentScores[p.id]) || 0
      if (scores[p.id] !== 0) hasScore = true
    })

    if (!hasScore) {
      showToast('请至少输入一个分数')
      return
    }

    const roundNum = (room.rounds || []).length + 1
    room.rounds = room.rounds || []
    room.rounds.push({ roundNum, scores, timestamp: new Date().toISOString() })
    room.updatedAt = new Date().toISOString()

    this.saveRoom(room)
    this.setData({ showScoreInput: false })
    wx.vibrateShort({ type: 'medium' })
    this.loadRoom(room._id)
  },

  // === Undo ===

  onUndo() {
    wx.showModal({
      title: '撤销',
      content: '撤销最后一局记录？',
      success: (res) => {
        if (!res.confirm) return
        const { room } = this.data
        room.rounds = room.rounds.slice(0, -1)
        room.updatedAt = new Date().toISOString()
        this.saveRoom(room)
        this.loadRoom(room._id)
        showToast('已撤销')
      }
    })
  },

  // === End Game ===

  onEndGame() {
    const { room, currentRound } = this.data
    if (currentRound === 0) {
      showToast('还没有记录，无需结算')
      return
    }
    wx.showModal({
      title: '结束牌局',
      content: '确定结束？已进行' + currentRound + '局。',
      confirmText: '结算',
      confirmColor: '#1A6B4A',
      success: (res) => {
        if (!res.confirm) return
        const netScores = calculateNetScores(room.rounds, room.players)
        const winner = findWinner(netScores, room.players)
        room.status = 'settled'
        room.winner = winner
        room.updatedAt = new Date().toISOString()
        this.saveRoom(room)
        wx.redirectTo({ url: '/pages/settlement/settlement?id=' + room._id })
      }
    })
  },

  // === Persistence ===

  saveRoom(room) {
    const localRooms = wx.getStorageSync('localRooms') || []
    const idx = localRooms.findIndex(r => r._id === room._id)
    if (idx >= 0) {
      localRooms[idx] = room
    } else {
      localRooms.unshift(room)
    }
    wx.setStorageSync('localRooms', localRooms)
  }
})
