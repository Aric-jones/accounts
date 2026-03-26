const { GAME_TYPES, showToast, getDefaultAvatar, generateId } = require('../../utils/util')
const { calculateNetScores, findWinner } = require('../../utils/settlement')
const { applyTheme } = require('../../utils/theme')

Page({
  data: {
    theme: 'light',
    room: null,
    myPlayerId: '',
    codeChars: [],
    showInvite: false,
    showPayDialog: false,
    showAddPlayer: false,
    showEditProfile: false,
    showAllTxns: false,
    payTarget: null,
    payFrom: null,
    payAmount: '',
    quickAmounts: [1, 2, 5, 10, 20, 50],
    displayTxns: [],
    teaFeeCollected: 0,
    newPlayerName: '',
    editName: '',
    editPlayer: null,
    avatarColors: ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E']
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
      color: p.avatarColor || getDefaultAvatar(i),
      totalScore: netScores[p.id] || 0
    }))

    const myPlayerId = this.data.myPlayerId || (room.players.find(p => p.isCreator) || {}).id || ''
    let teaFeeCollected = (room.teaFee || 0) * room.transactions.length
    const displayTxns = this.buildDisplayTxns(room.transactions, this.data.showAllTxns)

    this.setData({
      room,
      myPlayerId,
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

  // === Tap Player: self=edit, other=pay ===

  onTapPlayer(e) {
    const id = e.currentTarget.dataset.id
    const { room, myPlayerId } = this.data
    const player = room.players.find(p => p.id === id)
    if (!player) return

    if (id === myPlayerId) {
      this.setData({
        showEditProfile: true,
        editPlayer: player,
        editName: player.nickname
      })
    } else {
      const me = room.players.find(p => p.id === myPlayerId)
      this.setData({
        showPayDialog: true,
        payTarget: player,
        payFrom: me,
        payAmount: ''
      })
    }
  },

  // === Edit Profile ===

  onCloseEditProfile() {
    this.setData({ showEditProfile: false, editPlayer: null })
  },

  onEditNameInput(e) {
    this.setData({ editName: e.detail.value })
  },

  onPickAvatarColor(e) {
    const color = e.currentTarget.dataset.color
    const { editPlayer, room } = this.data
    const p = room.players.find(pl => pl.id === editPlayer.id)
    if (p) p.avatarColor = color
    this.saveRoom(room)
    this.setData({ editPlayer: { ...editPlayer, color, avatarColor: color } })
    this.loadRoom(room._id)
  },

  onChooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        const { editPlayer, room } = this.data
        const p = room.players.find(pl => pl.id === editPlayer.id)
        if (p) p.avatarUrl = tempPath
        this.saveRoom(room)
        this.loadRoom(room._id)
        this.setData({ editPlayer: { ...editPlayer, avatarUrl: tempPath } })
      }
    })
  },

  onSaveProfile() {
    const { editName, editPlayer, room } = this.data
    const name = editName.trim()
    if (!name) return showToast('昵称不能为空')

    const p = room.players.find(pl => pl.id === editPlayer.id)
    if (p) {
      const oldName = p.nickname
      p.nickname = name
      // update existing transaction names
      ;(room.transactions || []).forEach(t => {
        if (t.from === p.id) t.fromName = name
        if (t.to === p.id) t.toName = name
      })
    }
    this.saveRoom(room)
    this.setData({ showEditProfile: false, editPlayer: null })
    this.loadRoom(room._id)
    showToast('已保存')
  },

  // === Pay Dialog ===

  onClosePayDialog() {
    this.setData({ showPayDialog: false, payTarget: null, payFrom: null, payAmount: '' })
  },

  onSwitchPayer(e) {
    const id = e.currentTarget.dataset.id
    const player = this.data.room.players.find(p => p.id === id)
    if (player && player.id !== this.data.payTarget.id) {
      this.setData({ payFrom: player })
    }
  },

  onQuickAmount(e) {
    this.setData({ payAmount: e.currentTarget.dataset.val })
  },

  onPayAmountInput(e) {
    this.setData({ payAmount: e.detail.value })
  },

  onConfirmPay() {
    const { payTarget, payFrom, payAmount, room } = this.data
    const amount = parseInt(payAmount)
    if (!amount || amount <= 0) return showToast('请输入有效分数')
    if (!payTarget || !payFrom) return showToast('请选择付款人')
    if (payFrom.id === payTarget.id) return showToast('不能支付给自己')

    const txn = {
      id: generateId(),
      from: payFrom.id,
      to: payTarget.id,
      amount,
      fromName: payFrom.nickname,
      toName: payTarget.nickname,
      timestamp: new Date().toISOString()
    }

    room.transactions = room.transactions || []
    room.transactions.push(txn)
    room.updatedAt = new Date().toISOString()

    this.saveRoom(room)
    this.setData({ showPayDialog: false, payTarget: null, payFrom: null, payAmount: '' })
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
