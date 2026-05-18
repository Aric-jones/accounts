# 用户资料表与房间状态一致性收敛

## 变更级别

L2：涉及用户资料表、头像存储契约、首页进行中房间、历史记录跨设备一致性和云函数契约。

## 当前规则梳理

### 首页什么时候显示房间

首页 `pages/index/index.js` 当前读取：

- 云端 `rooms.status = 'playing'`，且当前用户是创建者或玩家。
- 本地 `localRooms` 中 `status = 'playing'`，且本地 `roomPlayerIds/myRoomIds` 或玩家 `openid/clientId` 能证明当前用户参与。
- 本地同房间如果已经是 `settled`，首页会剔除。

问题是：如果本地仍是 `playing`，但云端已经变成 `settled`，首页可能先把本地房间展示出来；点击后房间页重新拉云端，发现已结束，就提示并跳转/消失。

### 历史什么时候显示房间

历史页 `pages/history/history.js` 当前读取：

- 云函数 `getHistory(action: 'history')` 返回当前用户相关房间。
- 再合并本地 `localRooms`。
- 最后只展示 `status = 'settled'` 的房间。

问题是：本地缓存参与合并，不同设备的 `localRooms` 不同，所以同一个用户在电脑和手机上看到的历史可能不同。

## 目标规则

- 用户资料以云端 `userProfiles` 为用户表，按 `openid` 一人一条。
- 小程序内同一个用户只能有一个头像和一个昵称；房间玩家快照不得作为新的头像主数据源。
- `userProfiles.avatarUrl` 必须是可传给 `<image>` 的 HTTP URL。
- 为了能刷新过期 HTTP URL，`userProfiles.avatarFileId` 保留微信云存储 `cloud://` fileID；页面展示和用户表返回时刷新为 HTTP。
- 首页和历史的跨设备一致性以云端 `rooms` 为准。
- 本地 `localRooms` 只作为离线/云读取失败兜底，不得覆盖云端同房间状态。

## 修复规格

- `recordScore.saveUserProfile` 写入 `userProfiles`：
  - `openid`
  - `nickName`
  - `avatarUrl`：HTTP URL
  - `avatarFileId`：可选，`cloud://` fileID
  - `clientId`
  - `updatedAt`
- `recordScore.getUserProfiles` 返回用户资料前，如果存在 `avatarFileId`，先刷新 `avatarUrl` 为 HTTP。
- 首页改用 `getHistory(action: 'myRooms')` 拉当前用户相关云端房间，包含 `playing/settled`，再决定是否展示进行中。
- 首页合并本地房间时，如果云端已存在同房间且不是 `playing`，本地旧 `playing` 不得再展示。
- 历史页云端读取成功时，云端同房间优先；本地只补充云端没有的本地已结算房间。

## 验收点

- [ ] 用户重新选择头像后，`userProfiles.avatarUrl` 是 HTTP URL，且同一用户只有一条资料记录。
- [ ] 房间内展示用户头像优先来自 `userProfiles`，同一用户换头像后新进入房间能看到同一个头像。
- [ ] 云端房间已结算时，首页不再因为本地旧缓存继续展示。
- [ ] 同一用户在电脑和手机查看历史，云端已结算房间列表一致。
- [ ] 云端读取失败时，本地历史仍可作为兜底显示。

## 实施记录

- `miniprogram/utils/util.js` 新增 `ensureHttpAvatarProfile()`，上传头像后同时返回：
  - `avatarUrl`：HTTP 展示地址。
  - `avatarFileId`：微信云存储 `cloud://` fileID，用于后续刷新 HTTP 地址。
- 创建房间、加入房间、个人资料页、房间内修改头像都写入同一组 `avatarUrl/avatarFileId`，并同步保存到 `userProfiles`。
- `recordScore.saveUserProfile` 规范化用户资料，`userProfiles.avatarUrl` 只保存 HTTP；`avatarFileId` 单独保存。
- `recordScore.getUserProfiles` 返回前用 `avatarFileId` 刷新 HTTP 头像，房间页优先使用用户表资料展示。
- `getHistory` 新增 `myRooms` action，首页通过该云函数读取当前用户相关的全部云端房间状态，再过滤进行中。
- 首页合并本地缓存时，如果云端同房间已经不是 `playing`，本地旧 `playing` 不再展示。
- 历史页合并顺序改为本地先入、云端覆盖，避免本地旧状态覆盖云端已结算状态。

## 验证记录

- [x] `node --check miniprogram/utils/util.js`
- [x] `node --check miniprogram/pages/create/create.js`
- [x] `node --check miniprogram/pages/join/join.js`
- [x] `node --check miniprogram/pages/profile/profile.js`
- [x] `node --check miniprogram/pages/room/room.js`
- [x] `node --check miniprogram/pages/index/index.js`
- [x] `node --check miniprogram/pages/history/history.js`
- [x] `node --check cloudfunctions/recordScore/index.js`
- [x] `node --check cloudfunctions/getHistory/index.js`
- [ ] 微信开发者工具端到端验证：需要重新部署 `recordScore/getHistory` 后，用同一用户在电脑和手机验证头像、首页、历史一致性。
