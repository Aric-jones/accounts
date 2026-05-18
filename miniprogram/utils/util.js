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

const logAvatar = (stage, detail = {}) => {
  console.log('[avatar]', stage, detail)
}

const isCloudFileId = path => !!path && path.startsWith('cloud://')

const isHttpUrl = path => /^https?:\/\//i.test(path || '')

const isTemporaryCloudHttpUrl = path => {
  if (!isHttpUrl(path)) return false
  return /\.tcb\.qcloud\.la\//i.test(path) && /[?&]sign=/i.test(path)
}

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

const isStableAvatarUrl = path => {
  if (!path) return false
  if (isCloudFileId(path)) return true
  if (!isHttpUrl(path)) return false
  return !isWxTempFilePath(path) && !isTemporaryCloudHttpUrl(path)
}

const ensureCloudAvatar = async (avatarUrl, ownerId = 'user') => {
  const shouldUpload = isLocalFilePath(avatarUrl)
  logAvatar('ensureCloudAvatar:start', {
    avatarUrl,
    ownerId,
    shouldUpload,
    isCloudFileId: isCloudFileId(avatarUrl),
    isHttpUrl: isHttpUrl(avatarUrl),
    isWxTempFilePath: isWxTempFilePath(avatarUrl),
    hasCloudUpload: !!(wx.cloud && typeof wx.cloud.uploadFile === 'function')
  })

  if (isTemporaryCloudHttpUrl(avatarUrl)) {
    logAvatar('ensureCloudAvatar:skip', { reason: 'expired-or-temporary-cloud-http-url', avatarUrl })
    return ''
  }
  if (!shouldUpload) {
    logAvatar('ensureCloudAvatar:skip', { reason: 'not-local-file-path', avatarUrl })
    return avatarUrl || ''
  }
  if (!wx.cloud || typeof wx.cloud.uploadFile !== 'function') {
    logAvatar('ensureCloudAvatar:skip', { reason: 'wx.cloud.uploadFile-unavailable', avatarUrl })
    return avatarUrl
  }

  const extMatch = avatarUrl.match(/\.(jpg|jpeg|png|webp|gif)(?:\?|$)/i)
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg'
  const safeOwner = String(ownerId || 'user').replace(/[^a-zA-Z0-9_-]/g, '')
  const cloudPath = `avatars/${safeOwner || 'user'}-${Date.now()}.${ext}`
  logAvatar('ensureCloudAvatar:upload', { cloudPath, filePath: avatarUrl })
  try {
    const res = await wx.cloud.uploadFile({ cloudPath, filePath: avatarUrl })
    logAvatar('ensureCloudAvatar:success', { cloudPath, fileID: res.fileID, raw: res })
    return res.fileID || avatarUrl
  } catch (err) {
    logAvatar('ensureCloudAvatar:fail', { cloudPath, filePath: avatarUrl, err })
    throw err
  }
}

const ensureHttpAvatar = async (avatarUrl, ownerId = 'user') => {
  logAvatar('ensureHttpAvatar:start', { avatarUrl, ownerId })
  const profile = await ensureHttpAvatarProfile(avatarUrl, ownerId)
  logAvatar('ensureHttpAvatar:done', { avatarUrl, profile })
  return profile.avatarUrl || ''
}

const ensureHttpAvatarProfile = async (avatarUrl, ownerId = 'user') => {
  const storedAvatarUrl = await ensureCloudAvatar(avatarUrl, ownerId)
  const avatarFileId = isCloudFileId(storedAvatarUrl) ? storedAvatarUrl : ''
  if (avatarFileId) {
    try {
      const map = await resolveCloudFileUrls([avatarFileId])
      return {
        avatarUrl: (map && map[avatarFileId]) || '',
        avatarFileId
      }
    } catch (err) {
      logAvatar('ensureHttpAvatarProfile:resolve-fail', { avatarFileId, err })
      return { avatarUrl: '', avatarFileId }
    }
  }
  if (isRenderableImageUrl(storedAvatarUrl)) {
    return { avatarUrl: storedAvatarUrl, avatarFileId: '' }
  }
  return { avatarUrl: '', avatarFileId: '' }
}

