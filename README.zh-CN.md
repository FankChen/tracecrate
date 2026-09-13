# TraceCrate — Agent 跑完了，看清发生了什么。

**隐私优先、纯客户端的 AI trace 工作台。读懂事件顺序，检查可疑模式，审慎分享。**

[![CI](https://github.com/FankChen/tracecrate/actions/workflows/ci.yml/badge.svg)](https://github.com/FankChen/tracecrate/actions/workflows/ci.yml)
[![Pages](https://github.com/FankChen/tracecrate/actions/workflows/pages.yml/badge.svg)](https://github.com/FankChen/tracecrate/actions/workflows/pages.yml)
[![Release v0.2.0](https://img.shields.io/badge/release-v0.2.0-blue)](https://github.com/FankChen/tracecrate/releases/tag/v0.2.0)

[English](README.md) · [V0.2 调研与设计](docs/v0.2-design.md) · [格式说明](docs/formats.md) · [隐私边界](docs/privacy.md) · [参与贡献](CONTRIBUTING.md)

![TraceCrate V0.2 合成示例实际截图：线上筛选控件、已记录指标、时间线和工具详情。](docs/screenshots/tracecrate-v0.2-desktop.png)

*来自 [Pages 34747767675](https://github.com/FankChen/tracecrate/actions/runs/34747767675) 的 V0.2 线上实际截图，已目视检查；1440 × 2104 整页。事件与数值均为合成示例，不是性能评测结果。*

TraceCrate 把你主动选择的 trace 文件变成可搜索的时间线、统计、启发式诊断和双会话对比。**无后端、无遥测、无账号、无需 API key**；不会运行 agent，也不会执行日志里的命令。

**[打开在线演示](https://fankchen.github.io/tracecrate/)** · **[v0.2.0 正式发布与下载](https://github.com/FankChen/tracecrate/releases/tag/v0.2.0)** · **[参与贡献](CONTRIBUTING.md)** · [GitHub 源码](https://github.com/FankChen/tracecrate)。无需安装即可探索合成示例，也可按下方说明本地运行。

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

- 时间线支持文本／ID／模型搜索，事件类型、状态与最短耗时联合筛选，按记录顺序或最长耗时排序；每页 100 个事件，缺失耗时不当作零。
- 展示记录的 token、明确错误与可用的耗时；缺失值保持未知，不估算费用。
- 启发式提示工具错误、长耗时、大输出、相同工具名与输入重复；不证明重试意图或根因。
- 双会话对比指标、工具调用次数及逐事件序列，差值为 B − A；展示变化字段，可筛选工具／差异并跳回任一侧原始事件。重复名称可能有对齐歧义。**描述性对比，不是受控实验或执行身份判定。**
- 默认严格「仅结构」导出，新增可选移除时间／token 元数据；预览、JSON、HTML 使用相同策略，移除值保持未知而非零。模式脱敏仍是独立的尽力而为选项；HTML 无脚本、无外部资源，原生 JSON 可重新导入。
- Web Worker 顺序读取解析，显示当前文件序号，30 秒单文件期限，可独立取消且保留已有会话；取消丢弃当前批次，清空移除整个工作区。会话仍仅在内存中，已下载文件不删除。

### 第二版操作路径

1. **Timeline** 选择 **Reported error** 或设置 **Min duration (ms)**，再选 **Longest first**；设置最短耗时后，未知耗时事件被排除，即使下限为零。
2. **Compare → Event-by-event comparison** 查看变化字段，选择 **Tools only** 缩小范围，点击任一侧事件返回原会话及正确分页。
3. **Export report → Structure only** 可选 **Omit timing metadata / Omit token usage**，预览后检查完整下载。切到模式脱敏会清除这两个选项，因为保留文本中仍可能存在相同元数据。

参见[官方资料与设计取舍](docs/v0.2-design.md)、[第二版说明](docs/releases/v0.2.0.md)及[键盘操作路径](docs/keyboard.md)。

## 格式与限制

| 格式 | 支持范围 | 不包含 |
| --- | --- | --- |
| Claude Code | 正常消息 JSONL、文本、工具调用/结果、部分系统记录 | 增量流式 delta；不保证所有私人历史版本兼容 |
| Codex | rollout JSONL 的 `session_meta`、`turn_context`、`response_item` 和部分 `event_msg` | 任意 `codex exec --json` 输出、推理块和流式 delta |
| OTLP JSON | `resourceSpans/scopeSpans/spans`、嵌套结构属性及新旧缓存写入字段 | protobuf、接收端服务、完整 OTLP、MCP transcript |
| TraceCrate 原生 | 单份 `schemaVersion: 1` JSON | 未知字段被移除；分享导出不是原始备份 |

[详细格式、合成样例及官方公开参考](docs/formats.md)。`Usage.input` **已包含** `cacheRead` / `cacheWrite`，缓存是子计数，不可再次相加；总 token 为 input + output。

每文件最大 20 MiB UTF-8，输入记录及归一化事件各最多 20,000，深度最多 60；一次最多 5 文件，内存最多 10 会话（包含示例）。导入期限为每文件 30 秒，后台计时节流可能延迟执行。要求 Web Worker；整文件读取，不是流式导入。序列比较每侧最多 2,000 个所选事件、400 次编辑距离、200 ms 对齐预算；超限明确提示而非展示不完整差异。分析、比较和导出仍在主线程。详情与预览最多显示 50,000 字符，完整下载不限于此。[架构说明](docs/architecture.md)。

## 隐私不是绝对保证

应用本身不上传 trace、不发送遥测；浏览器扩展、受损设备或被修改的托管页面仍可能读取数据。静态站点托管方仍会收到 IP、User-Agent 等普通请求元数据。

默认「仅结构」通过严格允许列表移除自由文本、原始标识、名称、模型及输入/输出。时间与 token 默认保留、现可选择移除；事件顺序、数量、映射后的关系及状态仍保留，**也可能敏感**。「模式脱敏」保留文本，可能漏掉秘密。两种方式都不保证匿名化；预览可能截断，必须检查完整下载。清空内存不等于安全擦除。[隐私说明](docs/privacy.md) · [安全报告](SECURITY.md)。

## 开发与发布状态

`npm run check` 包括 lint、单元测试、浏览器测试类型检查及构建；`npm run test:e2e` 使用 Playwright，需要另行安装浏览器。`npm run package:release` 将已测试构建打包，附许可证与 SHA-256 校验和。

**V0.2 已正式发布 · 2026-09-13：** [v0.2.0](https://github.com/FankChen/tracecrate/releases/tag/v0.2.0) 指向 `dc5d92daabe84378d994f09637db317f36b21024`。[发布验收作业](https://github.com/FankChen/tracecrate/actions/runs/34748718079)通过 **225 项单元测试、全部 64 项浏览器测试**、lint、应用／浏览器 TypeScript、构建、覆盖率及依赖审计；核心及适配器行覆盖率 97.51%（不含 UI）。自动发布遇到 HTTP 500，已使用未修改的验收产物恢复草稿并正式发布；整个工作流仍标记失败，不能称为全流程成功。两个公开附件已匿名下载并通过 SHA-256 及原始产物字节比对。[Pages 34747767675](https://github.com/FankChen/tracecrate/actions/runs/34747767675)另行验证托管版本 `a95b96c1459b7454f88e5efb4d76af780ed1c661`，应用资源与发行包一致，包括离线导入、筛选／比较、导出及零运行时网络请求和无 console 错误检查。详见[完整来源与恢复记录](docs/verification.md)。

**历史首版 · 2026-09-10：** [v0.1.0](https://github.com/FankChen/tracecrate/releases/tag/v0.1.0) 在 `52d9ae9b73f815c264a3eb39f5fc3eedc5cb9715` 创建；当时的 107 项单元／36 项浏览器测试及 96.58% 核心行覆盖率仅为历史记录，不代替第二版验证。

**验证边界：** 桌面 Chromium 与 Pixel 7 模拟浏览器运行在 GitHub Actions；本地浏览器下载仍受限。不声称通过真实移动设备、Firefox/WebKit 或屏幕阅读器认证。社区发布帖和操作视频仍**未发布**。详见[历史验收记录](docs/verification.md)。

[CI](.github/workflows/ci.yml) 使用 Node 24。[Pages](.github/workflows/pages.yml) 仅允许默认分支手动部署。[Release](.github/workflows/release.yml) 同样只允许默认分支手动触发，重新检查、审计并运行浏览器测试后才打包和发布，拒绝替换已有标签。[发布清单](docs/release.md) · [开放贡献任务与路线图](docs/roadmap.md) · [自然传播计划与中英文草稿](docs/launch-plan.md) · [更新记录](CHANGELOG.md)。

TraceCrate 是原创项目，与 Anthropic、OpenAI、OpenTelemetry 无隶属或背书关系。[MIT 许可证](LICENSE)，copyright 2026 TraceCrate contributors。