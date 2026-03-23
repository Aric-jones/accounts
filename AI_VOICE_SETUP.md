# AI 与语音功能接入指南

本文档说明「牌记」小程序中所有 AI 和语音功能的接入位置、用途、以及你需要提供的配置。

---

## 一、功能清单总览

| 功能 | 位置 | 需要什么 | 必要性 |
|------|------|---------|--------|
| 语音播报"XXX加入了" | 房间页 - 玩家加入时 | 微信同声传译插件 | ⭐推荐 |
| AI语音记分 | 房间页 - 语音按钮 | 微信同声传译插件 | 后续版本 |
| AI牌局摘要 | 结算页 - 趣味文案 | DeepSeek API Key | ⭐推荐 |
| AI数据分析报告 | AI分析页 - 手气/风格 | 本地计算，无需API | 已内置 |
| AI运势预测 | AI分析页 - 趣味功能 | 本地模板，无需API | 已内置 |
| AI生成分享海报 | 结算页 - 分享战绩 | Canvas本地绘制 | 已内置 |
| 激励视频广告 | AI分析页 - 解锁报告 | 微信广告位ID | 上线后 |
| Banner广告 | 个人中心 - 底部 | 微信广告位ID | 上线后 |

---

## 二、你需要提供的东西

### 1. 微信小程序 AppID（必须）
- 去 https://mp.weixin.qq.com 注册
- 获取你的 AppID
- 填入 `project.config.json` 的 `"appid"` 字段

### 2. 微信同声传译插件（语音功能）

**用途：**
- 玩家加入时语音播报 "张三加入了牌局"
- 后续版本：语音记分 "张三赢了50分"

**配置步骤：**

1. 登录 https://mp.weixin.qq.com
2. 左侧菜单 → 设置 → 第三方设置 → 插件管理
3. 搜索「微信同声传译」(插件AppID: `wx069ba97219f66d99`)
4. 点击「添加」
5. 在 `miniprogram/app.json` 中加入：

```json
{
  "plugins": {
    "WechatSI": {
      "version": "0.3.6",
      "provider": "wx069ba97219f66d99"
    }
  }
}
```

6. 在需要语音的页面使用：

```javascript
// 文字转语音（播报）
const plugin = requirePlugin("WechatSI")
plugin.textToSpeech({
  lang: "zh_CN",
  content: "张三加入了牌局",
  success: (res) => {
    // res.filename 是音频文件路径
    const audio = wx.createInnerAudioContext()
    audio.src = res.filename
    audio.play()
  }
})

// 语音转文字（语音记分）
const manager = plugin.getRecordRecognitionManager()
manager.onRecognize = (res) => {
  console.log("识别结果:", res.result)
  // 解析 "张三赢了50" -> {player: "张三", score: 50}
}
manager.start({ lang: "zh_CN" })
```

**费用：免费**

### 3. DeepSeek API Key（AI文案，可选）

**用途：**
- 牌局结束时生成趣味总结文案
- 例："今晚掼蛋局，李四手气逆天连赢5局封王！"

**配置步骤：**
1. 注册 https://platform.deepseek.com
2. 创建 API Key
3. 充值（极便宜，约 0.001 元/次调用）
4. 打开 `cloudfunctions/aiSummary/index.js`
5. 将 `YOUR_DEEPSEEK_API_KEY` 替换为你的真实 Key

**不配置也能用：** 系统会自动使用本地模板生成文案（已内置30+模板）

### 4. 微信云开发（可选，推荐）

**用途：**
- 多人实时同步（目前使用本地存储，单机可用）
- 数据云端备份

**配置步骤：**
1. 微信开发者工具 → 菜单栏 → 云开发
2. 开通云开发（免费额度足够初期使用）
3. 创建数据库集合 `rooms`
4. 右键每个 `cloudfunctions/` 下的文件夹 → 上传并部署

### 5. 广告位 ID（上线赚钱用，后配置）

**开通条件：** 小程序累计 UV >= 500

**配置步骤：**
1. 登录 https://mp.weixin.qq.com
2. 推广 → 流量主 → 开通
3. 创建广告位 → 获取 `ad-unit-id`
4. 替换代码中的：
   - `YOUR_REWARDED_AD_ID` → 激励视频广告位ID
   - `YOUR_BANNER_AD_ID` → Banner广告位ID

---

## 三、AI 接入点详细说明

### 接入点1：玩家加入语音播报
- **文件：** `miniprogram/pages/room/room.js` → `announceJoin()` 方法
- **触发时机：** 手动添加玩家时 / 扫码加入时
- **需要：** 微信同声传译插件
- **效果：** 语音说 "张三加入了牌局"

### 接入点2：AI牌局总结
- **文件：** `miniprogram/utils/ai.js` → `generateAISummary()` 方法
- **触发时机：** 牌局结算时
- **需要：** DeepSeek API Key（可选，有本地兜底）
- **效果：** 生成 "今晚掼蛋大战，XX连赢8局称王！" 等趣味文案

### 接入点3：AI语音记分（V2版本）
- **文件：** `miniprogram/pages/room/room.js` → `onVoiceScore()` 方法
- **触发时机：** 用户点击麦克风按钮
- **需要：** 微信同声传译插件
- **效果：** 用户说"张三赢了50"，自动填入分数

### 接入点4：AI数据分析
- **文件：** `miniprogram/pages/analysis/analysis.js`
- **触发时机：** 用户打开 AI分析 tab
- **需要：** 无，纯本地计算
- **效果：** 手气指数、胜率趋势、玩家风格五维图

### 接入点5：激励视频广告
- **文件：** `miniprogram/pages/analysis/analysis.js` → `onUnlockFullReport()`
- **触发时机：** 用户点击"观看广告解锁完整报告"
- **需要：** 广告位ID（UV >= 500后开通）
- **效果：** 看完30秒广告解锁完整AI分析报告

---

## 四、推荐的接入顺序

### 第一步（现在就可以做）
1. ✅ 填入你的 AppID
2. ✅ 在微信公众平台添加「微信同声传译」插件
3. ✅ 注册 DeepSeek 获取 API Key

### 第二步（有了用户后）
4. 开通云开发
5. 部署云函数

### 第三步（UV >= 500 后）
6. 开通流量主
7. 创建广告位
8. 填入广告ID
