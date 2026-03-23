/**
 * 主题管理模块
 */

const THEMES = {
  light: {
    primary: '#1A6B4A',
    primaryLight: '#2E8B63',
    accent: '#D4A72C',
    background: '#FAFAF5',
    cardBg: '#FFFFFF',
    textPrimary: '#2D2D2D',
    textSecondary: '#888888',
    border: '#E8E8E0',
    success: '#22C55E',
    danger: '#EF4444',
    navBg: '#1A6B4A',
    navText: '#FFFFFF',
    tabBg: '#FFFFFF'
  },
  dark: {
    primary: '#00D09C',
    primaryLight: '#00B386',
    accent: '#FFD700',
    background: '#1A1A2E',
    cardBg: '#252540',
    textPrimary: '#E8E8E8',
    textSecondary: '#8888AA',
    border: '#353555',
    success: '#00D09C',
    danger: '#FF6B6B',
    navBg: '#16213E',
    navText: '#E8E8E8',
    tabBg: '#1A1A2E'
  }
}

const applyTheme = (pageInstance) => {
  const app = getApp()
  const theme = app.globalData.theme || 'light'
  const colors = THEMES[theme]

  pageInstance.setData({ theme, colors })

  if (theme === 'dark') {
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: THEMES.dark.navBg,
      animation: { duration: 300, timingFunc: 'easeIn' }
    })
  } else {
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: THEMES.light.navBg,
      animation: { duration: 300, timingFunc: 'easeIn' }
    })
  }
}

const getTheme = () => {
  const app = getApp()
  return app.globalData.theme || 'light'
}

const getColors = () => {
  const theme = getTheme()
  return THEMES[theme]
}

module.exports = {
  THEMES,
  applyTheme,
  getTheme,
  getColors
}
