const { showToast, showLoading, hideLoading } = require('../../utils/util')
const { applyTheme } = require('../../utils/theme')

Page({
  data: {
    theme: 'light',
    colors: {},
    shareCode: '',
    codeChars: [],
    codeLength: 0,
    joining: false
  },

  onLoad(options) {
    applyTheme(this)
    let code = options.code || ''
    if (!code && options.scene) {
      const scene = decodeURIComponent(options.scene)
      const match = scene.match(/code=([^&]+)/)
      if (match) code = match[1]
    }
    if (code) {
      this.setData({
        shareCode: code,
        codeChars: code.split(''),
        codeLength: code.length
      })
    }
  },

  onCodeInput(e) {
    const value = e.detail.value.toUpperCase()
    this.setData({
      shareCode: value,
      codeChars: value.split(''),
      codeLength: value.length
    })
  },

  async onJoinRoom() {
    const { shareCode } = this.data
    if (shareCode.length !== 6) {
      showToast('请输入完整的6位房间码')
      return
    }

    this.setData({ joining: true })
    showLoading('加入中...')

    // 先查本地
    const localRooms = wx.getStorageSync('localRooms') || []
    const localRoom = localRooms.find(r => r.shareCode === shareCode && r.status === 'playing')
    if (localRoom) {
      hideLoading()
      this.setData({ joining: false })
      wx.redirectTo({ url: '/pages/room/room?id=' + localRoom._id })
      return
    }

    // 再查云端
    const env = require('../../config/env')
    if (wx.cloud && env.CLOUD_ENV_ID) {
      try {
        const db = wx.cloud.database()
        const res = await db.collection('rooms')
          .where({ shareCode: shareCode, status: 'playing' })
          .get()

        if (res.data.length > 0) {
          const room = res.data[0]
          hideLoading()
          this.setData({ joining: false })
          wx.redirectTo({ url: '/pages/room/room?id=' + room._id })
          return
        }
      } catch (e) {
        console.warn('云查询失败:', e)
      }
    }

    hideLoading()
    showToast('未找到该房间')
    this.setData({ joining: false })
  },

  onScanCode() {
    wx.scanCode({
      success: (res) => {
        const result = res.result
        const codeMatch = result.match(/code=([A-Z0-9]{6})/)
        if (codeMatch) {
          this.setData({
            shareCode: codeMatch[1],
            codeChars: codeMatch[1].split(''),
            codeLength: 6
          })
          this.onJoinRoom()
        } else {
          showToast('无效的二维码')
        }
      }
    })
  }
})
