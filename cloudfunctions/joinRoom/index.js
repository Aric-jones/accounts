const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { shareCode, player = {} } = event

  try {
    const res = await db.collection('rooms')
      .where({ shareCode, status: 'playing' })
      .get()

    if (res.data.length === 0) {
      return { code: -1, errMsg: '房间不存在或已结算' }
    }

    const room = res.data[0]
    const players = room.players || []
    let currentPlayer = null

    if (wxContext.OPENID) {
      currentPlayer = players.find(p => p.openid === wxContext.OPENID)
    }
    if (!currentPlayer && player.clientId) {
      currentPlayer = players.find(p => p.clientId === player.clientId)
    }

    if (!currentPlayer) {
      currentPlayer = {
        id: player.id || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`,
        nickname: player.nickname || `牌友${players.filter(p => p.id !== '__tea__' && p.id !== '__table__' && !p.isTea && !p.isTable).length + 1}`,
        avatarUrl: player.avatarUrl || '',
        clientId: player.clientId || '',
        openid: wxContext.OPENID || player.openid || '',
        isCreator: false
      }
      players.push(currentPlayer)
      await db.collection('rooms').doc(room._id).update({
        data: {
          players,
          updatedAt: new Date()
        }
      })
      room.players = players
      room.updatedAt = new Date()
    }

    return { code: 0, data: room, myPlayerId: currentPlayer.id }
  } catch (e) {
    return { code: -1, errMsg: e.message }
  }
}
