# 房间头像与首页进行中范围修复

## 变更级别

L2：涉及共享头像工具、房间参与者识别、首页跨页面展示范围与本地/云端数据合并规则。

## 问题

1. 进入牌局后，当前设备只能稳定看到自己的头像，其他玩家头像可能渲染失败。
2. 首页“进行中”会展示云端所有未结算房间，而不是只展示与当前用户有关的房间。

## 根因

- 微信头像选择可能返回 `http://tmp/`、`wxfile://` 等本机临时路径。现有 `ensureCloudAvatar()` 把所有 `http://`/`https://` 都视为可跨设备访问地址，导致本机临时头像没有上传到微信云存储。
- 房间页渲染头像时也把 `http://tmp/` 当作可渲染网络图，其他设备拿到该路径后无法显示。
- 首页查询 `rooms.status = playing` 后仅按结算状态过滤，没有按当前 `openid`、本地 `clientId`、`roomPlayerIds`、`myRoomIds` 判断当前用户是否参与。

## 修复规格

- `ensureCloudAvatar()` 必须把本地临时路径识别为需要上传的路径，包括 `wxfile://`、`http://tmp/`、`https://tmp/`、普通临时文件路径。
- 头像展示只把 `cloud://` 转换后的临时 URL、真实 `http(s)` 网络地址或微信可渲染本机文件路径视为图片；跨设备不可用的 `http://tmp/` 不直接作为他人头像渲染。
- 创建房间、加入房间、编辑头像仍复用微信云存储，不引入第二套头像存储。
- 首页“进行中”只展示：
  - 当前用户创建的未结束房间；
  - 当前用户已加入的未结束房间；
  - 本地已记录 `roomPlayerIds[roomId]` 或 `myRoomIds` 的未结束房间。
- 本地缓存中同房间若已是 `settled`，首页必须剔除该房间。

## 兼容策略

- 旧房间中已经保存的 `cloud://` 头像继续通过 `wx.cloud.getTempFileURL` 转换后显示。
- 旧房间中已经保存的其他用户本机临时头像无法跨设备恢复，页面回退显示昵称首字。
- 当前用户自己的旧本机临时头像在房间页进入后仍会尝试上传并回写 `players`。
- `rounds` 不参与本次修复，主记账路径仍为 `transactions`。

## 验收点

- [ ] A、B 两个用户各自设置头像后进入同一牌局，双方都能看到对方头像。
- [ ] 若玩家头像仍是本机临时路径，其他设备不显示坏图，回退显示昵称首字。
- [ ] 首页“进行中”不展示与当前用户无关的云端房间。
- [ ] 首页仍展示当前用户创建或已加入、且 `status = playing` 的房间。
- [ ] 已结算房间不再出现在首页“进行中”。

## 实施记录

- 头像上传判断新增微信本机临时路径识别，`http://tmp/`、`wxfile://` 等路径会尝试上传到微信云存储。
- 房间页当前用户旧本机头像进入后会再次尝试修复为云存储 fileID。
- 首页加载前补充获取 `openid`，并用 `openid/clientId/roomPlayerIds/myRoomIds` 限定当前用户相关房间。
- 首页合并本地缓存时继续以本地已结算状态为剔除依据。

## 云函数更新说明

- 本次新增全局用户头像资料能力后，需要重新上传并部署 `cloudfunctions/recordScore`。
- `recordScore` 新增 `saveUserProfile`：按当前调用者 `OPENID` 保存全局 `nickName/avatarUrl/clientId`。
- `recordScore` 新增 `getUserProfiles`：按房间玩家 `openid` 批量读取全局用户资料，供房间页展示优先使用。
- `recordScore` 在访问 `userProfiles` 前会尝试自动创建集合；如果权限限制导致自动创建失败，需要在云开发控制台数据库中手动新建 `userProfiles` 集合。
- 首页筛选依赖既有 `getHistory` 云函数的 `action: 'getOpenid'` 能力；若线上环境此前没有部署包含该能力的 `getHistory`，需要先部署 `cloudfunctions/getHistory`。
- 创建、加入、记账、头像回写仍依赖 `joinRoom`、`recordScore` 与微信云存储能力。

## 头像链路排查补充

- 当前实际链路应为：选择头像得到本机临时路径 -> 本机立即预览 -> `wx.cloud.uploadFile` 上传到云存储 -> 保存 `cloud://` fileID 到用户资料或房间玩家资料 -> 房间展示前用 `wx.cloud.getTempFileURL` 转为可渲染临时 URL。
- 不能把 `http://tmp/`、`wxfile://` 等本机临时路径当作跨设备头像保存结果；它们只能用于当前设备预览和上传源。
- 头像工具必须输出关键日志：输入路径类型、是否需要上传、`cloudPath`、上传成功返回的 `fileID`、上传失败错误、临时 URL 解析成功/失败明细。
- 房间页必须输出关键日志：进入编辑头像、选择到的本机路径、保存到房间的头像值、云端保存结果、编辑弹窗当前展示 URL。
- 若上传失败，页面允许当前设备短暂预览本机临时图，但不能把失败状态误报为跨设备头像已生效。
- 排查日志已确认上传、`recordScore.saveRoom` 写入、`getTempFileURL` 解析均成功；实际阻断点是调试日志误写到 `cacheRoom()`，引用了不存在的 `options` 变量，导致保存成功后的缓存刷新抛 `ReferenceError`。
- `saveRoom:start` 日志应只位于 `saveRoom(room, options)` 内；`cacheRoom(room)` 只能做本地缓存写入，不引用保存参数。
- 已加入房间后，用户在个人资料页或其他入口更换头像，不会天然更新既有 `room.players` 快照；进入房间时必须把当前用户本地 `userInfo.nickName/avatarUrl` 同步到该房间的当前玩家资料。
- 房间页 `_updateRoomData` 需输出每个真实玩家的 `avatarUrl/displayAvatarUrl/hasDisplayAvatar`，用于判断对方头像是“未写入房间”“未解析临时 URL”还是“已解析但渲染失败”。
- 展示头像时应优先使用全局 `userProfiles[openid].avatarUrl`，其次使用房间 `players[].avatarUrl` 快照；更换头像的语义是修改“我的用户头像”，不是只修改某一局游戏里的玩家头像。
- 房间页新增头像测试入口，用于预览本局所有玩家头像，并列出房间头像、全局头像、实际展示头像、临时 URL 与渲染判断。
- 调试面板里如果 `display` 仍是 `cloud://`，即使有头像链接也不能被 `<image>` 稳定展示；必须先通过 `wx.cloud.getTempFileURL` 转成 `https://`。调试入口需要收集房间头像、全局头像、最终头像的所有候选 URL 后再解析。

## 验证记录

- [x] `node --check miniprogram/utils/util.js`
- [x] `node --check miniprogram/pages/index/index.js`
- [x] `node --check miniprogram/pages/room/room.js`
- [ ] 微信开发者工具端到端验证：需在小程序环境中用两个用户实际创建、加入、设置头像、结算后验证。
