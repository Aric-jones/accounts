const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { scene, page } = event
  try {
    const result = await cloud.openapi.wxacode.getUnlimited({
      scene: scene || '',
      page: page || 'pages/index/index',
      width: 430,
      isHyaline: false
    })

    if (result && result.buffer) {
      const uploadRes = await cloud.uploadFile({
        cloudPath: `wxacode/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`,
        fileContent: result.buffer
      })
      return { success: true, fileID: uploadRes.fileID }
    }

    return { success: false, error: 'no buffer returned' }
  } catch (err) {
    return { success: false, error: err.message || err.toString() }
  }
}
