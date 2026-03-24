const { GAME_TYPES, showToast, getDefaultAvatar, generateId } = require('../../utils/util')
const { calculateNetScores, findWinner } = require('../../utils/settlement')
const { applyTheme } = require('../../utils/theme')

Page({
  data: {
    theme: 'light',
    room: null,
    codeChars: [],
    showInvite: false,
    showPayDialog: false,
    showAddPlayer: false,
    showAllTxns: false,
    payTarget: null,
    payAmount: '',
    quickAmounts: [1, 2, 5, 10, 20, 50],
    displayTxns: [],
    teaFeeCollected: 0,
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

    room.transactions = room.transactions || []

    const gameInfo = GAME_TYPES[room.gameType] || GAME_TYPES.poker
    room.gameTypeName = gameInfo.name

    const netScores = calculateNetScores(room.transactions, room.players)
    room.players = room.players.map((p, i) => ({
      ...p,
      color: getDefaultAvatar(i),
      totalScore: netScores[p.id] || 0
    }))

    let teaFeeCollected = (room.teaFee || 0) * room.transactions.length

    const displayTxns = this.buildDisplayTxns(room.transactions, this.data.showAllTxns)

    this.setData({
      room,
      codeChars: (room.shareCode || '').split(''),
      showInvite: room.players.length < 2,
      displayTxns,
      teaFeeCollected
    })

    wx.setNavigationBarTitle({ title: room.name })
  },

  buildDisplayTxns(transactions, showAll) {
    const list = showAll ? [...transactions] : transactions.slice(-10)
    return list.reverse().map(t => {
      const d = new Date(t.timestamp)
      const h = String(d.getHours()).padStart(2, '0')
      const m = String(d.getMinutes()).padStart(2, '0')
      return { ...t, timeStr: h + ':' + m }
    })
  },

  onShowAllTxns() {
    const show = !this.data.showAllTxns
    const displayTxns = this.buildDisplayTxns(this.data.room.transactions, show)
    this.setData({ showAllTxns: show, displayTxns })
  },

  // === Invite & Share ===

  onToggleInvite() {
    this.setData({ showInvite: !this.data.showInvite })
  },

  onCopyCode() {
    wx.setClipboardData({
      data: this.data.room.shareCode,
      success: () => showToast('已复制')
    })
  },

  onShareAppMessage() {
    const { room } = this.data
    return {
      title: '来加入「' + room.name + '」牌局！',
      path: '/pages/join/join?code=' + room.shareCode
    }
  },

  // === Add Player ===

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
    if (!name) return showToast('请输入昵称')

    const { room } = this.data
    room.players.push({
      id: generateId(),
      nickname: name,
      avatarUrl: '',
      isCreator: false
    })
    this.saveRoom(room)
    this.setData({ showAddPlayer: false })
    wx.vibrateShort({ type: 'heavy' })
    this.loadRoom(room._id)
    showToast(name + ' 已加入')
  },

  // === Direct Payment ===

  onTapPlayer(e) {
    const id = e.currentTarget.dataset.id
    const player = this.data.room.players.find(p => p.id === id)
    if (!player) return

    this.setData({
      showPayDialog: true,
      payTarget: player,
      payAmount: ''
    })
  },

  onClosePayDialog() {
    this.setData({ showPayDialog: false, payTarget: null, payAmount: '' })
  },

  onQuickAmount(e) {
    this.setData({ payAmount: e.currentTarget.dataset.val })
  },

  onPayAmountInput(e) {
    this.setData({ payAmount: e.detail.value })
  },

  onConfirmPay() {
    const { payTarget, payAmount, room } = this.data
    const amount = parseInt(payAmount)
    if (!amount || amount <= 0) return showToast('请输入有效分数')
    if (!payTarget) return

    const userInfo = wx.getStorageSync('userInfo') || {}
    const myPlayer = room.players.find(p => p.isCreator)
    const fromName = myPlayer ? myPlayer.nickname : (userInfo.nickName || '我')
    const fromId = myPlayer ? myPlayer.id : 'me'

    if (fromId === payTarget.id) return showToast('不能支付给自己')

    const txn = {
      id: generateId(),
      from: fromId,
      to: payTarget.id,
      amount,
      fromName,
      toName: payTarget.nickname,
      timestamp: new Date().toISOString()
    }

    room.transactions = room.transactions || []
    room.transactions.push(txn)
    room.updatedAt = new Date().toISOString()

    this.saveRoom(room)
    this.setData({ showPayDialog: false, payTarget: null, payAmount: '' })
    wx.vibrateShort({ type: 'medium' })
    this.loadRoom(room._id)
  },

  // === Undo ===

  onUndo() {
    wx.showModal({
      title: '撤销',
      content: '撤销最后一笔记录？',
      success: (res) => {
        if (!res.confirm) return
        const { room } = this.data
        room.transactions = (room.transactions || []).slice(0, -1)
        room.updatedAt = new Date().toISOString()
        this.saveRoom(room)
        this.loadRoom(room._id)
        showToast('已撤销')
      }
    })
  },

  // === End Game ===

  onEndGame() {
    const { room } = this.data
    if (!room.transactions || room.transactions.length === 0) {
      return showToast('还没有交易记录')
    }
    wx.showModal({
      title: '结束牌局',
      content: '共' + room.transactions.length + '笔交易，确定结算？',
      confirmText: '结算',
      confirmColor: '#1A6B4A',
      success: (res) => {
        if (!res.confirm) return
        const netScores = calculateNetScores(room.transactions, room.players)
        room.status = 'settled'
        room.winner = findWinner(netScores, room.players)
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
    if (idx >= 0) localRooms[idx] = room
    else localRooms.unshift(room)
    wx.setStorageSync('localRooms', localRooms)
  }
})
