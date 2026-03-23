const { GAME_TYPES, showToast, showLoading, hideLoading, formatRelativeTime, getDefaultAvatar } = require('../../utils/util')
const { calculateNetScores, findWinner } = require('../../utils/settlement')
const { applyTheme } = require('../../utils/theme')

Page({
  data: {
    theme: 'light',
    colors: {},
    room: null,
    currentRound: 0,
    showScoreInput: false,
    currentScores: {},
    scoreSum: 0,
    recording: false
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
    if (this.roomId) {
      this.loadRoom(this.roomId)
    }
  },

  async loadRoom(roomId) {
    try {
      // 先从本地加载
      const localRooms = wx.getStorageSync('localRooms') || []
      let room = localRooms.find(r => r._id === roomId)

      // 尝试云端加载
      try {
        const db = wx.cloud.database()
        const res = await db.collection('rooms').doc(roomId).get()
        if (res.data) {
          room = res.data
        }
      } catch (e) {
        console.warn('云端加载失败，使用本地数据')
      }

      if (!room) {
        showToast('房间不存在')
        setTimeout(() => wx.navigateBack(), 1500)
        return
      }

      const gameInfo = GAME_TYPES[room.gameType] || GAME_TYPES.poker
      room.gameTypeName = gameInfo.name

      const netScores = calculateNetScores(room.rounds || [], room.players)
      let maxScore = -Infinity
      room.players = room.players.map((p, i) => {
        const totalScore = netScores[p.id] || 0
        if (totalScore > maxScore) maxScore = totalScore
        return {
          ...p,
          color: getDefaultAvatar(i),
          totalScore
        }
      })

      room.players.forEach(p => {
        p.isLeading = p.totalScore === maxScore && maxScore > 0
      })

      const currentScores = {}
      room.players.forEach(p => { currentScores[p.id] = '' })

      this.setData({
        room,
        currentRound: (room.rounds || []).length,
        currentScores
      })

      wx.setNavigationBarTitle({ title: room.name })
    } catch (e) {
      console.error('加载房间失败:', e)
      showToast('加载失败')
    }
  },

  onOpenScoreInput() {
    const currentScores = {}
    this.data.room.players.forEach(p => { currentScores[p.id] = '' })
    this.setData({ showScoreInput: true, currentScores, scoreSum: 0 })
  },

  onCloseScoreInput() {
    this.setData({ showScoreInput: false })
  },

  onScoreInput(e) {
    const id = e.currentTarget.dataset.id
    const value = e.detail.value
    const scores = { ...this.data.currentScores }
    scores[id] = value === '' ? '' : parseInt(value) || 0
    const sum = Object.values(scores).reduce((a, b) => a + (parseInt(b) || 0), 0)
    this.setData({ currentScores: scores, scoreSum: sum })
  },

  onQuickScore(e) {
    const { id, delta } = e.currentTarget.dataset
    const scores = { ...this.data.currentScores }
    const current = parseInt(scores[id]) || 0
    scores[id] = current + delta
    const sum = Object.values(scores).reduce((a, b) => a + (parseInt(b) || 0), 0)
    this.setData({ currentScores: scores, scoreSum: sum })
  },

  async onSubmitScore() {
    const { currentScores, room } = this.data
    const scores = {}
    let hasScore = false

    room.players.forEach(p => {
      const val = parseInt(currentScores[p.id]) || 0
      scores[p.id] = val
      if (val !== 0) hasScore = true
    })

    if (!hasScore) {
      showToast('请至少输入一个非零分数')
      return
    }

    const roundNum = (room.rounds || []).length + 1
    const newRound = { roundNum, scores, timestamp: new Date().toISOString() }
    const updatedRounds = [...(room.rounds || []), newRound]

    try {
      // 更新本地存储
      const localRooms = wx.getStorageSync('localRooms') || []
      const idx = localRooms.findIndex(r => r._id === room._id)
      if (idx >= 0) {
        localRooms[idx].rounds = updatedRounds
        localRooms[idx].updatedAt = new Date().toISOString()
        wx.setStorageSync('localRooms', localRooms)
      }

      // 尝试更新云端
      try {
        const db = wx.cloud.database()
        await db.collection('rooms').doc(room._id).update({
          data: {
            rounds: updatedRounds,
            updatedAt: new Date().toISOString()
          }
        })
      } catch (e) {
        console.warn('云端更新失败')
      }

      this.setData({ showScoreInput: false })
      wx.vibrateShort({ type: 'medium' })
      this.loadRoom(room._id)
    } catch (e) {
      console.error('记录失败:', e)
      showToast('记录失败')
    }
  },

  onUndo() {
    wx.showModal({
      title: '撤销确认',
      content: '确定撤销最后一局的记录吗？',
      success: async (res) => {
        if (!res.confirm) return
        const { room } = this.data
        const updatedRounds = room.rounds.slice(0, -1)

        const localRooms = wx.getStorageSync('localRooms') || []
        const idx = localRooms.findIndex(r => r._id === room._id)
        if (idx >= 0) {
          localRooms[idx].rounds = updatedRounds
          localRooms[idx].updatedAt = new Date().toISOString()
          wx.setStorageSync('localRooms', localRooms)
        }

        try {
          const db = wx.cloud.database()
          await db.collection('rooms').doc(room._id).update({
            data: { rounds: updatedRounds, updatedAt: new Date().toISOString() }
          })
        } catch (e) {}

        showToast('已撤销')
        this.loadRoom(room._id)
      }
    })
  },

  onVoiceScore() {
    if (this.data.recording) {
      this.stopVoiceRecord()
      return
    }

    const recorderManager = wx.getRecorderManager()
    this.recorderManager = recorderManager

    recorderManager.onStop((res) => {
      this.setData({ recording: false })
      showToast('语音识别功能需配置同声传译插件')
    })

    recorderManager.onError((err) => {
      this.setData({ recording: false })
      showToast('录音失败')
    })

    wx.authorize({
      scope: 'scope.record',
      success: () => {
        recorderManager.start({ duration: 10000, sampleRate: 16000, numberOfChannels: 1, format: 'mp3' })
        this.setData({ recording: true })
        showToast('正在录音，再次点击停止')
      },
      fail: () => showToast('请授权录音权限')
    })
  },

  stopVoiceRecord() {
    if (this.recorderManager) {
      this.recorderManager.stop()
    }
    this.setData({ recording: false })
  },

  onEndGame() {
    wx.showModal({
      title: '结束牌局',
      content: `确定要结束牌局吗？已进行${this.data.currentRound}局。`,
      confirmText: '结束结算',
      confirmColor: '#1A6B4A',
      success: async (res) => {
        if (!res.confirm) return

        const { room } = this.data
        const netScores = calculateNetScores(room.rounds, room.players)
        const winner = findWinner(netScores, room.players)

        const localRooms = wx.getStorageSync('localRooms') || []
        const idx = localRooms.findIndex(r => r._id === room._id)
        if (idx >= 0) {
          localRooms[idx].status = 'settled'
          localRooms[idx].winner = winner
          localRooms[idx].updatedAt = new Date().toISOString()
          wx.setStorageSync('localRooms', localRooms)
        }

        try {
          const db = wx.cloud.database()
          await db.collection('rooms').doc(room._id).update({
            data: {
              status: 'settled',
              winner: winner,
              updatedAt: new Date().toISOString()
            }
          })
        } catch (e) {}

        wx.redirectTo({ url: `/pages/settlement/settlement?id=${room._id}` })
      }
    })
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
      title: `来加入「${room.name}」牌局吧！`,
      path: `/pages/join/join?code=${room.shareCode}`
    }
  },

  onTapPlayer(e) {
    const index = e.currentTarget.dataset.index
    const player = this.data.room.players[index]
    if (!this.data.showScoreInput) return
  }
})
