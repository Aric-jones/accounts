# 云开发使用与调试说明

> 当前项目云能力是“部分接入”：创建、加入、首页列表、结算详情等会尝试访问云数据库或云函数，但房间主数据仍会写入本地缓存，尚未实现完整多端实时同步。

## 一、启用云开发

1. 用微信开发者工具打开项目根目录 `accounts/`。
2. 确认 `project.config.json` 中 `appid` 是你自己的小程序 AppID。
3. 在开发者工具顶部点击「云开发」，按提示开通环境，记录环境 ID。
4. 复制配置模板：

```bash
cp miniprogram/config/env.example.js miniprogram/config/env.js
```

5. 在 `miniprogram/config/env.js` 填入：

```javascript
module.exports = {
  CLOUD_ENV_ID: '你的云开发环境ID',
  DEEPSEEK_API_KEY: 'sk-xxxxxxxxxxxxxxxx'
}
```

`DEEPSEEK_API_KEY` 可留占位值；不配置时 AI 摘要使用本地模板。

## 二、数据库集合

当前页面主路径会访问 `rooms` 集合：

- 首页：读取 `rooms` 中 `status: 'playing'` 的房间。
- 创建房间：向 `rooms` 新增房间，同时写入本地 `localRooms`。
- 加入房间：按 `shareCode` 查询 `rooms`，成功后写入本地 `localRooms`。
- 房间和结算：优先或尝试读取云端房间，同时保留本地缓存路径。

调试时先在云开发控制台确认存在 `rooms` 集合。云函数内部也会访问 `rooms`。

## 三、部署云函数

在微信开发者工具中逐个右键 `cloudfunctions/` 下的函数目录，选择「上传并部署：云端安装依赖」：

- `createRoom`
- `joinRoom`
- `recordScore`
- `settleRoom`
- `aiSummary`
- `getHistory`
- `getRoomDetail`
- `getWxacode`

`aiSummary` 如需调用 DeepSeek，应在云开发控制台给云函数配置环境变量，不要把真实 Key 写进仓库。

## 四、调试方法

- 当前是否配置云开发：打开小程序「个人中心」，底部会显示“云开发已配置/未配置”、环境 ID 和 OpenID。
- 模拟器调试：打开「调试器」看 Console，重点查 `云开发初始化失败`、`加载房间列表失败`、`创建房间失败`。
- 云函数调试：开发者工具里右键函数目录，选择「云端测试」或在云开发控制台查看调用日志。
- 数据库调试：在云开发控制台查看 `rooms` 集合，确认创建房间后是否新增记录。
- 真机调试：开发者工具点击「真机调试」，确认 `CLOUD_ENV_ID` 已填，手机网络可访问云开发环境。

## 五、常见问题

- 首页空白或没有房间：先确认 `rooms` 集合存在，且当前云环境 ID 正确。
- 创建失败：检查数据库权限、云环境 ID，以及开发者工具 Console 报错。
- 加入失败：确认房间的 `shareCode` 和 `status: 'playing'` 是否存在于云端。
- 云函数调用失败：确认函数已部署到同一个云环境，依赖已安装。
- 多端数据不同步：这是当前能力边界，项目尚未实现完整实时云同步。
