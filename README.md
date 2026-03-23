# 🀄 牌记 - AI智能打牌记账小程序

> 告别手动算账，AI帮你搞定一切！

## 功能特性

### 核心功能
- **多人实时记分** - 支持2-8人同时记分，麻将/掼蛋/斗地主/跑得快全覆盖
- **一键创建牌局** - 30秒开桌，分享房间码即可邀请好友加入
- **AI智能结算** - 自动计算最优转账方案，最少转账次数结清所有账目
- **AI牌局摘要** - 每局结束自动生成趣味点评文案，气氛拉满

### AI分析
- **手气指数** - 基于历史数据的运势分析
- **玩家风格** - 五维能力雷达图（运气/技术/稳定/激进/社交）
- **胜负趋势** - 可视化走势图
- **最佳搭档** - 分析谁是你的最佳牌友
- **运势预测** - 趣味性今日运势（分享裂变利器）

### 社交分享
- **战绩海报** - Canvas生成精美海报，一键分享朋友圈
- **房间码邀请** - 6位房间码 + 扫码加入
- **转发分享** - 微信好友/群聊直接分享

### 深色模式
- 完整的深色主题适配，牌桌暗光环境下更护眼
- LED风格数字显示，夜间体验极佳

## 技术架构

```
miniprogram/          # 小程序前端
├── pages/            # 页面
│   ├── index/        # 首页（牌局列表）
│   ├── create/       # 创建牌局
│   ├── join/         # 加入牌局（房间码/扫码）
│   ├── room/         # 牌局记分（核心页面）
│   ├── settlement/   # 结算页（排名+转账方案+AI摘要）
│   ├── history/      # 历史记录
│   ├── analysis/     # AI数据分析
│   └── profile/      # 个人中心
├── components/       # 自定义组件
├── utils/            # 工具模块
│   ├── settlement.js # 最优转账算法（贪心算法）
│   ├── ai.js         # AI文案生成（本地模板+DeepSeek API）
│   ├── poster.js     # Canvas海报绘制
│   ├── theme.js      # 主题管理
│   └── api.js        # 云函数API封装
└── images/           # 图标资源

cloudfunctions/       # 云函数
├── createRoom/       # 创建房间
├── joinRoom/         # 加入房间
├── recordScore/      # 记录分数
├── settleRoom/       # 结算房间
├── aiSummary/        # AI摘要生成（DeepSeek API）
├── getHistory/       # 获取历史记录
└── getRoomDetail/    # 获取房间详情
```

## 快速开始

### 1. 环境准备
- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 微信小程序 AppID（在 [微信公众平台](https://mp.weixin.qq.com) 注册）

### 2. 项目配置
1. 用微信开发者工具打开本项目
2. 修改 `project.config.json` 中的 `appid` 为你的 AppID
3. 在微信公众平台开通**云开发**
4. 在云开发控制台创建数据库集合 `rooms`

### 3. Tab图标
打开 `miniprogram/images/generate-icons.html` 生成TabBar图标PNG文件，保存到 `miniprogram/images/` 目录。

### 4. 云函数部署
在微信开发者工具中，右键每个云函数文件夹 → 上传并部署（云端安装依赖）

### 5. AI功能配置（可选）
修改 `cloudfunctions/aiSummary/index.js` 中的 `DEEPSEEK_API_KEY` 为你的 DeepSeek API Key。
不配置也可正常使用（会使用本地模板生成文案）。

### 6. 广告配置（可选）
1. 在微信公众平台开通流量主（UV >= 500）
2. 创建广告位，获取 ad-unit-id
3. 替换代码中的 `YOUR_BANNER_AD_ID` 和 `YOUR_REWARDED_AD_ID`

## 配色方案

### 亮色主题
| 用途 | 色值 |
|------|------|
| 主色（深绿） | `#1A6B4A` |
| 点缀色（金色） | `#D4A72C` |
| 背景色 | `#FAFAF5` |
| 文字色 | `#2D2D2D` |

### 深色主题
| 用途 | 色值 |
|------|------|
| 主色（翡翠绿） | `#00D09C` |
| 点缀色（金色） | `#FFD700` |
| 背景色 | `#1A1A2E` |
| 卡片色 | `#252540` |

## 变现策略

1. **激励视频广告** - "观看广告解锁完整AI报告"
2. **Banner广告** - 历史记录页、个人中心底部
3. **插屏广告** - 牌局结算时
4. **会员订阅** - 去广告 + 全部AI功能 ¥9.9-19.9/月

## 数据库设计

### rooms 集合
```json
{
  "_id": "string",
  "name": "周六掼蛋局",
  "gameType": "guandan",
  "players": [
    { "id": "xxx", "nickname": "张三", "avatarUrl": "", "color": "#FF6B6B" }
  ],
  "rounds": [
    { "roundNum": 1, "scores": { "playerId": 50 }, "timestamp": "ISO date" }
  ],
  "unitPrice": 1,
  "status": "playing | settled",
  "shareCode": "ABC123",
  "winner": { "id": "xxx", "nickname": "张三", "totalScore": 120 },
  "createdBy": "openid",
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

## 版权信息

MIT License - 个人开发者可自由使用和修改
