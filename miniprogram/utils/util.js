const formatTime = date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  return `${year}-${padZero(month)}-${padZero(day)} ${padZero(hour)}:${padZero(minute)}`
}

const formatDate = date => {
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${padZero(month)}月${padZero(day)}日`
}

const formatRelativeTime = date => {
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return formatTime(date)
}

const padZero = n => (n < 10 ? '0' + n : '' + n)

const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

const getClientId = () => {
  let clientId = wx.getStorageSync('clientId')
  if (!clientId) {
    clientId = generateId()
    wx.setStorageSync('clientId', clientId)
  }
  return clientId
}

const GAME_TYPES = {
  mahjong: { name: '麻将', icon: '🀄', players: [3, 4], defaultPlayers: 4 },
  guandan: { name: '掼蛋', icon: '🃏', players: [4], defaultPlayers: 4 },
  doudizhu: { name: '斗地主', icon: '🂡', players: [3], defaultPlayers: 3 },
  paodekuai: { name: '跑得快', icon: '🂮', players: [3, 4], defaultPlayers: 4 },
  poker: { name: '扑克', icon: '🎴', players: [2, 3, 4, 5, 6, 7, 8], defaultPlayers: 4 }
}

const getDefaultAvatar = (index) => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
  return colors[index % colors.length]
}

const showToast = (title, icon = 'none') => {
  wx.showToast({ title, icon, duration: 2000 })
}

const showLoading = (title = '加载中...') => {
  wx.showLoading({ title, mask: true })
}

const hideLoading = () => {
  wx.hideLoading()
}

const isCloudFileId = path => !!path && path.startsWith('cloud://')

const isHttpUrl = path => /^https?:\/\//i.test(path || '')

const isWxTempFilePath = path => {
  if (!path) return false
  return path.startsWith('wxfile://') ||
    path.startsWith('file://') ||
    /^https?:\/\/tmp\//i.test(path) ||
    /^https?:\/\/usr\//i.test(path)
}

const isLocalFilePath = path => {
  if (!path || isCloudFileId(path)) return false
  if (isWxTempFilePath(path)) return true
  return !isHttpUrl(path)
}

const ensureCloudAvatar = async (avatarUrl, ownerId = 'user') => {
  if (!isLocalFilePath(avatarUrl)) return avatarUrl || ''
  if (!wx.cloud || typeof wx.cloud.uploadFile !== 'function') return avatarUrl

  const extMatch = avatarUrl.match(/\.(jpg|jpeg|png|webp|gif)(?:\?|$)/i)
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg'
  const safeOwner = String(ownerId || 'user').replace(/[^a-zA-Z0-9_-]/g, '')
  const cloudPath = `avatars/${safeOwner || 'user'}-${Date.now()}.${ext}`
  const res = await wx.cloud.uploadFile({ cloudPath, filePath: avatarUrl })
  return res.fileID || avatarUrl
}

const resolveCloudFileUrls = async (urls) => {
  const cloudUrls = [...new Set((urls || []).filter(url => url && url.startsWith('cloud://')))]
  if (cloudUrls.length === 0) return {}
  if (!wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') return {}

  const res = await wx.cloud.getTempFileURL({ fileList: cloudUrls })
  const map = {}
  ;(res.fileList || []).forEach(item => {
    if (item.fileID && item.tempFileURL) map[item.fileID] = item.tempFileURL
    else if (item.fileID) console.warn('resolve cloud file url failed', item.fileID, item.status, item.errMsg)
  })
  return map
}

const isRenderableImageUrl = url => {
  if (!url) return false
  return isHttpUrl(url) && !isWxTempFilePath(url)
}

module.exports = {
  formatTime,
  formatDate,
  formatRelativeTime,
  generateId,
  getClientId,
  ensureCloudAvatar,
  resolveCloudFileUrls,
  isRenderableImageUrl,
  GAME_TYPES,
  getDefaultAvatar,
  showToast,
  showLoading,
  hideLoading
}
