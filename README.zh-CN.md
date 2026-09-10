# TraceCrate — Agent 跑完了，看清发生了什么。

**隐私优先、纯客户端的 AI trace 工作台。读懂事件顺序，检查可疑模式，审慎分享。**

[![CI](https://github.com/FankChen/tracecrate/actions/workflows/ci.yml/badge.svg)](https://github.com/FankChen/tracecrate/actions/workflows/ci.yml)
[![Pages](https://github.com/FankChen/tracecrate/actions/workflows/pages.yml/badge.svg)](https://github.com/FankChen/tracecrate/actions/workflows/pages.yml)
[![Release v0.1.0](https://img.shields.io/badge/release-v0.1.0-blue)](https://github.com/FankChen/tracecrate/releases/tag/v0.1.0)

[English](README.md) · [格式说明](docs/formats.md) · [隐私边界](docs/privacy.md) · [参与贡献](CONTRIBUTING.md)

![TraceCrate 合成示例实际截图：线上站点的已记录指标、时间线和选中的工具事件。](docs/screenshots/tracecrate-desktop.png)

*线上站点实际截图，已目视检查；1440 × 2026 整页。事件与数值均为合成示例，不是性能评测结果。*

TraceCrate 把你主动选择的 trace 文件变成可搜索的时间线、统计、启发式诊断和双会话对比。**无后端、无遥测、无账号、无需 API key**；不会运行 agent，也不会执行日志里的命令。

**[打开在线演示](https://fankchen.github.io/tracecrate/)** · **[v0.1.0 正式发布](https://github.com/FankChen/tracecrate/releases/tag/v0.1.0)** · **[参与贡献](CONTRIBUTING.md)** · [GitHub 源码](https://github.com/FankChen/tracecrate)。无需安装即可探索合成示例，也可按下方说明本地运行。

## 30 秒体验

打开[在线演示](https://fankchen.github.io/tracecrate/)即可按下面步骤体验。本地运行需要 **Node.js ≥22.12，推荐 24**，以及 npm：

```sh
git clone https://github.com/FankChen/tracecrate.git
cd tracecrate
npm ci
npm run dev
```

本地运行时，打开 Vite 输出的地址。依赖安装时间不计入下面的 30 秒操作：

1. **0–10 秒：** 自动载入两份合成分页修复示例。在 **Timeline** 打开工具事件，搜索或按事件类型筛选。
2. **10–20 秒：** 查看 **Insights** 和 **Compare**。示例中的 baseline / optimized 只是人工构造的标签，不是性能提升证据。
3. **20–30 秒：** **Export report → Structure only → Show redacted preview**，下载 JSON 或独立 HTML；分享前检查完整下载内容。

无需安装或运行 Claude/Codex。自己的文件可通过 **Choose files** 或拖放导入。Claude 会话文件属于私人数据：仅主动选择你有权查看的文件；应用不会扫描 agent 目录。**绝不能把真实历史打包为测试数据或演示素材。**

## 已有能力

- 时间线按记录顺序展示；支持搜索、类型筛选、相对时间、工具输入/输出及元数据，每页 100 个事件。
- 展示记录的 token、明确错误与可用的耗时；缺失值保持未知，不估算费用。
- 启发式提示工具错误、长耗时、大输出、相同工具名与输入重复；不证明重试意图或根因。
- 双会话对比指标与工具调用次数，差值为 B − A。**描述性对比，不是受控实验。**
- 默认严格「仅结构」导出，也可选择尽力而为的模式脱敏；HTML 无脚本、无外部资源，原生 JSON 可重新导入。
- 文件读取与解析在 Web Worker 中进行，会话只保存在内存；清空会终止导入。刷新后导入会话消失、恢复合成示例；已下载文件不会删除。

## 格式与限制

| 格式 | 支持范围 | 不包含 |
| --- | --- | --- |
| Claude Code | 正常消息 JSONL、文本、工具调用/结果、部分系统记录 | 增量流式 delta；不保证所有私人历史版本兼容 |
| Codex | rollout JSONL 的 `session_meta`、`turn_context`、`response_item` 和部分 `event_msg` | 任意 `codex exec --json` 输出、推理块和流式 delta |
| OTLP JSON | `resourceSpans/scopeSpans/spans` 与部分 GenAI 属性 | protobuf、接收端服务、完整 OTLP、MCP transcript |
| TraceCrate 原生 | 单份 `schemaVersion: 1` JSON | 未知字段被移除；分享导出不是原始备份 |

[详细格式、合成样例及官方公开参考](docs/formats.md)。`Usage.input` **已包含** `cacheRead` / `cacheWrite`，缓存是子计数，不可再次相加；总 token 为 input + output。

每文件最大 20 MiB UTF-8，输入记录及归一化事件各最多 20,000，嵌套深度最多 60；一次最多选择 5 个文件，内存最多 10 个会话（包含示例）。要求浏览器支持 Web Worker；整文件读取，不是流式导入。分析和导出仍在主线程进行。详情与导出预览最多展示 50,000 字符，完整下载不受此展示限制。[架构说明](docs/architecture.md)。

## 隐私不是绝对保证

应用本身不上传 trace、不发送遥测；浏览器扩展、受损设备或被修改的托管页面仍可能读取数据。静态站点托管方仍会收到 IP、User-Agent 等普通请求元数据。

默认「仅结构」通过严格允许列表移除任意自由文本、原始标识、名称、模型名和输入/输出，但保留事件关系、状态、token 数量和时间信息；**这些也可能敏感**。「模式脱敏」保留文本，可能漏掉秘密。两种方式都不保证匿名化；预览可能截断，必须检查完整下载。清空内存不等于安全擦除。[隐私说明](docs/privacy.md) · [安全报告](SECURITY.md)。

## 开发与发布状态

`npm run check` 包括 lint、单元测试和构建；`npm run test:e2e` 使用 Playwright，需要另行安装浏览器。

**已验证发布 · 2026-09-10：** [v0.1.0](https://github.com/FankChen/tracecrate/releases/tag/v0.1.0) 已在测试提交 `52d9ae9b73f815c264a3eb39f5fc3eedc5cb9715` 上创建。[CI 34462095959](https://github.com/FankChen/tracecrate/actions/runs/34462095959) 通过 lint、TypeScript/构建、**107 项单元测试及 36 项桌面 Chromium / Pixel 7 模拟浏览器测试**。已记录核心及适配器代码行覆盖率 **96.58%（不含 UI）**。

**线上验证：** [Pages 34462098830](https://github.com/FankChen/tracecrate/actions/runs/34462098830) 的构建、部署及实际公网 Playwright smoke 均成功：项目子路径资源、页面加载后切换离线且此前未导入时首次导入合成 Claude fixture、默认仅结构 HTML 下载，以及无 console/page 错误。上方截图来自该运行已下载的证据产物，详见[验收记录](docs/verification.md)。本地浏览器下载仍受限；不声称通过 Firefox/WebKit 或屏幕阅读器认证。社区发布帖和操作视频仍**未发布**。

[CI](.github/workflows/ci.yml) 使用 Node 24。[Pages](.github/workflows/pages.yml) 仅允许默认分支手动部署：用户先在 Pages 选择 GitHub Actions，再手动运行。[发布清单](docs/release.md) · [开放贡献任务与路线图](docs/roadmap.md) · [自然传播计划与中英文草稿](docs/launch-plan.md) · [更新记录](CHANGELOG.md)。

TraceCrate 是原创项目，与 Anthropic、OpenAI、OpenTelemetry 无隶属或背书关系。[MIT 许可证](LICENSE)，copyright 2026 TraceCrate contributors。