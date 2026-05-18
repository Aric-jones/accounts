# 24 小时未结算房间自动清理

## 变更级别

L2：涉及房间生命周期规则、本地缓存、跨页面入口和云函数契约。

## 变更目的

用户创建房间后，如果超过 24 小时仍未结算，房间应自动清除，避免首页长期展示无效进行中房间，也避免其他用户继续通过房间码加入过期房间。

## 规则定义

- 过期判断只针对 `status: 'playing'` 的房间。
- 过期时间按 `createdAt` 计算，而不是 `updatedAt`；创建超过 24 小时仍未结算即视为过期。
- `status: 'settled'` 的房间不清理，继续作为历史记录展示。
- 主记账数据仍以 `transactions` 为准，本次不新增记账口径，不扩大 `rounds` 使用范围。
- 本地缓存和云端房间都需要清理：
  - 本地移除 `localRooms` 中的过期未结算房间。
  - 同步移除对应的 `roomPlayerIds`、`myRoomIds` 本地映射。
  - 云端通过 `getHistory` 云函数新增 `cleanupExpiredRooms` action 删除过期未结算 `rooms` 文档。

## 触发时机

- 小程序启动时尝试清理一次。
- 首页加载进行中房间前清理一次。
- 房间页直达加载时，如果目标房间已过期，提示房间已过期并返回。
- 加入房间云函数发现房间已过期时，删除该房间并返回加入失败。

## 兼容策略

- 旧数据中 `createdAt` 可能是 ISO 字符串，也可能是云数据库 Date；本地和云端均需兼容两种格式。
- 云端清理失败不阻塞本地页面使用；首页仍会基于本地过期规则过滤。
- 已结算房间、历史隐藏记录、结算页数据不受影响。

## 验收点

- [ ] 创建时间超过 24 小时且 `status: 'playing'` 的本地房间不再出现在首页进行中列表。
- [ ] 创建时间超过 24 小时且 `status: 'settled'` 的房间仍出现在历史页。
- [ ] 通过房间码加入超过 24 小时未结算房间时，加入失败。
- [ ] 直接打开超过 24 小时未结算房间详情时，提示过期并返回。
- [ ] 清理不会修改或删除 `transactions` 主记账口径中的已结算历史。

## 实施记录

- 新增 `miniprogram/utils/room-expiration.js`，统一处理 24 小时过期判断、本地 `localRooms` 清理和本地房间映射清理。
- `app.js` 启动时触发清理；首页加载前触发清理并过滤过期房间。
- 房间页加载和支付前拉取最新房间时检查过期，过期后删除本地引用并返回首页。
- `getHistory` 云函数新增 `cleanupExpiredRooms` action，删除云端 `status: 'playing'` 且 `createdAt` 超过 24 小时的房间。
- `joinRoom` 与 `getRoomDetail` 云函数补充过期判断，避免过期未结算房间继续被加入或读取。

## 验证记录

- [x] `node --check miniprogram/utils/room-expiration.js`
- [x] `node --check miniprogram/app.js`
- [x] `node --check miniprogram/pages/index/index.js`
- [x] `node --check miniprogram/pages/room/room.js`
- [x] `node --check cloudfunctions/getHistory/index.js`
- [x] `node --check cloudfunctions/joinRoom/index.js`
- [x] `node --check cloudfunctions/getRoomDetail/index.js`
- [x] 本地过期判断脚本验证：超过 24 小时的 `playing` 返回 true，未超过 24 小时的 `playing` 和已结算房间返回 false。
- [ ] 微信开发者工具端到端验证：需创建测试房间并模拟 `createdAt` 超过 24 小时，验证首页、加入、直达房间和历史页。
