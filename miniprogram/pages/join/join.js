const { generateId, getClientId, ensureHttpAvatarProfile, saveGlobalUserProfile, showToast, showLoading, hideLoading } = require('../../utils/util')
const { applyTheme } = require('../../utils/theme')

Page({
  data: {
    theme: 'light',
    colors: {},
    shareCode: '',
    codeChars: [],
    codeLength: 0,
    inputFocus: true,
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

  focusCodeInput() {
    this.setData({ inputFocus: false })
    wx.nextTick(() => {
      this.setData({ inputFocus: true })
    })
  },

  onCodeBlur() {
    this.setData({ inputFocus: false })
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
      const app = getApp()
      const userInfo = wx.getStorageSync('userInfo') || {}
      const clientId = getClientId()
      let avatarUrl = userInfo.avatarUrl || ''
      let avatarFileId = userInfo.avatarFileId || ''
      console.log('[avatar][join] before-upload', {
        shareCode,
        clientId,
        openid: app.globalData.openid || '',
        avatarUrl,
        userInfo
      })
      try {
        const avatarProfile = await ensureHttpAvatarProfile(avatarFileId || avatarUrl, clientId)
        avatarUrl = avatarProfile.avatarUrl || ''
        avatarFileId = avatarProfile.avatarFileId || avatarFileId || ''
        console.log('[avatar][join] upload-result', {
          shareCode,
          clientId,
          inputAvatarUrl: userInfo.avatarUrl || '',
          savedAvatarUrl: avatarUrl,
          avatarFileId,
          uploadSucceeded: avatarUrl !== (userInfo.avatarUrl || '')
        })
        if (avatarUrl !== userInfo.avatarUrl || avatarFileId !== userInfo.avatarFileId) {
          const nextUserInfo = { ...userInfo, avatarUrl, avatarFileId }
          wx.setStorageSync('userInfo', nextUserInfo)
          app.globalData.userInfo = nextUserInfo
        }
      } catch (err) {
        console.warn('upload avatar failed', err)
        console.log('[avatar][join] upload-fail', { shareCode, clientId, avatarUrl, err })
      }
      saveGlobalUserProfile({
        nickName: userInfo.nickName || '',
        avatarUrl,
        avatarFileId,
        clientId
      }).catch(err => console.warn('save global profile failed', err))
      const player = {
        id: generateId(),
        nickname: userInfo.nickName || '牌友',
        avatarUrl,
        avatarFileId,
        clientId,
        openid: app.globalData.openid || ''
      }
      console.log('[avatar][join] player-avatar', {
        shareCode,
        playerId: player.id,
        avatarUrl: player.avatarUrl,
        nickname: player.nickname
      })
      const res = await wx.cloud.callFunction({
        name: 'joinRoom',
        data: { shareCode, player }
      })

      if (res.result && res.result.code === 0 && res.result.data) {
        const room = res.result.data
        const myPlayerId = res.result.myPlayerId
        // 写入本地缓存，支持离线访问
        const localRooms = wx.getStorageSync('localRooms') || []
        const existIdx = localRooms.findIndex(r => r._id === room._id)
        if (existIdx >= 0) localRooms[existIdx] = room
        else localRooms.unshift(room)
        wx.setStorageSync('localRooms', localRooms)

        if (myPlayerId) {
          const roomPlayerIds = wx.getStorageSync('roomPlayerIds') || {}
          roomPlayerIds[room._id] = myPlayerId
          wx.setStorageSync('roomPlayerIds', roomPlayerIds)
        }

        hideLoading()
        this.setData({ joining: false })
        wx.redirectTo({ url: '/pages/room/room?id=' + room._id })
        return
      }
      console.warn('加入房间失败:', res.result)
    } catch (e) {
      console.warn('云加入失败:', e)
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
