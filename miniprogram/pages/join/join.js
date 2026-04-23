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

    // 直接查云端
    const db = wx.cloud.database()
    try {
      const res = await db.collection('rooms')
        .where({ shareCode: shareCode, status: 'playing' })
        .get()

      if (res.data.length > 0) {
        const room = res.data[0]
        // 写入本地缓存，支持离线访问
        const localRooms = wx.getStorageSync('localRooms') || []
        const existIdx = localRooms.findIndex(r => r._id === room._id)
        if (existIdx >= 0) localRooms[existIdx] = room
        else localRooms.unshift(room)
        wx.setStorageSync('localRooms', localRooms)

        hideLoading()
        this.setData({ joining: false })
        wx.redirectTo({ url: '/pages/room/room?id=' + room._id })
        return
      }
    } catch (e) {
      console.warn('云查询失败:', e)
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
