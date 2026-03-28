/**
 * 语音提示工具
 * 
 * 当前方案：文字提示 + 振动反馈（无需任何插件）
 * 
 * 如需真正的语音播报，可选方案：
 * 1. 微信服务市场 RealtimeTTS 插件（搜索"语音合成"）
 *    - 每天免费5次，需基础库 2.19.0+
 * 2. 接入第三方 TTS API（腾讯云/百度云语音合成）
 *    - 云函数中调用 → 返回音频URL → InnerAudioContext播放
 */

let ttsEnabled = true

const init = () => {
  ttsEnabled = wx.getStorageSync('voiceEnabled') !== false
}

const isEnabled = () => ttsEnabled

const setEnabled = (val) => {
  ttsEnabled = val
  wx.setStorageSync('voiceEnabled', val)
}

const speak = (text) => {
  if (!ttsEnabled) return
  wx.showToast({ title: text, icon: 'none', duration: 2500 })
  wx.vibrateShort({ type: 'medium' })
}

const onPlayerJoin = (nickname) => {
  speak(nickname + '加入了牌局')
}

const onBigPayment = (fromName, toName, amount) => {
  const msgs = [
    fromName + '豪气支付' + amount + '分给' + toName + '！',
    '大手笔！' + fromName + '一次' + amount + '分！',
    fromName + '出手阔绰，' + amount + '分送给' + toName + '！'
  ]
  speak(msgs[Math.floor(Math.random() * msgs.length)])
}

const onBigWinner = (nickname, score) => {
  const msgs = [
    nickname + '已经赢了' + score + '分，运气爆棚！',
    '恭喜' + nickname + '手气大好，累计赢' + score + '分！',
    nickname + '是今晚的大赢家，' + score + '分在手！'
  ]
  speak(msgs[Math.floor(Math.random() * msgs.length)])
}

const onBigLoser = (nickname, score) => {
  const msgs = [
    nickname + '已经输了' + Math.abs(score) + '分，别灰心！',
    nickname + '加油，翻盘的机会还在！',
    '坚持就是胜利，' + nickname + '下把赢回来！'
  ]
  speak(msgs[Math.floor(Math.random() * msgs.length)])
}

module.exports = { init, isEnabled, setEnabled, speak, onPlayerJoin, onBigPayment, onBigWinner, onBigLoser }