const resolveCloudFileUrls = async (urls) => {
  const cloudUrls = [...new Set((urls || []).filter(url => url && url.startsWith('cloud://')))]
  logAvatar('resolveCloudFileUrls:start', {
    inputCount: (urls || []).length,
    cloudUrls,
    hasGetTempFileURL: !!(wx.cloud && typeof wx.cloud.getTempFileURL === 'function')
  })
  if (cloudUrls.length === 0) return {}
  if (!wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') {
    logAvatar('resolveCloudFileUrls:skip', { reason: 'wx.cloud.getTempFileURL-unavailable' })
    return {}
  }

  try {
    const res = await wx.cloud.getTempFileURL({ fileList: cloudUrls })
    const map = {}
    ;(res.fileList || []).forEach(item => {
      if (item.fileID && item.tempFileURL) {
        map[item.fileID] = item.tempFileURL
        logAvatar('resolveCloudFileUrls:item-success', {
          fileID: item.fileID,
          tempFileURL: item.tempFileURL,
          status: item.status
        })
      } else if (item.fileID) {
        console.warn('resolve cloud file url failed', item.fileID, item.status, item.errMsg)
        logAvatar('resolveCloudFileUrls:item-fail', {
          fileID: item.fileID,
          status: item.status,
          errMsg: item.errMsg
        })
      }
    })
    logAvatar('resolveCloudFileUrls:done', { resolvedCount: Object.keys(map).length, raw: res })
    return map
  } catch (err) {
    logAvatar('resolveCloudFileUrls:fail', { cloudUrls, err })
    throw err
  }
}

const isRenderableImageUrl = url => {
  if (!url) return false
  if (isTemporaryCloudHttpUrl(url)) return false
  return isHttpUrl(url)
}

const isPreviewableImageUrl = url => {
  if (!url) return false
  return isWxTempFilePath(url) || isRenderableImageUrl(url)
}

const hasResolvedCloudAvatar = (avatarUrl, displayAvatarUrl) => {
  return isCloudFileId(avatarUrl) && !!displayAvatarUrl && displayAvatarUrl !== avatarUrl
}

const shouldRenderAvatar = (avatarUrl, displayAvatarUrl, allowLocalPreview = false) => {
  if (!displayAvatarUrl) return false
  if (hasResolvedCloudAvatar(avatarUrl, displayAvatarUrl)) return isPreviewableImageUrl(displayAvatarUrl)
  if (isWxTempFilePath(avatarUrl)) return allowLocalPreview && isPreviewableImageUrl(displayAvatarUrl)
  return isRenderableImageUrl(displayAvatarUrl)
}

const saveGlobalUserProfile = async (profile = {}) => {
  const avatarFileId = isCloudFileId(profile.avatarFileId)
    ? profile.avatarFileId
    : (isCloudFileId(profile.avatarUrl) ? profile.avatarUrl : '')
  const avatarUrl = isHttpUrl(profile.avatarUrl) &&
    !isWxTempFilePath(profile.avatarUrl) &&
    (!isTemporaryCloudHttpUrl(profile.avatarUrl) || avatarFileId)
    ? profile.avatarUrl
    : ''
  const data = {
    nickName: profile.nickName || '',
    avatarUrl,
    avatarFileId,
    clientId: profile.clientId || getClientId()
  }
  logAvatar('saveGlobalUserProfile:start', data)
  if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    logAvatar('saveGlobalUserProfile:skip', { reason: 'wx.cloud.callFunction-unavailable', data })
    return null
  }
  try {
    const res = await wx.cloud.callFunction({
      name: 'recordScore',
      data: {
        action: 'saveUserProfile',
        profile: data
      }
    })
    logAvatar('saveGlobalUserProfile:result', res.result || res)
    return res.result
  } catch (err) {
    logAvatar('saveGlobalUserProfile:fail', { data, err })
    throw err
  }
}

const fetchGlobalUserProfiles = async (openids = []) => {
  const list = [...new Set((openids || []).filter(Boolean))]
  logAvatar('fetchGlobalUserProfiles:start', { openids: list })
  if (list.length === 0) return {}
  if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
    logAvatar('fetchGlobalUserProfiles:skip', { reason: 'wx.cloud.callFunction-unavailable', openids: list })
    return {}
  }
  try {
    const res = await wx.cloud.callFunction({
      name: 'recordScore',
      data: {
        action: 'getUserProfiles',
        openids: list
      }
    })
    const map = {}
    ;((res.result && res.result.data) || []).forEach(item => {
      if (item && item.openid) map[item.openid] = item
    })
    logAvatar('fetchGlobalUserProfiles:result', { count: Object.keys(map).length, map })
    return map
  } catch (err) {
    logAvatar('fetchGlobalUserProfiles:fail', { openids: list, err })
    return {}
  }
}

module.exports = {
  formatTime,
  formatDate,
  formatRelativeTime,
  generateId,
  getClientId,
  ensureCloudAvatar,
  ensureHttpAvatar,
  ensureHttpAvatarProfile,
  resolveCloudFileUrls,
  isTemporaryCloudHttpUrl,
  isStableAvatarUrl,
  isRenderableImageUrl,
  isPreviewableImageUrl,
  shouldRenderAvatar,
  saveGlobalUserProfile,
  fetchGlobalUserProfiles,
  GAME_TYPES,
  getDefaultAvatar,
  showToast,
  showLoading,
  hideLoading
}
