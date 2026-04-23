# 产品规格文档

> 本文档描述牌记小程序的已实现能力边界，用于替代 README 中不准确的描述。

## 一、产品定位

牌记是一款微信小程序记账工具，面向牌局（麻将、掼蛋、斗地主、跑得快等）场景，提供多人记分、结算、和历史分析功能。

## 二、已实现能力

### 2.1 核心功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 创建房间 | ✅ | 支持设置房间名、游戏类型、单位价格、茶水费比例 |
| 加入房间 | ✅ | 支持房间码加入、扫码加入 |
| 记分/交易 | ✅ | 基于 transactions 的支付记录，支持普通转账和茶水费、台面特殊角色 |
| 撤销交易 | ✅ | 支持撤销最后一笔，含茶水费时需一并撤销 |
| 结算 | ✅ | 基于 transactions 计算最优转账方案（最少次数） |
| 房间码分享 | ✅ | 6位房间码 |
| 深色模式 | ✅ | 自动跟随系统主题 |

### 2.2 次要功能

| 功能 | 状态 | 说明 |
|------|------|------|
| AI 牌局摘要 | ⚠️ | 需要 DeepSeek API Key；无 Key 时使用本地模板兜底 |
| AI 数据分析 | ⚠️ | 本地计算手气指数等指标；完整报告需看激励视频广告解锁 |
| 语音播报（加入） | ❌ | 预留接口，需微信同声传译插件，未实际接入 |
| 语音记分 | ❌ | 预留接口，未实现 |
| Canvas 分享海报 | ✅ | 本地绘制 |
| 激励视频广告 | ❌ | 预留接口，需 UV>=500 开通流量主 |
| Banner 广告 | ❌ | 预留接口，需 UV>=500 开通流量主 |

### 2.3 数据存储

- **本地优先**：房间数据保存在 `localStorage`，单设备可用
- **云开发**：部分接入（云函数已部署），但非完整实时同步
- **rounds**：旧数据格式，仅兼容读取，不允许新功能继续写入

## 三、数据模型

### 3.1 Room 规范字段

```typescript
{
  _id: string                    // 房间唯一ID
  name: string                   // 房间名称
  gameType: 'majiang' | 'guandan' | 'doudizhu' | 'paodekuai' | 'poker'
  players: Player[]              // 玩家列表（含 __tea__、__table__ 特殊角色）
  transactions: Transaction[]    // 主记账数据（优先使用）
  unitPrice: number              // 单位价格（元/分）
  teaFeePercent: number          // 茶水费比例（%），0 表示不收
  teaCollectMode: 'immediate' | 'manual'
  status: 'playing' | 'settled'
  shareCode: string              // 6位房间码
  winner: Player | null         // 结算后记录的赢家
  createdBy: string              // 创建者 openid
  createdAt: string              // ISO 时间
  updatedAt: string              // ISO 时间
}
```

> **注意**：`__tea__`（茶水费角色）和 `__table__`（台面角色）属于内部记账角色，不参与玩家排名和统计。

### 3.2 Transaction 格式

```typescript
{
  id: string
  from: string                  // 付款方 player ID，__table__ 表示台面
  to: string                    // 收款方 player ID，__tea__ 表示茶水费
  amount: number                // 金额（分）
  fromName: string              // 付款方昵称
  toName: string                // 收款方昵称
  timestamp: string              // ISO 时间
}
```

### 3.3 Rounds（Legacy）

`rounds` 是旧版数据格式，仅用于兼容读取旧房间数据。新功能必须基于 `transactions` 实现。

```typescript
// rounds 仅做兼容读取，不允许新功能写入
rounds: [{
  roundNum: number
  scores: { [playerId: string]: number }  // playerId -> 本局净胜分
  timestamp: string
}]
```

## 四、能力边界说明

- **实时云同步**：未完整实现，云函数已部署但数据不保证多端实时同步
- **语音播报**：预留 `announceJoin()` 接口，实际接入需用户手动添加微信同声传译插件
- **语音记分**：`onVoiceScore()` 方法预留，未实现
- **广告**：代码中有占位符，需用户开通流量主后填入真实 ad-unit-id
- **DeepSeek API**：在 `cloudfunctions/aiSummary/index.js` 中配置，不配置则使用本地模板

## 五、配置说明

| 配置项 | 位置 | 必填 | 说明 |
|--------|------|------|------|
| AppID | `project.config.json` | 是 | 在微信公众平台注册后获取 |
| CLOUD_ENV_ID | `miniprogram/config/env.js` | 推荐 | 云开发环境 ID |
| DEEPSEEK_API_KEY | `miniprogram/config/env.js` | 否 | API Key，本地模板可兜底 |
| AD_BANNER_ID | `miniprogram/config/env.js` | 否 | 流量主广告位 ID |
| AD_REWARDED_VIDEO_ID | `miniprogram/config/env.js` | 否 | 激励视频广告位 ID |

详细配置文档见 [配置说明](./reference/config.md)
