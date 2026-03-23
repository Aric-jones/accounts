/**
 * 海报生成模块
 * 使用Canvas绘制分享海报
 */

const drawPoster = (ctx, data, canvasWidth, canvasHeight) => {
  const { room, rankings, winner, totalRounds, aiSummary } = data
  const padding = 30
  const cardWidth = canvasWidth - padding * 2

  // 背景
  ctx.setFillStyle('#FAFAF5')
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  // 顶部装饰条
  const grd = ctx.createLinearGradient(0, 0, canvasWidth, 120)
  grd.addColorStop(0, '#1A6B4A')
  grd.addColorStop(1, '#2E8B63')
  ctx.setFillStyle(grd)
  ctx.fillRect(0, 0, canvasWidth, 120)

  // 品牌名
  ctx.setFontSize(20)
  ctx.setFillStyle('#FFFFFF')
  ctx.setTextAlign('center')
  ctx.fillText('🀄 牌记', canvasWidth / 2, 35)

  // 牌局名称
  ctx.setFontSize(16)
  ctx.setFillStyle('rgba(255,255,255,0.8)')
  ctx.fillText(room.name, canvasWidth / 2, 60)

  // 日期
  ctx.setFontSize(12)
  ctx.fillText(new Date().toLocaleDateString('zh-CN'), canvasWidth / 2, 80)

  // 局数信息
  ctx.setFontSize(14)
  ctx.fillText(`共 ${totalRounds} 局`, canvasWidth / 2, 105)

  let y = 145

  // 白色卡片背景
  ctx.setFillStyle('#FFFFFF')
  roundRect(ctx, padding, y - 15, cardWidth, rankings.length * 50 + 80, 12)
  ctx.fill()

  // 赢家区域
  if (winner) {
    ctx.setFontSize(24)
    ctx.setFillStyle('#D4A72C')
    ctx.fillText('👑', canvasWidth / 2, y + 10)

    ctx.setFontSize(18)
    ctx.setFillStyle('#2D2D2D')
    ctx.fillText(winner.nickname, canvasWidth / 2, y + 38)

    ctx.setFontSize(14)
    ctx.setFillStyle('#1A6B4A')
    ctx.fillText(`今晚牌王 +${winner.totalScore}`, canvasWidth / 2, y + 58)

    y += 80
  }

  // 排名列表
  ctx.setTextAlign('left')
  rankings.forEach((player, index) => {
    const rowY = y + index * 45

    const medals = ['🥇', '🥈', '🥉']
    ctx.setFontSize(16)
    if (index < 3) {
      ctx.fillText(medals[index], padding + 15, rowY + 5)
    } else {
      ctx.setFillStyle('#888888')
      ctx.fillText(`${index + 1}`, padding + 20, rowY + 5)
    }

    ctx.setFontSize(15)
    ctx.setFillStyle('#2D2D2D')
    ctx.fillText(player.nickname, padding + 50, rowY + 5)

    ctx.setTextAlign('right')
    const scoreColor = player.totalScore > 0 ? '#22C55E' : player.totalScore < 0 ? '#EF4444' : '#888888'
    ctx.setFillStyle(scoreColor)
    ctx.setFontSize(16)
    ctx.fillText(`${player.totalScore > 0 ? '+' : ''}${player.totalScore}`, canvasWidth - padding - 15, rowY + 5)
    ctx.setTextAlign('left')
  })

  y += rankings.length * 45 + 30

  // AI摘要
  if (aiSummary) {
    ctx.setFillStyle('#F0FAF5')
    roundRect(ctx, padding, y, cardWidth, 60, 8)
    ctx.fill()

    ctx.setFontSize(11)
    ctx.setFillStyle('#1A6B4A')
    ctx.setTextAlign('center')
    const summaryLine = aiSummary.substring(0, 40) + (aiSummary.length > 40 ? '...' : '')
    ctx.fillText('🤖 ' + summaryLine, canvasWidth / 2, y + 35)
  }

  y += 85

  // 底部
  ctx.setFontSize(13)
  ctx.setFillStyle('#888888')
  ctx.setTextAlign('center')
  ctx.fillText('扫码加入下一局', canvasWidth / 2, y + 10)

  ctx.setFontSize(11)
  ctx.setFillStyle('#AAAAAA')
  ctx.fillText('「牌记」AI智能打牌记账', canvasWidth / 2, y + 30)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

/**
 * 生成海报并保存
 */
const generateAndSavePoster = (pageInstance, data) => {
  return new Promise((resolve, reject) => {
    const canvasWidth = 375
    const canvasHeight = 600

    const ctx = wx.createCanvasContext('posterCanvas', pageInstance)
    drawPoster(ctx, data, canvasWidth, canvasHeight)

    ctx.draw(false, () => {
      setTimeout(() => {
        wx.canvasToTempFilePath({
          canvasId: 'posterCanvas',
          width: canvasWidth,
          height: canvasHeight,
          destWidth: canvasWidth * 2,
          destHeight: canvasHeight * 2,
          fileType: 'png',
          success: (res) => {
            resolve(res.tempFilePath)
          },
          fail: reject
        }, pageInstance)
      }, 300)
    })
  })
}

/**
 * 保存海报到相册
 */
const savePosterToAlbum = async (tempFilePath) => {
  try {
    await wx.saveImageToPhotosAlbum({ filePath: tempFilePath })
    wx.showToast({ title: '已保存到相册', icon: 'success' })
    return true
  } catch (e) {
    if (e.errMsg && e.errMsg.includes('deny')) {
      wx.showModal({
        title: '保存失败',
        content: '请在设置中允许访问相册',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) wx.openSetting()
        }
      })
    }
    return false
  }
}

module.exports = {
  drawPoster,
  generateAndSavePoster,
  savePosterToAlbum
}
