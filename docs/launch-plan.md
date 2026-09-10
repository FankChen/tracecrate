# Organic launch plan

[Home](../README.md) · [Publication gates](release.md) · [Open contribution tasks](roadmap.md)

**Community launch plan: posts and video are NOT published.** The [public repository](https://github.com/FankChen/tracecrate), [live demo](https://fankchen.github.io/tracecrate/), and [v0.1.0 release](https://github.com/FankChen/tracecrate/releases/tag/v0.1.0) exist. The release was created at tested commit `52d9ae9b73f815c264a3eb39f5fc3eedc5cb9715`. [CI 34462095959](https://github.com/FankChen/tracecrate/actions/runs/34462095959) succeeded with 107 unit and 36 browser tests. [Pages 34462098830](https://github.com/FankChen/tracecrate/actions/runs/34462098830) succeeded in build, deploy, and actual public-site smoke; its downloaded [synthetic demo screenshot](screenshots/tracecrate-desktop.png) was visually reviewed. All launch copy below remains draft. See [verification](verification.md).

## Phase 0 — Earn a useful first impression

Ship one useful flagship workflow: **open a synthetic run → inspect a tool call → understand a recorded difference → review a structure-only report**. Keep that experience coherent before broadening ingestion claims.

- The release, preview-server E2E, public-site smoke, and screenshot review are complete as recorded above. Recheck [release/security guidance](release.md) for future revisions and before community posting; do not infer unverified security settings from successful CI. Local browser downloads remain blocked.
- Ask a small number of willing developers who already inspect agent traces to try the synthetic walkthrough. Do not request their private histories. Ask: “Where did the sequence become unclear?” and “Which unsupported shape should a synthetic fixture model?”
- Resolve confusing states and document limitations. Use voluntarily supplied feedback, not added in-app analytics, as evidence of usefulness.

**Exit:** a reproducible local quickstart, actual recorded check results, reviewed privacy copy, and a usable flagship—not a target star count.

## Phase 1 — Show 30 seconds of real interaction

The README now shows an actual synthetic demo screenshot; the interaction video is still planned, not published. Record the running app with synthetic data only; close unrelated windows/notifications and inspect every frame. The clip should show real interaction, not animate the screenshot as if it were a recording. Do not fabricate an upload speed, benchmark, or user testimonial.

| Time | Shot | Caption |
| --- | --- | --- |
| 0–5s | Open built-in demo | “Your agent ran. Read what happened.” |
| 5–12s | Select tool event; show recorded input/output | “Inspect the sequence locally.” |
| 12–18s | Open Insights | “Heuristics, not a root-cause verdict.” |
| 18–23s | Compare the synthetic pair | “Descriptive differences. Synthetic data.” |
| 23–30s | Structure-only preview and export | “Review what you share. Metrics can still be sensitive.” |

Add captions and an accessible text walkthrough. The [reviewed live-site screenshot](screenshots/tracecrate-desktop.png) can accompany draft posts now; the original SVG is only an illustration, not a screenshot. Publish a clip only after recording and review, then add its actual link. No clip has been published.

## Phase 2 — Relevant, legitimate posts

- Choose one developer community where a local AI trace viewer solves a recurring problem. Read its promotion, launch, and posting-frequency rules first; ask moderators if uncertain.
- Post an original, useful explanation with the reviewed screenshot (or a reviewed 30-second clip once available), actual source/demo/release links, format limits, and a specific feedback question. Clearly disclose being a contributor.
- Appropriate candidates may include a permitted Show HN submission, a relevant developer forum's showcase thread, or a community's designated project-sharing channel. Suitability and rules must be checked at posting time; these are not promised placements.
- Respond to questions with concrete examples and synthetic reproductions. Do not copy the same pitch indiscriminately across communities or turn support threads into advertisements.
- In upstream communities, share only where directly relevant and allowed. Do not open mass issues/PRs to advertise, scrape contacts, send unsolicited bulk DMs, buy engagement, trade stars, or offer rewards for stars.

**Exit:** substantive feedback you can act on. No spam, artificial popularity, or star-count prediction.

## Phase 3 — Follow through

Triage feedback into reproducible bugs, documentation gaps, and [open contribution tasks and further proposals](roadmap.md). Issues [#4](https://github.com/FankChen/tracecrate/issues/4), [#5](https://github.com/FankChen/tracecrate/issues/5), and [#6](https://github.com/FankChen/tracecrate/issues/6) already exist; they are not implemented features. Choose one tractable improvement, implement it with synthetic tests, and report the verified change back where follow-ups are welcome. Publish a short technical note about a real lesson (for example cache-inclusive input accounting), with no claim of invention or universal superiority. Measure voluntarily reported successful workflows and resolved issues, not covert usage telemetry.

## English launch copy — DRAFT, not yet posted

**TraceCrate: a local workbench for reading AI agent traces**

I'm sharing TraceCrate, an original client-side workbench for inspecting recorded agent runs without a backend, telemetry, accounts, or API keys. Open an existing supported Claude Code message file, Codex rollout, OTLP JSON subset, or TraceCrate report—or just explore the synthetic demo. Nothing in a trace is executed.

The useful loop is small: inspect a timeline, review heuristic findings, compare recorded metrics, and export a structure-only report. Comparison is descriptive, not a controlled benchmark. Pattern redaction is optional and may miss secrets; even structure-only timing and metrics can be sensitive.

[Source](https://github.com/FankChen/tracecrate) · [Try the live demo](https://fankchen.github.io/tracecrate/) · [v0.1.0 release](https://github.com/FankChen/tracecrate/releases/tag/v0.1.0) · [Contribute](../CONTRIBUTING.md) · [Format limits](formats.md). [CI 34462095959](https://github.com/FankChen/tracecrate/actions/runs/34462095959) passed with 107 unit and 36 browser tests. [Pages 34462098830](https://github.com/FankChen/tracecrate/actions/runs/34462098830) passed build, deploy, and actual public-site smoke: subpath assets, cold offline first import of a synthetic Claude fixture after page load, default structure-only HTML download, and no console/page errors. The [synthetic demo screenshot](screenshots/tracecrate-desktop.png) is real and reviewed; a 30-second interaction clip is planned, not published. Which part of reading an agent run would you want a synthetic example to explain better?

*Before posting: replace status statements only with verified results and add actual links; disclose your own contributor role accurately. Do not publish this draft verbatim as if the clip exists.*

## 中文发布文案 — 草稿，尚未发布

**TraceCrate：在本地读懂 AI agent 的运行记录**

我在分享 TraceCrate，一个原创的纯客户端 trace 工作台：无后端、无遥测、无账号，也不需要 API key。可以查看已有的 Claude Code 正常消息文件、Codex rollout、OTLP JSON 子集或 TraceCrate 报告，也可以直接体验合成示例。日志里的命令不会被执行。

核心流程很小：查看时间线、检查启发式提示、对比已记录指标，再导出仅结构报告。对比只是描述性统计，不是受控实验；模式脱敏可能漏掉秘密，仅结构导出的时间与指标也可能敏感。

[GitHub 源码](https://github.com/FankChen/tracecrate) · [在线演示](https://fankchen.github.io/tracecrate/) · [v0.1.0 正式发布](https://github.com/FankChen/tracecrate/releases/tag/v0.1.0) · [参与贡献](../CONTRIBUTING.md) · [格式限制](formats.md)。[CI 34462095959](https://github.com/FankChen/tracecrate/actions/runs/34462095959) 通过 107 项单元测试和 36 项浏览器测试。[Pages 34462098830](https://github.com/FankChen/tracecrate/actions/runs/34462098830) 的构建、部署及实际公网 smoke 均成功：项目子路径资源、页面加载后切换离线且此前未导入时首次导入合成 Claude fixture、默认仅结构 HTML 下载，以及无 console/page 错误。[合成示例实际截图](screenshots/tracecrate-desktop.png) 已目视检查；30 秒操作视频仍未发布。你最希望用一个合成样例解释运行记录中的哪个问题？

*发布前核实状态、补充真实链接，并如实说明自己的贡献者身份；不要把计划中的视频或验证写成已完成。*