# 配置说明

> 定义 `miniprogram/config/env.js` 中各字段的用途、必填性和默认值。

## 一、配置位置

所有运行时配置集中在 `miniprogram/config/env.js`，该文件已加入 `.gitignore`，不会提交到仓库。

## 二、字段定义

| 字段 | 必填 | 默认值 | 上线需要 | 说明 |
|------|------|--------|----------|------|
| `CLOUD_ENV_ID` | 推荐 | `''` | 是 | 云开发环境 ID，在云开发控制台获取。留空时云函数调用会失败。 |
| `DEEPSEEK_API_KEY` | 否 | `'__PLACEHOLDER__'` | 否 | DeepSeek API Key，用于 AI 摘要生成。不填则使用内置本地模板，AI 摘要功能仍可用。 |
| `AD_BANNER_ID` | 否 | `''` | 上线后 | 微信流量主 Banner 广告位 ID。留空则不展示Banner广告。 |
| `AD_REWARDED_VIDEO_ID` | 否 | `''` | 上线后 | 微信流量主激励视频广告位 ID。留空则激励视频功能不可用。 |

## 三、安全默认值策略

代码中应遵循以下原则：

1. **必填配置**（如 `CLOUD_ENV_ID`）：调用云函数前应检查，空值时给出明确提示
2. **可选配置**：应有不依赖该配置的降级行为（如 DeepSeek API 不填时用本地模板）
3. **广告配置**：留空时不展示广告，不应因此崩溃

## 四、本地覆写机制

`env.example.js` 是模板文件，复制为 `env.js` 后填入真实值：

```bash
cp miniprogram/config/env.example.js miniprogram/config/env.js
```

本地开发时可直接修改 `env.js`，但不要提交。

## 五、环境分区

| 场景 | CLOUD_ENV_ID | DEEPSEEK_API_KEY | 广告位 |
|------|---------------|------------------|--------|
| 本地开发（模拟器） | 可留空 | 随意 | 随意 |
| 真机调试 | 需要 | 推荐填入 | 随意 |
| 体验版/正式版 | 必须 | 推荐填入 | 必须填入真实ID |

## 六、密钥安全

- `DEEPSEEK_API_KEY` 属于私密信息，严禁写入文档或提交到仓库
- 代码中的占位符应使用无意义字符串，如 `sk-xxxxxxxxxxxxxxxx`
- 如发现 KEY 泄露，应立即到 DeepSeek 控制台更换
