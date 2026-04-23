# 架构文档

> 描述项目当前真实架构状态，用于替换 README 中不准确的架构图。

## 一、代码组织

```
accounts/
├── miniprogram/                # 小程序前端
│   ├── pages/                  # 页面
│   │   ├── index/             # 首页（房间列表）
│   │   ├── create/             # 创建房间
│   │   ├── join/              # 加入房间
│   │   ├── room/              # 牌局（核心，记分页）
│   │   ├── settlement/        # 结算页
│   │   ├── history/           # 历史记录
│   │   ├── analysis/          # AI 数据分析
│   │   └── profile/           # 个人中心
│   ├── components/           # 自定义组件（player-card, score-input, ad-banner）
│   ├── utils/                 # 工具模块
│   │   ├── settlement.js      # 结算算法（贪心最优转账）
│   │   ├── ai.js              # AI 文案生成（本地模板 + DeepSeek）
│   │   ├── api.js             # 云函数 API 封装
│   │   ├── poster.js          # Canvas 海报绘制
│   │   ├── voice.js           # 语音播报封装
│   │   ├── theme.js           # 主题管理
│   │   └── util.js            # 通用工具
│   ├── config/
│   │   ├── env.example.js     # 配置模板
│   │   └── env.js             # 本地私有配置（已 gitignore）
│   └── images/                # TabBar 图标等静态资源
│
├── cloudfunctions/            # 云函数（部分接入，非完整实时同步）
│   ├── createRoom/
│   ├── joinRoom/
│   ├── recordScore/
│   ├── settleRoom/
│   ├── aiSummary/             # DeepSeek API 调用
│   ├── getHistory/
│   ├── getRoomDetail/
│   └── getWxacode/
│
└── docs/                      # 项目文档（新建）
    ├── product/              # 产品规格
    ├── architecture/         # 架构文档
    ├── process/              # 流程规范与模板
    ├── templates/            # 文档模板
    └── reference/           # 参考资料
```

## 二、数据流

### 2.1 本地优先路径

```
创建房间 → 本地 localStorage (localRooms)
    ↓
加入房间 → 读取 localRooms
    ↓
记交易 → 更新 room.transactions → 保存 localStorage
    ↓
撤销 → 删除最后一笔 transaction → 保存 localStorage
    ↓
结算 → 读取 transactions → calculateNetScores → calculateOptimalTransfers
```

### 2.2 主数据模型：transactions

`transactions` 是当前记账主路径，每条记录表示一笔支付：

```javascript
{ from: 'playerA', to: 'playerB', amount: 50, fromName: '张三', toName: '李四', timestamp: '...' }
```

### 2.3 Legacy 兼容：rounds

`rounds` 是旧格式，只读兼容：

```javascript
[{ roundNum: 1, scores: { 'playerA': 50, 'playerB': -30 }, timestamp: '...' }]
```

页面在计算时会优先使用 `transactions`，无数据时才回退 `rounds`。

### 2.4 特殊角色

| 角色 ID | 名称 | 用途 |
|---------|------|------|
| `__tea__` | 茶水费 | 收取茶水费时作为 `to`，不参与玩家排名 |
| `__table__` | 台面 | 台面资金流动的中转方，不参与玩家排名 |

## 三、模块职责

### 3.1 settlement.js（核心算法）

```javascript
calculateNetScores(data, players)     // 从 transactions 或 rounds 计算净胜
calculateOptimalTransfers(...)       // 贪心算法求最少转账次数
generateRankings(...)                // 生成排名
calculateStats(...)                 // 计算个人统计
findWinner(...)                     // 找赢家
```

### 3.2 ai.js

```javascript
generateAISummary(room, players)    // 生成 AI 摘要文案
  ├── 有 DEEPSEEK_API_KEY → 调用 DeepSeek API
  └── 无 KEY → 使用本地内置模板
```

### 3.3 api.js

云函数调用封装，实际只部分接入云能力。

### 3.4 room.js（页面）

核心页面，职责：
- 管理房间生命周期
- 处理记分、撤销、茶水费、台面
- 调用 settlement.js 计算
- 操作 localStorage

## 四、当前能力状态

| 能力 | 状态 | 说明 |
|------|------|------|
| 本地存储 | ✅ | localStorage 完整可用 |
| 云函数部署 | ✅ | 已部署，但不保证实时同步 |
| 实时云同步 | ⚠️ | 部分接入，非完整实现 |
| 语音播报 | ❌ | 预留接口，未实际接入 |
| AI 摘要 | ⚠️ | DeepSeek API 可用；本地模板兜底 |
| AI 分析 | ⚠️ | 本地计算；激励视频解锁完整报告 |
| 广告 | ❌ | 占位符待填 |

## 五、约束规则

来自 `AGENTS.md`：

1. 不得在 `rounds` 上继续新功能写入
2. 不得新增与 `transactions` 并行的第二套主记账口径
3. `__tea__`、`__table__` 只作内部记账角色，不入排名统计
4. 未被页面消费的 API/云函数应标记为 legacy
