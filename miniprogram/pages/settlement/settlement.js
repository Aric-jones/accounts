const { GAME_TYPES, getDefaultAvatar, showToast, resolveCloudFileUrls, shouldRenderAvatar } = require('../../utils/util')
const { calculateNetScores, calculateOptimalTransfers, generateRankings, findWinner, calculateStats } = require('../../utils/settlement')
const { generateLocalSummary, generateAISummary, generatePlayerComment } = require('../../utils/ai')
const { applyTheme } = require('../../utils/theme')

Page({
  data: {
    theme: 'light',
    colors: {},
    room: null,
    winner: null,
    rankings: [],
    transfers: [],
    txnCount: 0,
    unitPrice: 1,
    aiSummary: ''
  },

  onLoad(options) {
    applyTheme(this)
    this.avatarUrlMap = {}
    if (options.id) {
      this.loadSettlement(options.id)
    }
  },

  async loadSettlement(roomId) {
    try {
      const localRooms = wx.getStorageSync('localRooms') || []
      let room = localRooms.find(r => r._id === roomId)

      try {
        const db = wx.cloud.database()
        const res = await db.collection('rooms').doc(roomId).get()
        if (res.data) room = res.data
      } catch (e) {}

      if (!room) {
        showToast('房间不存在')
        return
      }

      const allPlayers = room.players.map((p, i) => {
        const displayAvatarUrl = this.getDisplayAvatarUrl(p.avatarUrl)
        return {
          ...p,
          displayAvatarUrl,
          hasDisplayAvatar: shouldRenderAvatar(p.avatarUrl, displayAvatarUrl),
          color: getDefaultAvatar(i)
        }
      })
      const players = allPlayers.filter(p => p.id !== '__tea__' && p.id !== '__table__')

      const scoreData = room.transactions || room.rounds || []
      const netScores = calculateNetScores(scoreData, allPlayers)
      const teaFeeCollected = netScores['__tea__'] || 0
      const rankings = generateRankings(netScores, players)
      const winner = findWinner(netScores, players)
      const unitPrice = room.unitPrice || 1
      const transfers = calculateOptimalTransfers(netScores, players, unitPrice)

      transfers.forEach(t => {
        const fromPlayer = players.find(p => p.id === t.from.id)
        const toPlayer = players.find(p => p.id === t.to.id)
        if (fromPlayer) {
          t.from.color = fromPlayer.avatarColor || fromPlayer.color
          t.from.avatarUrl = fromPlayer.avatarUrl || ''
          t.from.displayAvatarUrl = fromPlayer.displayAvatarUrl || ''
          t.from.hasDisplayAvatar = fromPlayer.hasDisplayAvatar || false
        }
        if (toPlayer) {
          t.to.color = toPlayer.avatarColor || toPlayer.color
          t.to.avatarUrl = toPlayer.avatarUrl || ''
          t.to.displayAvatarUrl = toPlayer.displayAvatarUrl || ''
          t.to.hasDisplayAvatar = toPlayer.hasDisplayAvatar || false
        }
      })

      if (winner) {
        const wp = players.find(p => p.id === winner.id)
        if (wp) {
          winner.color = wp.color
          winner.displayAvatarUrl = wp.displayAvatarUrl
          winner.hasDisplayAvatar = wp.hasDisplayAvatar
        }
      }

      const gameInfo = GAME_TYPES[room.gameType] || GAME_TYPES.poker
      const totalCount = room.transactions ? room.transactions.length : (room.rounds || []).length

      const rankingsDisplay = rankings.map(r => {
        const player = players.find(p => p.id === r.id) || {}
        return {
          ...r,
          displayAvatarUrl: player.displayAvatarUrl || '',
          hasDisplayAvatar: player.hasDisplayAvatar || false,
          scorePrefix: r.totalScore > 0 ? '+' : '',
          amountText: (r.totalScore > 0 ? '+' : '') + (Math.round(r.totalScore * unitPrice * 10) / 10)
        }
      })

      this.setData({
        room: { ...room, gameTypeName: gameInfo.name },
        winner,
        rankings: rankingsDisplay,
        transfers,
        txnCount: totalCount,
        unitPrice,
        teaFeeCollected
      })

      this.generateSummary(room, players, netScores, rankings)
      this.resolveSettlementAvatarUrls(room)
    } catch (e) {
      console.error('加载结算失败:', e)
      showToast('加载失败')
    }
  },

  getDisplayAvatarUrl(avatarUrl) {
    if (!avatarUrl) return ''
    return (this.avatarUrlMap && this.avatarUrlMap[avatarUrl]) || avatarUrl
  },

  resolveSettlementAvatarUrls(room) {
    const urls = (room.players || [])
      .map(player => player.avatarUrl)
      .filter(url => url && url.startsWith('cloud://') && !(this.avatarUrlMap && this.avatarUrlMap[url]))
    if (urls.length === 0) return
    resolveCloudFileUrls(urls).then(map => {
      if (!map || Object.keys(map).length === 0) return
      this.avatarUrlMap = { ...(this.avatarUrlMap || {}), ...map }
      this.loadSettlement(room._id)
    }).catch(err => {
      console.warn('resolve settlement avatar urls failed', err)
    })
  },

  async generateSummary(room, players, netScores, rankings) {
    const roomData = {
      players,
      rounds: room.rounds || [],
      transactions: room.transactions || [],
      gameType: room.gameType,
      netScores,
      rankings
    }

    const localSummary = generateLocalSummary(roomData)
    this.setData({ aiSummary: localSummary })

    try {
      const aiSummary = await generateAISummary(roomData)
      if (aiSummary && aiSummary !== localSummary) {
        this.setData({ aiSummary })
      }
    } catch (e) {}
  },

  onSharePoster() {
    wx.navigateTo({
      url: `/pages/settlement/settlement?id=${this.data.room._id}&showPoster=1`,
      fail: () => {
        this.onShareAppMessage()
      }
    })
    showToast('海报生成功能开发中')
  },

  onPlayAgain() {
    wx.redirectTo({ url: '/pages/create/create' })
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onShareAppMessage() {
    const { room, winner, txnCount } = this.data
    return {
      title: `${room.name}结算：${winner ? winner.nickname + '获胜！' : ''}共${txnCount}笔`,
      path: `/pages/settlement/settlement?id=${room._id}`
    }
  }
})
