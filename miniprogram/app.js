App({
  onLaunch() {
    if (wx.cloud) {
      try {
        wx.cloud.init({ traceUser: true })
      } catch (e) {
        console.warn('云开发初始化失败，将使用本地存储模式', e)
      }
    }
    this.loadTheme()
    this.getUserProfile()
  },

  globalData: {
    userInfo: null,
    openid: '',
    theme: 'light',
    themeColors: {
      light: {
        primary: '#1A6B4A',
        primaryGradient: 'linear-gradient(135deg, #1A6B4A 0%, #2E8B63 100%)',
        accent: '#D4A72C',
        background: '#FAFAF5',
        cardBg: '#FFFFFF',
        textPrimary: '#2D2D2D',
        textSecondary: '#888888',
        border: '#E8E8E0',
        success: '#22C55E',
        danger: '#EF4444',
        shadow: 'rgba(0,0,0,0.06)'
      },
      dark: {
        primary: '#00D09C',
        primaryGradient: 'linear-gradient(135deg, #00D09C 0%, #00B386 100%)',
        accent: '#FFD700',
        background: '#1A1A2E',
        cardBg: '#252540',
        textPrimary: '#E8E8E8',
        textSecondary: '#8888AA',
        border: '#353555',
        success: '#00D09C',
        danger: '#FF6B6B',
        shadow: 'rgba(0,0,0,0.3)'
      }
    }
  },

  loadTheme() {
    const theme = wx.getStorageSync('theme') || 'light'
    this.globalData.theme = theme
  },

  toggleTheme() {
    const newTheme = this.globalData.theme === 'light' ? 'dark' : 'light'
    this.globalData.theme = newTheme
    wx.setStorageSync('theme', newTheme)
    return newTheme
  },

  getThemeColors() {
    return this.globalData.themeColors[this.globalData.theme]
  },

  getUserProfile() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.globalData.userInfo = userInfo
    }
    if (wx.cloud) {
      wx.cloud.callFunction({ name: 'getHistory', data: { action: 'getOpenid' } })
        .then(res => {
          if (res.result && res.result.openid) {
            this.globalData.openid = res.result.openid
          }
        })
        .catch(() => {})
    }
  },

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }
})
