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

    try {
      const db = wx.cloud.database()
      const res = await db.collection('rooms')
        .where({ shareCode: shareCode, status: 'playing' })
        .get()

      if (res.data.length === 0) {
        // 尝试本地查找
        const localRooms = wx.getStorageSync('localRooms') || []
        const localRoom = localRooms.find(r => r.shareCode === shareCode && r.status === 'playing')
        if (localRoom) {
          hideLoading()
          const myRoomIds = wx.getStorageSync('myRoomIds') || []
          if (!myRoomIds.includes(localRoom._id)) {
            myRoomIds.unshift(localRoom._id)
            wx.setStorageSync('myRoomIds', myRoomIds)
          }
          wx.redirectTo({ url: `/pages/room/room?id=${localRoom._id}` })
          return
        }
        hideLoading()
        showToast('未找到该房间')
        this.setData({ joining: false })
        return
      }

      const room = res.data[0]
      const myRoomIds = wx.getStorageSync('myRoomIds') || []
      if (!myRoomIds.includes(room._id)) {
        myRoomIds.unshift(room._id)
        wx.setStorageSync('myRoomIds', myRoomIds)
      }

      hideLoading()
      wx.redirectTo({ url: `/pages/room/room?id=${room._id}` })
    } catch (e) {
      hideLoading()
      console.error('加入房间失败:', e)
      showToast('加入失败，请重试')
    }
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
