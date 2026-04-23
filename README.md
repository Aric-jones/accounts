# 牌记 - AI智能打牌记账小程序

> 告别手动算账，支持麻将/掼蛋/斗地主/跑得快等多种牌类，AI帮你搞定记账和结算。

## 功能现状

### 已实现

- **多人记分** — 支持 2-8 人，基于 transactions 记账
- **创建/加入房间** — 房间码 + 扫码两种方式
- **记交易** — 任意玩家间转账记分，含茶水费、台面特殊处理
- **撤销** — 支持撤销最后一笔（含茶水费情况一并撤销）
- **AI 结算** — 自动计算最优转账方案，最少次数结清
- **历史记录** — 查看过往牌局
- **个人统计** — 胜率、胜负走势等
- **AI 摘要** — 牌局结束生成趣味文案（需 DeepSeek API Key，不配置时用本地模板）
- **AI 数据分析** — 手气指数等本地计算，完整报告需看激励视频解锁
- **分享海报** — Canvas 绘制
- **深色模式** — 跟随系统主题

### 部分接入 / 待统一

- **云开发** — 云函数已部署，数据存储以本地为主，多端实时同步**未完整实现**
- **语音播报** — 预留接口，实际使用需手动接入微信同声传译插件
- **广告** — 占位符已预留，需开通流量主后填入真实广告位 ID

### 预留但未实现

- 语音记分
- 完整实时云同步

## 技术栈

```
miniprogram/         # 小程序前端
├── pages/           # 页面（index/create/join/room/settlement/history/analysis/profile）
├── components/      # 组件（player-card/score-input/ad-banner）
└── utils/           # 工具（settlement/ai/api/poster/voice/theme/util）

cloudfunctions/      # 云函数（部分接入）
├── createRoom/
├── joinRoom/
├── recordScore/
├── settleRoom/
├── aiSummary/      # DeepSeek API（可选）
├── getHistory/
├── getRoomDetail/
└── getWxacode/
```

详细架构见 [docs/architecture/architecture.md](docs/architecture/architecture.md)

## 快速开始

### 1. 环境准备

- [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 微信小程序 AppID（在 [微信公众平台](https://mp.weixin.qq.com) 注册）

### 2. 项目配置

1. 用微信开发者工具打开本项目
2. 修改 `project.config.json` 中的 `appid` 为你的 AppID
3. 在 `miniprogram/config/` 目录下创建 `env.js`：

```bash
cp miniprogram/config/env.example.js miniprogram/config/env.js
```

4. 填写 `env.js` 中的配置（见下方配置说明）

### 3. Tab 图标

打开 `miniprogram/images/generate-icons.html` 生成 TabBar 图标，保存 PNG 到 `miniprogram/images/`。

### 4. 云函数部署（如需）

在微信开发者工具中，右键每个云函数文件夹 → 上传并部署。

### 5. AI 功能（可选）

1. 注册 [DeepSeek Platform](https://platform.deepseek.com)
2. 创建 API Key
3. 填入 `env.js` 的 `DEEPSEEK_API_KEY`

不配置也可以正常使用，系统会使用内置本地模板生成文案。

## 配置说明

| 配置项 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `CLOUD_ENV_ID` | 推荐 | `''` | 云开发环境 ID |
| `DEEPSEEK_API_KEY` | 否 | `'__PLACEHOLDER__'` | DeepSeek API Key，不填则用本地模板 |
| `AD_BANNER_ID` | 否 | `''` | Banner 广告位 ID（需流量主权限） |
| `AD_REWARDED_VIDEO_ID` | 否 | `''` | 激励视频广告位 ID（需流量主权限） |

详细说明见 [docs/reference/config.md](docs/reference/config.md)

## 数据模型

房间主数据以 `transactions` 为准，`rounds` 仅兼容读取旧数据。

```
Room {
  _id, name, gameType,
  players[],           # 含 __tea__、__table__ 特殊角色
  transactions[],      # 主记账数据 [{from, to, amount, fromName, toName, timestamp}]
  unitPrice, teaFeePercent, teaCollectMode,
  status, shareCode, winner, createdBy, createdAt, updatedAt
}
```

> `__tea__`（茶水费）和 `__table__`（台面）属于内部记账角色，**不参与**玩家排名和统计。

## 文档

- [AGENTS.md](AGENTS.md) — 项目协作规范
- [docs/product/spec.md](docs/product/spec.md) — 产品规格与能力边界
- [docs/architecture/architecture.md](docs/architecture/architecture.md) — 架构文档
- [docs/process/workflow.md](docs/process/workflow.md) — 文档先行工作流
- [docs/reference/](docs/reference/) — 参考资料

## 版权

MIT License
