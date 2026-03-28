const { GAME_TYPES, showToast, getDefaultAvatar, generateId } = require('../../utils/util')
const { calculateNetScores, findWinner } = require('../../utils/settlement')
const { applyTheme } = require('../../utils/theme')
const voice = require('../../utils/voice')

Page({
  data: {
    theme: 'light',
    room: null,
    realPlayers: [],
    teaPlayer: null,
    myPlayerId: '',
    codeChars: [],
    showInvite: false,
    showPayDialog: false,
    showAddPlayer: false,
    showEditProfile: false,
    showTeaPanel: false,
    showChart: false,
    showQrPanel: false,
    qrCodeUrl: '',
    qrLoading: false,
    showTableDialog: false,
    showTableHelp: false,
    tableDirection: 'pay',
    tableAmount: '',
    tableFrom: null,
    tablePlayer: null,
    tableBalance: 0,
    showAllTxns: false,
    payTarget: null,
    payFrom: null,
    payAmount: '',
    quickAmounts: [1, 2, 5, 10, 20, 50],
    displayTxns: [],
    teaFeePercent: 0,
    teaCollectMode: 'immediate',
    teaFeeCollected: 0,
    pendingTeaFee: 0,
    teaPercentOptions: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    newPlayerName: '',
    editName: '',
    editPlayer: null,
    keyboardHeight: 0,
    chartTooltip: null,
    chartVisibleIds: {},
    voiceEnabled: true,
    avatarColors: ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E']
  },

  onLoad(options) {
    applyTheme(this)
    voice.init()
    this.setData({ voiceEnabled: voice.isEnabled() })
    if (options.id) {
      this.roomId = options.id
      this.loadRoom(options.id)
    }
    if (options.newRoom === '1') {
      setTimeout(() => this.setData({ showQrPanel: true }), 300)
    }
  },

  onShow() {
    applyTheme(this)
    if (this.roomId) this.loadRoom(this.roomId)
  },

  onUnload() {
    if (!this.roomId) return
    const localRooms = wx.getStorageSync('localRooms') || []
    const room = localRooms.find(r => r._id === this.roomId)
    if (!room) return
    const realPlayers = (room.players || []).filter(p => p.id !== '__tea__' && p.id !== '__table__')
    const txns = (room.transactions || []).length
    if (realPlayers.length <= 1 && txns === 0) {
      const filtered = localRooms.filter(r => r._id !== this.roomId)
      wx.setStorageSync('localRooms', filtered)
    }
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

    if (!room.players.find(p => p.id === '__tea__')) {
      room.players.push({ id: '__tea__', nickname: '茶水费', isTea: true })
      this.saveRoom(room)
    }

    if (!room.players.find(p => p.id === '__table__')) {
      room.players.push({ id: '__table__', nickname: '台面', isTable: true })
      this.saveRoom(room)
    }

    const gameInfo = GAME_TYPES[room.gameType] || GAME_TYPES.poker
    room.gameTypeName = gameInfo.name

    const allPlayers = room.players
    const netScores = calculateNetScores(room.transactions, allPlayers)

    const realPlayers = []
    let teaPlayer = null
    let tablePlayer = null
    allPlayers.forEach((p, i) => {
      const enriched = {
        ...p,
        color: p.avatarColor || getDefaultAvatar(i),
        totalScore: netScores[p.id] || 0
      }
      if (p.id === '__tea__') teaPlayer = enriched
      else if (p.id === '__table__') tablePlayer = enriched
      else realPlayers.push(enriched)
    })
    const tableBalance = tablePlayer ? tablePlayer.totalScore : 0

    room.players = allPlayers
    const teaFeePercent = room.teaFeePercent || 0
    const teaCollectMode = room.teaCollectMode || 'immediate'
    const teaFeeCollected = teaPlayer ? teaPlayer.totalScore : 0

    let pendingTeaFee = 0
    if (teaCollectMode === 'manual' && teaFeePercent > 0) {
      const lastIdx = room.lastTeaCollectIdx || 0
      const recent = room.transactions.slice(lastIdx).filter(t => t.to !== '__tea__')
      if (recent.length > 0) {
        const winnings = {}
        allPlayers.forEach(p => { winnings[p.id] = 0 })
        recent.forEach(t => {
          if (winnings[t.to] !== undefined) winnings[t.to] += t.amount
        })
        Object.keys(winnings).forEach(pid => {
          if (pid !== '__tea__' && winnings[pid] > 0) {
            pendingTeaFee += Math.floor(winnings[pid] * teaFeePercent / 100)
          }
        })
      }
    }

    const myPlayerId = this.data.myPlayerId || (realPlayers.find(p => p.isCreator) || {}).id || ''
    const displayTxns = this.buildDisplayTxns(room.transactions, this.data.showAllTxns)

    const allChipPlayers = []
    if (tablePlayer) {
      allChipPlayers.push({
        ...tablePlayer,
        color: 'linear-gradient(135deg, #F59E0B, #D97706)',
        avatarText: '🎯',
        chipLabel: '台面'
      })
    }
    if (teaPlayer) {
      allChipPlayers.push({
        ...teaPlayer,
        color: 'linear-gradient(135deg, #A8D8B9, #6BAF8D)',
        avatarText: '🍵',
        chipLabel: teaFeePercent + '%'
      })
    }
    realPlayers.forEach(p => {
      allChipPlayers.push({
        ...p,
        avatarText: p.nickname ? p.nickname[0] : '?',
        chipLabel: p.nickname
      })
    })

    this.setData({
      room,
      realPlayers,
      allChipPlayers,
      teaPlayer,
      tablePlayer,
      tableBalance,
      myPlayerId,
      codeChars: (room.shareCode || '').split(''),
      showInvite: false,
      displayTxns,
      teaFeePercent,
      teaCollectMode,
      teaFeeCollected,
      pendingTeaFee
    })

    wx.setNavigationBarTitle({ title: room.name })
  },

  buildDisplayTxns(transactions, showAll) {
    const myId = this.data.myPlayerId
    const list = showAll ? [...transactions] : transactions.slice(-10)
    return list.reverse().map(t => {
      const d = new Date(t.timestamp)
      const h = String(d.getHours()).padStart(2, '0')
      const m = String(d.getMinutes()).padStart(2, '0')
      const isMyPay = t.from === myId
      const isMyReceive = t.to === myId
      return { ...t, timeStr: h + ':' + m, isMyPay, isMyReceive }
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

  onToggleVoice() {
    const val = !this.data.voiceEnabled
    voice.setEnabled(val)
    this.setData({ voiceEnabled: val })
    showToast(val ? '语音已开启' : '语音已关闭')
  },

  onShowQrCode() {
    this.setData({ showQrPanel: true })
    if (this.data.qrCodeUrl) return
    const { room } = this.data
    if (!room) return
    this.setData({ qrLoading: true })
    const env = require('../../config/env')
    if (wx.cloud && env.CLOUD_ENV_ID) {
      wx.cloud.callFunction({
        name: 'getWxacode',
        data: {
          scene: 'code=' + room.shareCode,
          page: 'pages/join/join'
        }
      }).then(res => {
        if (res.result && res.result.success && res.result.fileID) {
          wx.cloud.getTempFileURL({
            fileList: [res.result.fileID]
          }).then(tmpRes => {
            const url = tmpRes.fileList && tmpRes.fileList[0] && tmpRes.fileList[0].tempFileURL
            this.setData({ qrCodeUrl: url || '', qrLoading: false })
          }).catch(() => this.setData({ qrLoading: false }))
        } else {
          this.setData({ qrLoading: false })
        }
      }).catch(() => this.setData({ qrLoading: false }))
    } else {
      this.setData({ qrLoading: false })
    }
  },

  onCloseQrPanel() {
    this.setData({ showQrPanel: false })
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
    this.setData({ showAddPlayer: false, keyboardHeight: 0 })
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
    voice.onPlayerJoin(name)
  },

  // === Tap Chip (unified) ===

  onTapChip(e) {
    const id = e.currentTarget.dataset.id
    if (id === '__table__') return this.onTapTable()
    if (id === '__tea__') return this.onTapTeaFee()

    const { myPlayerId } = this.data
    if (id === myPlayerId) {
      return this.onEditMyProfile()
    }
    this.onTapPlayer(e)
  },

  onTapPlayer(e) {
    const id = e.currentTarget.dataset.id
    const { realPlayers, myPlayerId } = this.data
    const target = realPlayers.find(p => p.id === id)
    if (!target) return

    const me = realPlayers.find(p => p.id === myPlayerId)
    if (!me) return showToast('请先设置你是哪位玩家')

    this.setData({
      showPayDialog: true,
      payTarget: target,
      payFrom: me,
      payAmount: ''
    })
  },

  onEditMyProfile() {
    const { room, myPlayerId } = this.data
    const player = room.players.find(p => p.id === myPlayerId)
    if (!player) return
    this.setData({
      showEditProfile: true,
      editPlayer: player,
      editName: player.nickname
    })
  },

  // === Edit Profile ===

  onCloseEditProfile() {
    this.setData({ showEditProfile: false, editPlayer: null, keyboardHeight: 0 })
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

  // === Keyboard ===

  onKeyboardShow(e) {
    this.setData({ keyboardHeight: e.detail.height || 0 })
  },

  onKeyboardHide() {
    this.setData({ keyboardHeight: 0 })
  },

  // === Pay Dialog ===

  onClosePayDialog() {
    this.setData({ showPayDialog: false, payTarget: null, payFrom: null, payAmount: '', keyboardHeight: 0 })
  },

  onSwitchPayer(e) {
    const id = e.currentTarget.dataset.id
    const player = this.data.realPlayers.find(p => p.id === id)
    if (player && player.id !== this.data.payTarget.id) {
      this.setData({ payFrom: player })
    }
  },

  onQuickAmount(e) {
    this.setData({ payAmount: e.currentTarget.dataset.val })
  },

  onPayAmountInput(e) {
    let val = e.detail.value
    if (parseInt(val) > 99999) val = '99999'
    this.setData({ payAmount: val })
  },

  onConfirmPay() {
    const { payTarget, payFrom, payAmount, room, teaFeePercent, teaCollectMode } = this.data
    const amount = Math.min(parseInt(payAmount) || 0, 99999)
    if (!amount || amount <= 0) return showToast('请输入有效分数')
    if (!payTarget || !payFrom) return showToast('请选择付款人')
    if (payFrom.id === payTarget.id) return showToast('不能支付给自己')

    const now = new Date().toISOString()
    room.transactions = room.transactions || []

    room.transactions.push({
      id: generateId(),
      from: payFrom.id, to: payTarget.id, amount,
      fromName: payFrom.nickname, toName: payTarget.nickname,
      timestamp: now
    })

    const autoTea = teaCollectMode === 'immediate' && teaFeePercent > 0
    const teaFee = autoTea ? Math.floor(amount * teaFeePercent / 100) : 0
    if (teaFee > 0) {
      room.transactions.push({
        id: generateId(),
        from: payTarget.id, to: '__tea__', amount: teaFee,
        fromName: payTarget.nickname, toName: '茶水费',
        timestamp: now
      })
    }

    room.updatedAt = now
    this.saveRoom(room)
    this.setData({ showPayDialog: false, payTarget: null, payFrom: null, payAmount: '' })
    wx.vibrateShort({ type: 'medium' })
    this.loadRoom(room._id)

    if (amount >= 50) {
      voice.onBigPayment(payFrom.nickname, payTarget.nickname, amount)
    }
    const allPlayers = room.players.filter(p => p.id !== '__tea__' && p.id !== '__table__')
    const netScores = calculateNetScores(room.transactions, room.players)
    allPlayers.forEach(p => {
      const s = netScores[p.id] || 0
      if (s >= 100 && p.id === payTarget.id) voice.onBigWinner(p.nickname, s)
      if (s <= -100 && p.id === payFrom.id) voice.onBigLoser(p.nickname, s)
    })
  },

  // === Tea Fee Panel ===

  onTapTeaFee() {
    this.setData({ showTeaPanel: true })
  },

  onCloseTeaPanel() {
    this.setData({ showTeaPanel: false })
  },

  onPickTeaPercent(e) {
    this.setData({ teaFeePercent: e.currentTarget.dataset.val })
  },

  onPickTeaMode(e) {
    this.setData({ teaCollectMode: e.currentTarget.dataset.mode })
  },

  onSaveTeaSetting() {
    const { room, teaFeePercent, teaCollectMode } = this.data
    const oldMode = room.teaCollectMode || 'immediate'
    const oldPercent = room.teaFeePercent || 0

    if (oldMode === 'manual' && teaCollectMode === 'immediate' && oldPercent > 0) {
      const lastIdx = room.lastTeaCollectIdx || 0
      const recent = room.transactions.slice(lastIdx).filter(t => t.to !== '__tea__')
      const winnings = {}
      room.players.forEach(p => { winnings[p.id] = 0 })
      recent.forEach(t => {
        if (winnings[t.to] !== undefined) winnings[t.to] += t.amount
      })
      const now = new Date().toISOString()
      room.players.forEach(p => {
        if (p.id === '__tea__') return
        if (winnings[p.id] > 0) {
          const fee = Math.floor(winnings[p.id] * oldPercent / 100)
          if (fee > 0) {
            room.transactions.push({
              id: generateId(),
              from: p.id, to: '__tea__', amount: fee,
              fromName: p.nickname, toName: '茶水费',
              timestamp: now
            })
          }
        }
      })
    }

    room.teaFeePercent = teaFeePercent
    room.teaCollectMode = teaCollectMode
    room.lastTeaCollectIdx = room.transactions.length

    this.saveRoom(room)
    this.setData({ showTeaPanel: false })
    this.loadRoom(room._id)
    showToast(teaFeePercent > 0 ? '茶水费' + teaFeePercent + '%（' + (teaCollectMode === 'immediate' ? '立即' : '手动') + '）' : '已关闭茶水费')
  },

  onCollectTeaFee() {
    const { room, teaFeePercent } = this.data
    if (!teaFeePercent || teaFeePercent <= 0) return showToast('请先设置茶水费比例')

    const lastIdx = room.lastTeaCollectIdx || 0
    const recent = room.transactions.slice(lastIdx).filter(t => t.to !== '__tea__')
    if (recent.length === 0) return showToast('没有待收取的交易')

    const winnings = {}
    room.players.forEach(p => { winnings[p.id] = 0 })
    recent.forEach(t => {
      if (winnings[t.to] !== undefined) winnings[t.to] += t.amount
    })

    let totalCollected = 0
    const now = new Date().toISOString()
    room.players.forEach(p => {
      if (p.id === '__tea__') return
      if (winnings[p.id] > 0) {
        const fee = Math.floor(winnings[p.id] * teaFeePercent / 100)
        if (fee > 0) {
          room.transactions.push({
            id: generateId(),
            from: p.id, to: '__tea__', amount: fee,
            fromName: p.nickname, toName: '茶水费',
            timestamp: now
          })
          totalCollected += fee
        }
      }
    })

    if (totalCollected === 0) {
      showToast('赢家收入不足，免收茶水费')
      return
    }

    room.lastTeaCollectIdx = room.transactions.length
    room.updatedAt = new Date().toISOString()
    this.saveRoom(room)
    this.loadRoom(room._id)
    wx.vibrateShort({ type: 'heavy' })
    showToast('收取' + totalCollected + '分茶水费')
  },

  // === Table (台面) ===

  onTapTable() {
    const { realPlayers, myPlayerId } = this.data
    const me = realPlayers.find(p => p.id === myPlayerId)
    if (!me) return showToast('请先设置你是哪位玩家')
    this.setData({
      showTableDialog: true,
      tableDirection: 'pay',
      tableAmount: '',
      tableFrom: me
    })
  },

  onCloseTableDialog() {
    this.setData({ showTableDialog: false, tableAmount: '', keyboardHeight: 0 })
  },

  onTableDirection(e) {
    this.setData({ tableDirection: e.currentTarget.dataset.dir })
  },

  onTablePlayerSelect(e) {
    const id = e.currentTarget.dataset.id
    const player = this.data.realPlayers.find(p => p.id === id)
    if (player) this.setData({ tableFrom: player })
  },

  onTableQuickAmount(e) {
    this.setData({ tableAmount: e.currentTarget.dataset.val })
  },

  onTableAmountInput(e) {
    let val = e.detail.value
    if (parseInt(val) > 99999) val = '99999'
    this.setData({ tableAmount: val })
  },

  onConfirmTable() {
    const { tableDirection, tableFrom, tableAmount, room, tableBalance } = this.data
    const amount = Math.min(parseInt(tableAmount) || 0, 99999)
    if (!amount || amount <= 0) return showToast('请输入有效分数')
    if (!tableFrom) return showToast('请选择玩家')

    if (tableDirection === 'take' && amount > tableBalance) {
      return showToast('台面余额不足（当前' + tableBalance + '分）')
    }

    const now = new Date().toISOString()
    room.transactions = room.transactions || []

    if (tableDirection === 'pay') {
      room.transactions.push({
        id: generateId(),
        from: tableFrom.id, to: '__table__', amount,
        fromName: tableFrom.nickname, toName: '台面',
        timestamp: now
      })
    } else {
      room.transactions.push({
        id: generateId(),
        from: '__table__', to: tableFrom.id, amount,
        fromName: '台面', toName: tableFrom.nickname,
        timestamp: now
      })
    }

    room.updatedAt = now
    this.saveRoom(room)
    this.setData({ showTableDialog: false, tableAmount: '' })
    wx.vibrateShort({ type: 'medium' })
    this.loadRoom(room._id)
    const actionText = tableDirection === 'pay' ? '放入台面' : '从台面获取'
    showToast(tableFrom.nickname + ' ' + actionText + ' ' + amount + '分')
  },

  onToggleTableHelp() {
    this.setData({ showTableHelp: !this.data.showTableHelp })
  },

  // === Score Chart ===

  onShowChart() {
    this.setData({ showChart: true, chartTooltip: null, chartVisibleIds: {} })
    setTimeout(() => {
      this.drawChart()
      this.createSelectorQuery().select('#scoreChart').boundingClientRect(rect => {
        this._chartRect = rect
      }).exec()
    }, 150)
  },

  onCloseChart() {
    this.setData({ showChart: false })
  },

  onToggleChartPlayer(e) {
    const id = e.currentTarget.dataset.id
    const cur = this.data.chartVisibleIds
    const vis = cur[id] ? {} : { [id]: true }
    this.setData({ chartVisibleIds: vis, chartTooltip: null })
    this._recalcChartRange()
    this._drawChartBase()
  },

  _recalcChartRange() {
    const c = this._chart
    if (!c) return
    const vis = this.data.chartVisibleIds
    const hasSelection = Object.keys(vis).length > 0
    const visiblePlayers = hasSelection ? c.players.filter(p => vis[p.id]) : []

    let minS = 0, maxS = 0
    const target = visiblePlayers.length > 0 ? visiblePlayers : c.players
    target.forEach(p => {
      c.scoreHistory[p.id].forEach(v => {
        if (v < minS) minS = v
        if (v > maxS) maxS = v
      })
    })
    const yPad = Math.ceil((maxS - minS || 1) * 0.1) || 1
    minS -= yPad; maxS += yPad
    c.minS = minS
    c.maxS = maxS
    c.totalRange = maxS - minS
  },

  drawChart() {
    const { room } = this.data
    if (!room || !room.transactions || room.transactions.length === 0) return

    const players = room.players.filter(p => p.id !== '__tea__' && p.id !== '__table__')
    const txns = room.transactions
    const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E']

    const running = {}
    room.players.forEach(p => { running[p.id] = 0 })

    const scoreHistory = {}
    players.forEach(p => { scoreHistory[p.id] = [0] })

    txns.forEach(t => {
      if (running[t.from] !== undefined) running[t.from] -= t.amount
      if (running[t.to] !== undefined) running[t.to] += t.amount
      players.forEach(p => {
        if (t.from === p.id || t.to === p.id) {
          scoreHistory[p.id].push(running[p.id])
        }
      })
    })

    const query = this.createSelectorQuery()
    query.select('#scoreChart').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getWindowInfo().pixelRatio
      const w = res[0].width
      const h = res[0].height
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)

      const padL = 50, padR = 20, padT = 20, padB = 30
      const chartW = w - padL - padR
      const chartH = h - padT - padB

      let minS = 0, maxS = 0
      players.forEach(p => {
        scoreHistory[p.id].forEach(v => {
          if (v < minS) minS = v
          if (v > maxS) maxS = v
        })
      })
      const yPad = Math.ceil((maxS - minS || 1) * 0.1) || 1
      minS -= yPad; maxS += yPad
      const totalRange = maxS - minS

      this._chart = { canvas, ctx, dpr, w, h, padL, padR, padT, padB, chartW, chartH, minS, maxS, totalRange, players, scoreHistory, colors }

      this._drawChartBase()
    })
  },

  _drawChartBase(touchRatio) {
    const c = this._chart
    if (!c) return
    const { ctx, w, h, padL, padR, padT, padB, chartW, chartH, minS, totalRange, players, scoreHistory, colors } = c
    const vis = this.data.chartVisibleIds
    const hasSelection = Object.keys(vis).length > 0
    const visiblePlayers = hasSelection ? players.filter(p => vis[p.id]) : []

    ctx.clearRect(0, 0, w, h)

    // 网格
    ctx.strokeStyle = '#E5E7EB'
    ctx.lineWidth = 0.5
    ctx.setLineDash([4, 4])
    const gridLines = 5
    for (let i = 0; i <= gridLines; i++) {
      const y = padT + chartH * (1 - i / gridLines)
      ctx.beginPath()
      ctx.moveTo(padL, y)
      ctx.lineTo(w - padR, y)
      ctx.stroke()
      const val = Math.round(minS + totalRange * i / gridLines)
      ctx.fillStyle = '#9CA3AF'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(val, padL - 6, y + 3)
    }
    ctx.setLineDash([])

    // Y轴
    ctx.strokeStyle = '#D1D5DB'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padL, padT)
    ctx.lineTo(padL, padT + chartH)
    ctx.stroke()

    // 零线
    const zeroY = padT + chartH * (1 - (0 - minS) / totalRange)
    ctx.strokeStyle = '#D1D5DB'
    ctx.beginPath()
    ctx.moveTo(padL, zeroY)
    ctx.lineTo(w - padR, zeroY)
    ctx.stroke()

    if (visiblePlayers.length === 0) {
      ctx.fillStyle = '#9CA3AF'
      ctx.font = '14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('点击上方玩家查看走势', w / 2, h / 2)
      return
    }

    const tooltipItems = []

    visiblePlayers.forEach((p) => {
      const pi = players.indexOf(p)
      const color = p.color || colors[pi % colors.length]
      const points = scoreHistory[p.id]
      const n = points.length

      ctx.strokeStyle = color
      ctx.lineWidth = 2.5
      ctx.lineJoin = 'round'
      ctx.beginPath()
      points.forEach((val, idx) => {
        const x = padL + (chartW * idx / (n - 1 || 1))
        const y = padT + chartH * (1 - (val - minS) / totalRange)
        if (idx === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      const lastVal = points[n - 1]
      const lastX = padL + chartW
      const lastY = padT + chartH * (1 - (lastVal - minS) / totalRange)
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
      ctx.fill()

      // X轴标签（该玩家自己的笔数）
      ctx.fillStyle = '#9CA3AF'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      if (visiblePlayers.length === 1) {
        const step = Math.max(1, Math.floor(n / 6))
        for (let i = 0; i < n; i += step) {
          const x = padL + (chartW * i / (n - 1 || 1))
          ctx.fillText(i === 0 ? '开始' : '#' + i, x, h - 8)
        }
      }

      // 触摸高亮
      if (touchRatio !== undefined) {
        const idx = Math.round(touchRatio * (n - 1))
        if (idx >= 0 && idx < n) {
          const hx = padL + (chartW * idx / (n - 1 || 1))
          const val = points[idx]
          const hy = padT + chartH * (1 - (val - minS) / totalRange)
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.arc(hx, hy, 5, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = color
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(hx, hy, 5, 0, Math.PI * 2)
          ctx.stroke()
          tooltipItems.push({ name: p.nickname, color, score: val, idx })
        }
      }
    })

    // 触摸竖线
    if (touchRatio !== undefined) {
      const hx = padL + chartW * touchRatio
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(hx, padT)
      ctx.lineTo(hx, padT + chartH)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // 多人时不画X轴标签（各人笔数不同）
    if (visiblePlayers.length > 1) {
      ctx.fillStyle = '#9CA3AF'
      ctx.font = '9px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('开始', padL, h - 8)
    }

    c._lastTooltipItems = tooltipItems
  },

  onChartTouch(e) {
    const c = this._chart
    if (!c) return
    const vis = this.data.chartVisibleIds
    if (Object.keys(vis).length === 0) return
    const touch = e.touches[0]
    if (!touch) return
    const { padL, chartW } = c

    const rect = this._chartRect
    const x = touch.clientX - (rect ? rect.left : 0)
    let ratio = (x - padL) / chartW
    ratio = Math.max(0, Math.min(1, ratio))

    this._drawChartBase(ratio)

    const items = (c._lastTooltipItems || []).map(it => ({
      name: it.name, color: it.color, score: it.score
    }))
    const tooltipX = padL + chartW * ratio
    const flipLeft = ratio > 0.65
    const label = items.length === 1 ? '#' + (items[0].idx || 0) : ''
    this.setData({
      chartTooltip: { x: tooltipX, idx: label, items, flipLeft }
    })
  },

  onChartTouchEnd() {
    this.setData({ chartTooltip: null })
    this._drawChartBase()
  },

  // === Undo ===

  onUndo() {
    const { room } = this.data
    const txns = room.transactions || []
    if (txns.length === 0) return showToast('没有交易记录')

    const last = txns[txns.length - 1]
    let undoCount = 1
    let desc = last.fromName + '→' + last.toName + ' ' + last.amount + '分'
    if (last.to === '__tea__' && txns.length >= 2) {
      const prev = txns[txns.length - 2]
      undoCount = 2
      desc = prev.fromName + '→' + prev.toName + ' ' + prev.amount + '分（含茶水费）'
    }

    const simTxns = txns.slice(0, txns.length - undoCount)
    const simNet = {}
    room.players.forEach(p => { simNet[p.id] = 0 })
    simTxns.forEach(t => {
      if (simNet[t.from] !== undefined) simNet[t.from] -= t.amount
      if (simNet[t.to] !== undefined) simNet[t.to] += t.amount
    })
    if ((simNet['__table__'] || 0) < 0) {
      return showToast('撤销后台面余额为负，不允许撤销')
    }

    wx.showModal({
      title: '撤销',
      content: '撤销 ' + desc + '？',
      success: (res) => {
        if (!res.confirm) return
        room.transactions.splice(-undoCount, undoCount)
        room.updatedAt = new Date().toISOString()
        this.saveRoom(room)
        this.loadRoom(room._id)
        showToast('已撤销')
      }
    })
  },

  // === End Game ===

  onEndGame() {
    const { room, tableBalance } = this.data
    if (!room.transactions || room.transactions.length === 0) {
      return showToast('还没有交易记录')
    }
    if (tableBalance !== 0) {
      return showToast('台面余额为' + tableBalance + '，请先清零再结算')
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
