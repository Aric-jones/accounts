const { GAME_TYPES, showToast, getDefaultAvatar, generateId, getClientId, ensureCloudAvatar, resolveCloudFileUrls, isRenderableImageUrl } = require('../../utils/util')
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
    this.avatarUrlMap = {}
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

  onPullDownRefresh() {
    if (!this.roomId) {
      wx.stopPullDownRefresh()
      return
    }
    this.loadRoom(this.roomId).finally(() => wx.stopPullDownRefresh())
  },

  onUnload() {
    this.stopWatcher()
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

  // === Cloud Real-time ===
  _db() {
    return wx.cloud.database()
  },

  startWatcher(roomId) {
    this.stopWatcher()
    this.watcher = this._db().collection('rooms').doc(roomId).watch({
      onChange: (snapshot) => {
        if (snapshot.doc) {
          this.cacheRoom(snapshot.doc)
          this._updateRoomData(snapshot.doc)
        }
      },
      onError: (err) => {
        console.error('watch error', err)
      }
    })
  },

  stopWatcher() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  },

  loadRoom(roomId) {
    const db = this._db()
    return db.collection('rooms').doc(roomId).get().then(res => {
      if (!res.data) {
        showToast('房间不存在')
        setTimeout(() => wx.navigateBack(), 1000)
        return
      }
      // 写入本地缓存
      const localRooms = wx.getStorageSync('localRooms') || []
      const idx = localRooms.findIndex(r => r._id === roomId)
      const cloudRoom = res.data
      const room = cloudRoom

      if (idx >= 0) localRooms[idx] = room
      else localRooms.unshift(room)
      wx.setStorageSync('localRooms', localRooms)

      this._updateRoomData(room)
      this.startWatcher(roomId)
    }).catch(err => {
      console.error('加载房间失败', err)
      showToast('加载房间失败')
      setTimeout(() => wx.navigateBack(), 1000)
    })
  },

  async fetchLatestRoom(roomId) {
    const res = await this._db().collection('rooms').doc(roomId).get()
    if (!res.data) throw new Error('room not found')
    this.cacheRoom(res.data)
    this._updateRoomData(res.data)
    return res.data
  },

  cacheRoom(room) {
    if (!room || !room._id) return
    const localRooms = wx.getStorageSync('localRooms') || []
    const idx = localRooms.findIndex(r => r._id === room._id)
    if (idx >= 0) localRooms[idx] = room
    else localRooms.unshift(room)
    wx.setStorageSync('localRooms', localRooms)
  },

  _updateRoomData(room) {
    room.transactions = room.transactions || []

    this.resolveRoomAvatarUrls(room)
    this.redirectIfSettled(room)

    if (!room.players.find(p => p.id === '__tea__')) {
      room.players.push({ id: '__tea__', nickname: '茶水费', isTea: true })
    }

    if (!room.players.find(p => p.id === '__table__')) {
      room.players.push({ id: '__table__', nickname: '台面', isTable: true })
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
        displayAvatarUrl: this.getDisplayAvatarUrl(p.avatarUrl),
        hasDisplayAvatar: isRenderableImageUrl(this.getDisplayAvatarUrl(p.avatarUrl)),
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

    const myPlayerId = this.resolveMyPlayerId(realPlayers, room._id)
    this.repairMyLocalAvatar(room, myPlayerId)
    const displayTxns = this.buildDisplayTxns(room.transactions, this.data.showAllTxns)

    const allChipPlayers = []
    const me = realPlayers.find(p => p.id === myPlayerId)
    if (me) {
      allChipPlayers.push({
        ...me,
        avatarText: me.nickname ? me.nickname[0] : '?',
        chipLabel: me.nickname
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
    if (tablePlayer) {
      allChipPlayers.push({
        ...tablePlayer,
        color: 'linear-gradient(135deg, #F59E0B, #D97706)',
        avatarText: '🎯',
        chipLabel: '台面'
      })
    }
    realPlayers.forEach(p => {
      if (p.id !== myPlayerId) {
        allChipPlayers.push({
          ...p,
          avatarText: p.nickname ? p.nickname[0] : '?',
          chipLabel: p.nickname
        })
      }
    })
    allChipPlayers.sort((a, b) => {
      const rank = p => {
        if (p.id === '__table__') return 0
        if (p.id === '__tea__') return 1
        if (p.id === myPlayerId) return 2
        return 3
      }
      return rank(a) - rank(b)
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

  redirectIfSettled(room) {
    if (!room || room.status !== 'settled' || this._settlementRedirecting || this._endingGame) return
    this._settlementRedirecting = true
    showToast('房间已结束')
    setTimeout(() => {
      wx.redirectTo({ url: '/pages/settlement/settlement?id=' + room._id })
    }, 800)
  },

  ensureRoomPlaying() {
    const room = this.data.room
    if (room && room.status === 'settled') {
      this.redirectIfSettled(room)
      return false
    }
    return true
  },

  async repairMyLocalAvatar(room, myPlayerId) {
    if (this._repairingAvatar || !room || !myPlayerId || room.status === 'settled') return
    const player = (room.players || []).find(p => p.id === myPlayerId)
    if (!player || !player.avatarUrl) return
    if (player.avatarUrl.startsWith('cloud://') || player.avatarUrl.startsWith('http://') || player.avatarUrl.startsWith('https://')) return

    this._repairingAvatar = true
    try {
      const avatarUrl = await ensureCloudAvatar(player.avatarUrl, player.id || getClientId())
      if (avatarUrl && avatarUrl !== player.avatarUrl) {
        player.avatarUrl = avatarUrl
        await this.saveRoom(room, { updateFields: ['players'] })
      }
    } catch (err) {
      console.warn('repair local avatar failed', err)
    } finally {
      this._repairingAvatar = false
    }
  },

  getDisplayAvatarUrl(avatarUrl) {
    if (!avatarUrl) return ''
    return (this.avatarUrlMap && this.avatarUrlMap[avatarUrl]) || avatarUrl
  },

  resolveRoomAvatarUrls(room) {
    const cloudUrls = (room.players || [])
      .map(player => player.avatarUrl)
      .filter(url => url && url.startsWith('cloud://') && !(this.avatarUrlMap && this.avatarUrlMap[url]))
    if (cloudUrls.length === 0) return

    resolveCloudFileUrls(cloudUrls).then(map => {
      if (!map || Object.keys(map).length === 0) return
      this.avatarUrlMap = { ...(this.avatarUrlMap || {}), ...map }
      const currentRoom = this.data.room
      if (currentRoom && currentRoom._id === room._id) {
        this._updateRoomData(currentRoom)
      }
    }).catch(err => {
      console.warn('resolve avatar urls failed', err)
    })
  },

  resolveMyPlayerId(realPlayers, roomId) {
    const savedMap = wx.getStorageSync('roomPlayerIds') || {}
    const savedId = savedMap[roomId]
    if (savedId && realPlayers.find(p => p.id === savedId)) return savedId

    const app = getApp()
    const openid = app.globalData.openid || ''
    if (openid) {
      const byOpenid = realPlayers.find(p => p.openid === openid)
      if (byOpenid) {
        savedMap[roomId] = byOpenid.id
        wx.setStorageSync('roomPlayerIds', savedMap)
        return byOpenid.id
      }
    }

    const clientId = getClientId()
    const byClient = realPlayers.find(p => p.clientId === clientId)
    if (byClient) {
      savedMap[roomId] = byClient.id
      wx.setStorageSync('roomPlayerIds', savedMap)
      return byClient.id
    }

    const creator = realPlayers.find(p => p.isCreator)
    return creator ? creator.id : ''
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

  // === Tap Chip (unified) ===

  onTapChip(e) {
    if (!this.ensureRoomPlaying()) return
    const id = e.currentTarget.dataset.id
    if (id === '__table__') return this.onTapTable()
    if (id === '__tea__') return this.onTapTeaFee()
    if (id === this.data.myPlayerId) return this.onEditMyProfile()
    this.onTapPlayer(e)
  },

  onTapPlayer(e) {
    const id = e.currentTarget.dataset.id
    const { realPlayers, myPlayerId } = this.data
    const player = realPlayers.find(p => p.id === id)
    if (!player) return
    const payer = realPlayers.find(p => p.id === myPlayerId)
    if (!payer) return showToast('未识别当前用户')
    if (player.id === payer.id) return this.onEditMyProfile()

    this.setData({
      showPayDialog: true,
      payTarget: player,
      payFrom: payer,
      payAmount: ''
    })
  },

  onEditMyProfile() {
    const { room, myPlayerId } = this.data
    const player = room.players.find(p => p.id === myPlayerId)
    if (!player) return
    this.setData({
      showEditProfile: true,
      editPlayer: {
        ...player,
        displayAvatarUrl: this.getDisplayAvatarUrl(player.avatarUrl),
        hasDisplayAvatar: isRenderableImageUrl(this.getDisplayAvatarUrl(player.avatarUrl))
      },
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

  async onPickAvatarColor(e) {
    if (!this.ensureRoomPlaying()) return
    const color = e.currentTarget.dataset.color
    const { editPlayer, room } = this.data
    const p = room.players.find(pl => pl.id === editPlayer.id)
    if (p) p.avatarColor = color
    await this.saveRoom(room, { updateFields: ['players'] })
    this.setData({ editPlayer: { ...editPlayer, color, avatarColor: color } })
  },

  onChooseAvatar() {
    if (!this.ensureRoomPlaying()) return
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: async (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        const { editPlayer, room } = this.data
        let avatarUrl = tempPath
        try {
          avatarUrl = await ensureCloudAvatar(tempPath, editPlayer.id || getClientId())
        } catch (err) {
          console.warn('upload avatar failed', err)
        }
        const p = room.players.find(pl => pl.id === editPlayer.id)
        if (p) p.avatarUrl = avatarUrl
        await this.saveRoom(room, { updateFields: ['players'] })
        const displayAvatarUrl = this.getDisplayAvatarUrl(avatarUrl)
        this.setData({
          editPlayer: {
            ...editPlayer,
            avatarUrl,
            displayAvatarUrl,
            hasDisplayAvatar: isRenderableImageUrl(displayAvatarUrl)
          }
        })
      }
    })
  },

  async onSaveProfile() {
    if (!this.ensureRoomPlaying()) return
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
    await this.saveRoom(room, { updateFields: ['players', 'transactions'] })
    this.setData({ showEditProfile: false, editPlayer: null })
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

  onQuickAmount(e) {
    this.setData({ payAmount: e.currentTarget.dataset.val })
  },

  onPayAmountInput(e) {
    let val = e.detail.value
    if (parseInt(val) > 99999) val = '99999'
    this.setData({ payAmount: val })
  },

  async onConfirmPay() {
    if (!this.ensureRoomPlaying()) return
    const { payTarget, payFrom, payAmount } = this.data
    const amount = Math.min(parseInt(payAmount) || 0, 99999)
    if (!amount || amount <= 0) return showToast('请输入有效分数')
    if (!payTarget || !payFrom) return showToast('请选择付款人')
    if (payFrom.id === payTarget.id) return showToast('不能支付给自己')

    if (payFrom.id !== this.data.myPlayerId) return showToast('只能用自己的身份支付')

    let room = this.data.room
    try {
      room = await this.fetchLatestRoom(room._id)
    } catch (err) {
      console.warn('fetch latest room before pay failed', err)
    }
    if (room.status === 'settled') {
      this.redirectIfSettled(room)
      return
    }
    const latestPayFrom = (room.players || []).find(p => p.id === payFrom.id) || payFrom
    const latestPayTarget = (room.players || []).find(p => p.id === payTarget.id) || payTarget
    const teaFeePercent = room.teaFeePercent || 0
    const teaCollectMode = room.teaCollectMode || 'immediate'
    const now = new Date().toISOString()
    const opId = generateId()
    room.transactions = room.transactions || []

    room.transactions.push({
      id: generateId(),
      operatorId: latestPayFrom.id,
      operationId: opId,
      operationType: 'pay',
      from: latestPayFrom.id, to: latestPayTarget.id, amount,
      fromName: latestPayFrom.nickname, toName: latestPayTarget.nickname,
      timestamp: now
    })

    const autoTea = teaCollectMode === 'immediate' && teaFeePercent > 0
    const teaFee = autoTea ? Math.floor(amount * teaFeePercent / 100) : 0
    if (teaFee > 0) {
      room.transactions.push({
        id: generateId(),
        operatorId: latestPayFrom.id,
        operationId: opId,
        operationType: 'autoTea',
        from: latestPayTarget.id, to: '__tea__', amount: teaFee,
        fromName: latestPayTarget.nickname, toName: '茶水费',
        timestamp: now
      })
    }

    room.updatedAt = now
    await this.saveRoom(room, { updateFields: ['transactions'] })
    this.setData({ showPayDialog: false, payTarget: null, payFrom: null, payAmount: '' })
    wx.vibrateShort({ type: 'medium' })

    if (amount >= 50) {
      voice.onBigPayment(latestPayFrom.nickname, latestPayTarget.nickname, amount)
    }
    const allPlayers = room.players.filter(p => p.id !== '__tea__' && p.id !== '__table__')
    const netScores = calculateNetScores(room.transactions, room.players)
    allPlayers.forEach(p => {
      const s = netScores[p.id] || 0
      if (s >= 100 && p.id === latestPayTarget.id) voice.onBigWinner(p.nickname, s)
      if (s <= -100 && p.id === latestPayFrom.id) voice.onBigLoser(p.nickname, s)
    })
  },

  // === Tea Fee Panel ===

  onTapTeaFee() {
    if (!this.ensureRoomPlaying()) return
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

  async onSaveTeaSetting() {
    if (!this.ensureRoomPlaying()) return
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
              operatorId: this.data.myPlayerId,
              operationId: generateId(),
              operationType: 'autoTea',
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

    await this.saveRoom(room, {
      updateFields: ['transactions', 'teaFeePercent', 'teaCollectMode', 'lastTeaCollectIdx']
    })
    this.setData({ showTeaPanel: false })
    showToast(teaFeePercent > 0 ? '茶水费' + teaFeePercent + '%（' + (teaCollectMode === 'immediate' ? '立即' : '手动') + '）' : '已关闭茶水费')
  },

  async onCollectTeaFee() {
    if (!this.ensureRoomPlaying()) return
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
    const opId = generateId()
    room.players.forEach(p => {
      if (p.id === '__tea__') return
      if (winnings[p.id] > 0) {
        const fee = Math.floor(winnings[p.id] * teaFeePercent / 100)
        if (fee > 0) {
          room.transactions.push({
            id: generateId(),
            operatorId: this.data.myPlayerId,
            operationId: opId,
            operationType: 'manualTea',
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
    await this.saveRoom(room, { updateFields: ['transactions', 'lastTeaCollectIdx'] })
    wx.vibrateShort({ type: 'heavy' })
    showToast('收取' + totalCollected + '分茶水费')
  },

  // === Table (台面) ===

  onTapTable() {
    if (!this.ensureRoomPlaying()) return
    const { realPlayers, myPlayerId } = this.data
    const me = realPlayers.find(p => p.id === myPlayerId)
    if (!me) return showToast('未识别当前用户')
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

  onTableQuickAmount(e) {
    this.setData({ tableAmount: e.currentTarget.dataset.val })
  },

  onTableAmountInput(e) {
    let val = e.detail.value
    if (parseInt(val) > 99999) val = '99999'
    this.setData({ tableAmount: val })
  },

  async onConfirmTable() {
    if (!this.ensureRoomPlaying()) return
    const { tableDirection, tableFrom, tableAmount, room, tableBalance } = this.data
    const amount = Math.min(parseInt(tableAmount) || 0, 99999)
    if (!amount || amount <= 0) return showToast('请输入有效分数')
    if (!tableFrom) return showToast('请选择玩家')
    if (tableFrom.id !== this.data.myPlayerId) return showToast('只能操作自己的台面')

    if (tableDirection === 'take' && amount > tableBalance) {
      return showToast('台面余额不足（当前' + tableBalance + '分）')
    }

    const now = new Date().toISOString()
    const opId = generateId()
    room.transactions = room.transactions || []

    if (tableDirection === 'pay') {
      room.transactions.push({
        id: generateId(),
        operatorId: tableFrom.id,
        operationId: opId,
        operationType: 'tablePay',
        from: tableFrom.id, to: '__table__', amount,
        fromName: tableFrom.nickname, toName: '台面',
        timestamp: now
      })
    } else {
      room.transactions.push({
        id: generateId(),
        operatorId: tableFrom.id,
        operationId: opId,
        operationType: 'tableTake',
        from: '__table__', to: tableFrom.id, amount,
        fromName: '台面', toName: tableFrom.nickname,
        timestamp: now
      })
    }

    room.updatedAt = now
    await this.saveRoom(room, { updateFields: ['transactions'] })
    this.setData({ showTableDialog: false, tableAmount: '' })
    wx.vibrateShort({ type: 'medium' })
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
    if (!this.ensureRoomPlaying()) return
    const { room, myPlayerId } = this.data
    const txns = room.transactions || []
    if (txns.length === 0) return showToast('没有交易记录')

    const undoRange = this.findMyUndoRange(txns, myPlayerId)
    if (!undoRange) return showToast('没有可撤销的本人操作')
    const undoTxns = txns.slice(undoRange.start, undoRange.end + 1)
    const main = undoTxns.find(t => t.operationType !== 'autoTea') || undoTxns[0]
    let desc = main.fromName + '→' + main.toName + ' ' + main.amount + '分'
    if (undoTxns.length > 1) desc += '（含关联记录）'

    const simTxns = txns.slice(0, undoRange.start).concat(txns.slice(undoRange.end + 1))
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
      success: async (res) => {
        if (!res.confirm) return
        const deletedTransactionIds = txns
          .slice(undoRange.start, undoRange.end + 1)
          .map(tx => tx.id || [tx.timestamp || '', tx.from || '', tx.to || '', tx.amount || 0].join('|'))
          .filter(Boolean)
        room.transactions.splice(undoRange.start, undoRange.end - undoRange.start + 1)
        room.updatedAt = new Date().toISOString()
        await this.saveRoom(room, { deletedTransactionIds, updateFields: ['transactions'] })
        showToast('已撤销')
      }
    })
  },

  findMyUndoRange(txns, myPlayerId) {
    for (let i = txns.length - 1; i >= 0; i--) {
      const tx = txns[i]
      const isOwnOperation = tx.operatorId
        ? tx.operatorId === myPlayerId
        : (tx.from === myPlayerId || tx.to === myPlayerId)
      if (!isOwnOperation) continue

      if (tx.operationId) {
        let start = i
        let end = i
        while (start > 0 && txns[start - 1].operationId === tx.operationId) start--
        while (end < txns.length - 1 && txns[end + 1].operationId === tx.operationId) end++
        const group = txns.slice(start, end + 1)
        const groupOwned = group.every(item => !item.operatorId || item.operatorId === myPlayerId)
        if (groupOwned) return { start, end }
        continue
      }

      if (tx.to === '__tea__' && i > 0 && txns[i - 1].to !== '__tea__') {
        const prev = txns[i - 1]
        const prevOwn = prev.from === myPlayerId || prev.to === myPlayerId
        if (prevOwn) return { start: i - 1, end: i }
      }
      return { start: i, end: i }
    }
    return null
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
      success: async (res) => {
        if (!res.confirm) return
        this._endingGame = true
        const netScores = calculateNetScores(room.transactions, room.players)
        room.status = 'settled'
        room.winner = findWinner(netScores, room.players)
        room.settledAt = new Date().toISOString()
        room.updatedAt = new Date().toISOString()
        this.setData({ room })
        await this.saveRoom(room, { updateFields: ['status', 'winner', 'settledAt'] })
        wx.redirectTo({ url: '/pages/settlement/settlement?id=' + room._id })
      }
    })
  },

  // === Persistence ===

  saveRoom(room, options = {}) {
    // 写本地缓存（支持离线）
    const localRooms = wx.getStorageSync('localRooms') || []
    const idx = localRooms.findIndex(r => r._id === room._id)
    if (idx >= 0) localRooms[idx] = room
    else localRooms.unshift(room)
    wx.setStorageSync('localRooms', localRooms)

    // 通过云函数写云端，避免参与者受数据库权限限制。
    return wx.cloud.callFunction({
      name: 'recordScore',
      data: {
        action: 'saveRoom',
        roomId: room._id,
        deletedTransactionIds: options.deletedTransactionIds || [],
        updateFields: options.updateFields || null,
        room: {
          players: room.players,
          transactions: room.transactions,
          teaFeePercent: room.teaFeePercent,
          teaCollectMode: room.teaCollectMode,
          lastTeaCollectIdx: room.lastTeaCollectIdx,
          status: room.status,
          winner: room.winner || null,
          settledAt: room.settledAt || null,
          updatedAt: room.updatedAt
        }
      }
    }).then(res => {
      if (res.result && res.result.code === 0 && res.result.data) {
        const mergedRoom = res.result.data
        this.cacheRoom(mergedRoom)
        this._updateRoomData(mergedRoom)
      }
      return res
    }).catch(err => {
      console.error('保存房间失败', err)
      showToast('云端保存失败，已保存在本机')
    })
  }
})
