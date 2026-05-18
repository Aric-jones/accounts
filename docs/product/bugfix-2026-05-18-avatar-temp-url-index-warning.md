# 头像临时 URL 403 与首页索引提示修复

## 变更级别

L2：涉及共享头像工具、个人资料展示、首页查询策略和云数据库索引说明。

## 问题

1. 头像地址形如 `https://...tcb.qcloud.la/...?...sign=...` 时，页面可能报 403。
2. 首页加载进行中房间时，开发者工具提示 `rooms` 查询可能缺少索引，尤其是 `status + players.clientId` 查询。

## 根因

- `wx.cloud.getTempFileURL` 返回的是有时效的临时 HTTP URL，不应该写入 `userInfo`、`rooms.players[].avatarUrl` 或 `userProfiles.avatarUrl` 作为长期头像地址。
- 旧链路把临时 HTTP URL 当作稳定头像保存，URL 过期后 `<image>` 请求会返回 403。
- 首页在已经拿到 `openid` 后仍会继续发起 `players.clientId` 云查询，增加了索引提示和查询成本。

## 修复规格

- 头像长期存储值应优先为稳定的 `cloud://` fileID。
- `cloud://` 只在页面展示前通过 `wx.cloud.getTempFileURL` 解析为临时 HTTP URL。
- 已保存的 `tcb.qcloud.la` 带签名临时 URL 视为不可长期渲染地址，页面应回退到占位头像，避免继续触发 403。
- 首页云端查询优先使用 `openid`；只有 `openid` 缺失时才使用 `players.clientId` 兜底查询。
- 如果线上仍频繁使用 `players.clientId` 兜底查询，需要在云数据库 `rooms` 集合建立对应索引。

## 验收点

- [ ] 新选择的头像保存为 `cloud://`，不是带 `sign` 的 `tcb.qcloud.la` 临时 URL。
- [ ] 首页和个人资料页遇到旧的过期临时 URL 时不再请求该图片，显示占位头像。
- [ ] 房间、历史、结算页仍能把 `cloud://` 头像解析后正常展示。
- [ ] 首页正常拿到 `openid` 后不再发起 `players.clientId` 云查询。
- [ ] 未拿到 `openid` 时仍可通过本地缓存和必要的 `clientId` 查询兜底展示当前用户相关房间。

## 索引说明

生产环境如仍需要频繁使用 `players.clientId` 兜底查询，应在云开发控制台为 `rooms` 集合增加索引，至少覆盖：

- `status` 升序
- `players.clientId` 相关数组/对象字段查询

如果只在开发调试时偶发出现该提示，可以先观察；它不影响当前功能正确性。

## 实施记录

- `ensureHttpAvatar()` 调整为兼容旧调用名但返回稳定存储值：本地临时头像上传后返回 `cloud://` fileID，不再返回 `getTempFileURL` 的临时 HTTP URL。
- 新增临时云 HTTP URL 判断：带 `sign` 的 `*.tcb.qcloud.la` 地址不再作为可渲染头像，避免过期后继续触发 403。
- `saveGlobalUserProfile()` 只保存稳定头像地址，避免把本机临时路径或已签名临时 URL 写入 `userProfiles`。
- 首页和个人资料页新增展示头像解析：`cloud://` 先解析为临时 URL 再传给 `<image>`，旧的无效临时 URL 回退占位头像。
- 首页云查询调整为：拿到 `openid` 后只查 `createdBy/openid` 路径；仅在 `openid` 缺失时才用 `players.clientId` 云查询兜底。

## 验证记录

- [x] `node --check miniprogram/utils/util.js`
- [x] `node --check miniprogram/pages/index/index.js`
- [x] `node --check miniprogram/pages/profile/profile.js`
- [x] `node --check miniprogram/pages/create/create.js`
- [x] `node --check miniprogram/pages/join/join.js`
- [x] `node --check miniprogram/pages/room/room.js`
- [ ] 微信开发者工具端到端验证：需重新选择头像，确认存储值为 `cloud://` 且页面展示正常；同时观察首页是否还出现 `players.clientId` 索引提示。
