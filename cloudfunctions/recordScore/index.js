const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { roomId, roundScores, action, room = {}, deletedTransactionIds = [] } = event

  try {
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
        players: mergedRoom.players,
        teaFeePercent: mergedRoom.teaFeePercent,
        teaCollectMode: mergedRoom.teaCollectMode,
        lastTeaCollectIdx: mergedRoom.lastTeaCollectIdx,
        status: mergedRoom.status,
        winner: mergedRoom.winner,
        settledAt: mergedRoom.settledAt,
        updatedAt: mergedRoom.updatedAt
      }

      if (deleted) {
        updateData.transactions = mergedRoom.transactions
      } else if (newTransactions.length > 0) {
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
