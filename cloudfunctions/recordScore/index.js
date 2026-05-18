const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { roomId, roundScores, action, room = {}, deletedTransactionIds = [], updateFields = null, profile = {}, openids = [] } = event

  try {
    if (action === 'saveUserProfile') {
      if (!wxContext.OPENID) return { code: -1, errMsg: 'openid missing' }
      await ensureCollection('userProfiles')
      const now = new Date()
      const avatarProfile = await normalizeAvatarProfile(profile)
      const data = {
        openid: wxContext.OPENID,
        nickName: profile.nickName || '',
        avatarUrl: avatarProfile.avatarUrl,
        avatarFileId: avatarProfile.avatarFileId,
        clientId: profile.clientId || '',
        updatedAt: now
      }
      const exist = await db.collection('userProfiles')
        .where({ openid: wxContext.OPENID })
        .limit(1)
        .get()
      if (exist.data && exist.data.length > 0) {
        await db.collection('userProfiles').doc(exist.data[0]._id).update({ data })
        return { code: 0, data: { ...exist.data[0], ...data } }
      }
      const addRes = await db.collection('userProfiles').add({
        data: {
          ...data,
          createdAt: now
        }
      })
      return { code: 0, data: { _id: addRes._id, ...data, createdAt: now } }
    }

    if (action === 'getUserProfiles') {
      await ensureCollection('userProfiles')
      const list = [...new Set((openids || []).filter(Boolean))]
      if (list.length === 0) return { code: 0, data: [] }
      const res = await db.collection('userProfiles')
        .where({ openid: _.in(list) })
        .get()
      const data = await refreshProfileAvatarUrls(res.data || [])
      return { code: 0, data }
    }

    if (action === 'saveRoom') {
      const docRes = await db.collection('rooms').doc(roomId).get()
      const current = docRes.data || {}
      const mergedRoom = mergeRoom(current, room, deletedTransactionIds)
      const deleted = (deletedTransactionIds || []).length > 0
      const currentKeys = new Set((current.transactions || []).map(txnKey).filter(Boolean))
      const newTransactions = (room.transactions || []).filter(txn => {
        const key = txnKey(txn)
        return key && !currentKeys.has(key)
      })
      const updateData = {
        updatedAt: mergedRoom.updatedAt
      }
      const fields = Array.isArray(updateFields) ? new Set(updateFields) : null
      const canUpdate = field => !fields || fields.has(field)

      if (canUpdate('players')) updateData.players = mergedRoom.players
      if (canUpdate('teaFeePercent')) updateData.teaFeePercent = mergedRoom.teaFeePercent
      if (canUpdate('teaCollectMode')) updateData.teaCollectMode = mergedRoom.teaCollectMode
      if (canUpdate('lastTeaCollectIdx')) updateData.lastTeaCollectIdx = mergedRoom.lastTeaCollectIdx
      if (canUpdate('status')) updateData.status = mergedRoom.status
      if (canUpdate('winner')) updateData.winner = mergedRoom.winner
      if (canUpdate('settledAt')) updateData.settledAt = mergedRoom.settledAt

      if (canUpdate('transactions') && deleted) {
        updateData.transactions = mergedRoom.transactions
      } else if (canUpdate('transactions') && newTransactions.length > 0) {
        updateData.transactions = _.push({ each: newTransactions })
      }

      await db.collection('rooms').doc(roomId).update({
        data: updateData
      })

      return { code: 0, data: { _id: roomId, ...current, ...mergedRoom } }
    }

    if (action === 'undo') {
      await db.collection('rooms').doc(roomId).update({
        data: {
          rounds: _.pop(),
          updatedAt: new Date()
        }
      })
      return { code: 0, data: { message: '已撤销' } }
    }

    const roundNum = Date.now()
    const newRound = {
      roundNum,
      scores: roundScores,
      timestamp: new Date()
    }

    await db.collection('rooms').doc(roomId).update({
      data: {
        rounds: _.push(newRound),
        updatedAt: new Date()
      }
    })

    return { code: 0, data: { roundNum } }
  } catch (e) {
    return { code: -1, errMsg: e.message }
  }
}

