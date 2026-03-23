/**
 * 云函数API调用封装
 */

const callCloud = async (name, data = {}) => {
  try {
    const res = await wx.cloud.callFunction({ name, data })
    if (res.result && res.result.code === 0) {
      return res.result.data
    }
    if (res.result && res.result.errMsg) {
      throw new Error(res.result.errMsg)
    }
    return res.result
  } catch (e) {
    console.error(`云函数 ${name} 调用失败:`, e)
    throw e
  }
}

const api = {
  async createRoom(roomData) {
    return callCloud('createRoom', roomData)
  },

  async joinRoom(shareCode) {
    return callCloud('joinRoom', { shareCode })
  },

  async getRoomDetail(roomId) {
    return callCloud('getRoomDetail', { roomId })
  },

  async recordScore(roomId, roundScores) {
    return callCloud('recordScore', { roomId, roundScores })
  },

  async undoLastRound(roomId) {
    return callCloud('recordScore', { roomId, action: 'undo' })
  },

  async settleRoom(roomId) {
    return callCloud('settleRoom', { roomId })
  },

  async getHistory(page = 1, pageSize = 20) {
    return callCloud('getHistory', { page, pageSize })
  },

  async getMyStats() {
    return callCloud('getHistory', { action: 'stats' })
  },

  async getOpenid() {
    return callCloud('getHistory', { action: 'getOpenid' })
  }
}

module.exports = api
