# 首页右滑删除自己创建的房间

## 变更级别

L2：涉及首页交互、本地缓存清理和云函数删除房间契约。

## 变更目的

首页进行中房间支持右滑删除，但只允许删除当前用户自己创建的房间，避免误删别人创建或自己只是加入的房间。

## 规则定义

- 删除入口只出现在首页进行中房间列表。
- 为兼容操作习惯，自己创建的房间支持向右滑露出左侧删除，也支持向左滑露出右侧删除。
- 只有当前用户是房间创建者时，右滑后显示删除按钮。
- 创建者判断优先使用：
  - `room.createdBy === 当前 openid`
  - 或 `players[].isCreator === true` 且该玩家 `openid/clientId` 匹配当前用户。
- 删除会移除云端 `rooms` 文档；本地同步移除：
  - `localRooms`
  - `roomPlayerIds`
  - `myRoomIds`
- 非创建者右滑不显示删除，不允许通过云函数删除。

## 云函数契约

`getHistory` 新增 action：

```js
{
  action: 'deleteOwnedRoom',
  roomId: string,
  clientId?: string
}
```

返回：

```js
{ code: 0, data: { roomId } }
```

如果当前用户不是创建者，返回 `code: -1`。

## 验收点

- [ ] 自己创建的首页进行中房间右滑或左滑露出删除按钮。
- [ ] 自己加入但不是创建者的房间滑动不露出删除按钮。
- [ ] 点击删除后有二次确认。
- [ ] 确认删除后首页该房间消失，本地缓存映射同步删除。
- [ ] 非创建者调用删除云函数会失败。

## 实施记录

- 首页房间卡片新增滑动状态 `swipeX` 和 `canDelete`。
- 只有 `createdBy/openid` 或 `players[].isCreator` 匹配当前用户时，房间卡片可滑出删除按钮。
- 首页删除会调用 `getHistory(action: 'deleteOwnedRoom')`，成功后调用本地清理工具移除 `localRooms/roomPlayerIds/myRoomIds` 引用。
- `getHistory` 云函数新增 `deleteOwnedRoom`，删除前校验当前调用者确实是房间创建者。

## 验证记录

- [x] `node --check miniprogram/pages/index/index.js`
- [x] `node --check cloudfunctions/getHistory/index.js`
- [ ] 微信开发者工具端到端验证：需要部署 `getHistory` 后验证创建者可删、非创建者不可删。