function mergeRoom(current, incoming, deletedTransactionIds) {
  const deleted = new Set(deletedTransactionIds || [])
  const playerMap = new Map()
  ;(current.players || []).forEach(player => {
    if (player && player.id) playerMap.set(player.id, player)
  })
  ;(incoming.players || []).forEach(player => {
    if (player && player.id) playerMap.set(player.id, { ...(playerMap.get(player.id) || {}), ...player })
  })

  const txnMap = new Map()
  ;(current.transactions || []).forEach(txn => {
    const key = txnKey(txn)
    if (key && !deleted.has(key) && !deleted.has(txn.id)) txnMap.set(key, txn)
  })
  ;(incoming.transactions || []).forEach(txn => {
    const key = txnKey(txn)
    if (key && !deleted.has(key) && !deleted.has(txn.id)) txnMap.set(key, txn)
  })

  const transactions = Array.from(txnMap.values()).sort((a, b) => {
    const at = new Date(a.timestamp || 0).getTime()
    const bt = new Date(b.timestamp || 0).getTime()
    if (at !== bt) return at - bt
    return String(a.id || '').localeCompare(String(b.id || ''))
  })

  return {
    players: Array.from(playerMap.values()),
    transactions,
    teaFeePercent: incoming.teaFeePercent !== undefined ? incoming.teaFeePercent : (current.teaFeePercent || 0),
    teaCollectMode: incoming.teaCollectMode || current.teaCollectMode || 'immediate',
    lastTeaCollectIdx: incoming.lastTeaCollectIdx !== undefined ? incoming.lastTeaCollectIdx : (current.lastTeaCollectIdx || 0),
    status: incoming.status || current.status || 'playing',
    winner: incoming.winner !== undefined ? incoming.winner : (current.winner || null),
    settledAt: incoming.settledAt !== undefined ? incoming.settledAt : (current.settledAt || null),
    updatedAt: incoming.updatedAt || new Date()
  }
}

function txnKey(txn) {
  if (!txn) return ''
  if (txn.id) return txn.id
  return [txn.timestamp || '', txn.from || '', txn.to || '', txn.amount || 0].join('|')
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name)
  } catch (e) {
    const msg = e && (e.errMsg || e.message || '')
    if (msg.includes('already exists') || msg.includes('DATABASE_COLLECTION_ALREADY_EXISTS')) return
    if (msg.includes('collection exists') || msg.includes('table already exists')) return
    if (msg.includes('ResourceExist') || msg.includes('Table exist')) return
    if (msg.includes('DATABASE_COLLECTION_ALREADY_EXIST')) return
    if (msg.includes('-502001')) return
    throw e
  }
}

async function normalizeAvatarProfile(profile = {}) {
  const avatarFileId = isCloudFileId(profile.avatarFileId)
    ? profile.avatarFileId
    : (isCloudFileId(profile.avatarUrl) ? profile.avatarUrl : '')
  let avatarUrl = isHttpUrl(profile.avatarUrl) && (!isTemporaryCloudHttpUrl(profile.avatarUrl) || avatarFileId)
    ? profile.avatarUrl
    : ''

  if (avatarFileId) {
    const map = await getTempFileUrlMap([avatarFileId])
    avatarUrl = map[avatarFileId] || avatarUrl || ''
  }

  return {
    avatarUrl,
    avatarFileId
  }
}

async function refreshProfileAvatarUrls(profiles) {
  const fileIds = [...new Set((profiles || [])
    .map(profile => profile.avatarFileId || (isCloudFileId(profile.avatarUrl) ? profile.avatarUrl : ''))
    .filter(Boolean))]
  if (fileIds.length === 0) return profiles

  const map = await getTempFileUrlMap(fileIds)
  return profiles.map(profile => {
    const avatarFileId = profile.avatarFileId || (isCloudFileId(profile.avatarUrl) ? profile.avatarUrl : '')
    const avatarUrl = (avatarFileId && map[avatarFileId]) || (isHttpUrl(profile.avatarUrl) ? profile.avatarUrl : '')
    return {
      ...profile,
      avatarFileId,
      avatarUrl
    }
  })
}

async function getTempFileUrlMap(fileIds) {
  const list = [...new Set((fileIds || []).filter(isCloudFileId))]
  if (list.length === 0) return {}
  const res = await cloud.getTempFileURL({ fileList: list })
  const map = {}
  ;(res.fileList || []).forEach(item => {
    if (item.fileID && item.tempFileURL) map[item.fileID] = item.tempFileURL
  })
  return map
}

function isCloudFileId(value) {
  return typeof value === 'string' && value.startsWith('cloud://')
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || '')
}

function isTemporaryCloudHttpUrl(value) {
  return isHttpUrl(value) && /\.tcb\.qcloud\.la\//i.test(value) && /[?&]sign=/i.test(value)
}
