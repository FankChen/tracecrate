# Organic launch plan

[Home](../README.md) · [Publication gates](release.md) · [Roadmap issue seeds](roadmap.md)

**Planning document, not a record of distribution already performed.** [Public repository](https://github.com/FankChen/tracecrate) · [Hosted demo](https://fankchen.github.io/tracecrate/) · [First successful CI](https://github.com/FankChen/tracecrate/actions/runs/34461509021). The full CI job passed, including 36 browser tests; the hosted page and its JS/CSS assets returned HTTP 200. Post-deployment interactive smoke and screenshot verification remain pending; the first Pages run was still wrapping up at this snapshot. All launch copy below is draft: no community post, published video, or release is claimed. See [verification](verification.md).

## Phase 0 — Earn a useful first impression

Ship one useful flagship workflow: **open a synthetic run → inspect a tool call → understand a recorded difference → review a structure-only report**. Keep that experience coherent before broadening ingestion claims.

- Complete the remaining release/security checklist. CI browser E2E has passed on the production preview server; record the separate post-deployment smoke result before claiming live-site interactive validation. Local browser downloads remain blocked.
- Ask a small number of willing developers who already inspect agent traces to try the synthetic walkthrough. Do not request their private histories. Ask: “Where did the sequence become unclear?” and “Which unsupported shape should a synthetic fixture model?”
- Resolve confusing states and document limitations. Use voluntarily supplied feedback, not added in-app analytics, as evidence of usefulness.

**Exit:** a reproducible local quickstart, actual recorded check results, reviewed privacy copy, and a usable flagship—not a target star count.

## Phase 1 — Show 30 seconds of real interaction

Record the running app with synthetic data only; close unrelated windows/notifications and inspect every frame. Unlike the README's labeled product illustration, the clip should show real interaction. Do not fabricate an upload speed, benchmark, or user testimonial.

| Time | Shot | Caption |
| --- | --- | --- |
| 0–5s | Open built-in demo | “Your agent ran. Read what happened.” |
| 5–12s | Select tool event; show recorded input/output | “Inspect the sequence locally.” |
| 12–18s | Open Insights | “Heuristics, not a root-cause verdict.” |
| 18–23s | Compare the synthetic pair | “Descriptive differences. Synthetic data.” |
| 23–30s | Structure-only preview and export | “Review what you share. Metrics can still be sensitive.” |

Add captions and an accessible text walkthrough. Use the original SVG as an explicitly labeled illustration, not evidence of tested rendering. The hosted demo is available above; publish the clip only after review and add its actual link afterward. No clip or verified screenshot artifact is claimed yet.

## Phase 2 — Relevant, legitimate posts

- Choose one developer community where a local AI trace viewer solves a recurring problem. Read its promotion, launch, and posting-frequency rules first; ask moderators if uncertain.
- Post an original, useful explanation with the 30-second clip, accurate source/demo status, format limits, and a specific feedback question. Clearly disclose being a contributor.
- Appropriate candidates may include a permitted Show HN submission, a relevant developer forum's showcase thread, or a community's designated project-sharing channel. Suitability and rules must be checked at posting time; these are not promised placements.
- Respond to questions with concrete examples and synthetic reproductions. Do not copy the same pitch indiscriminately across communities or turn support threads into advertisements.
- In upstream communities, share only where directly relevant and allowed. Do not open mass issues/PRs to advertise, scrape contacts, send unsolicited bulk DMs, buy engagement, trade stars, or offer rewards for stars.

**Exit:** substantive feedback you can act on. No spam, artificial popularity, or star-count prediction.

## Phase 3 — Follow through

Triage feedback into reproducible bugs, documentation gaps, and [proposed issues](roadmap.md). Choose one tractable improvement, implement it with synthetic tests, and report the verified change back where follow-ups are welcome. Publish a short technical note about a real lesson (for example cache-inclusive input accounting), with no claim of invention or universal superiority. Measure voluntarily reported successful workflows and resolved issues, not covert usage telemetry.

## English launch copy — DRAFT, not yet posted

**TraceCrate: a local workbench for reading AI agent traces**

I'm sharing TraceCrate, an original client-side workbench for inspecting recorded agent runs without a backend, telemetry, accounts, or API keys. Open an existing supported Claude Code message file, Codex rollout, OTLP JSON subset, or TraceCrate report—or just explore the synthetic demo. Nothing in a trace is executed.

The useful loop is small: inspect a timeline, review heuristic findings, compare recorded metrics, and export a structure-only report. Comparison is descriptive, not a controlled benchmark. Pattern redaction is optional and may miss secrets; even structure-only timing and metrics can be sensitive.

[Source](https://github.com/FankChen/tracecrate) · [Try the hosted demo](https://fankchen.github.io/tracecrate/) · [Local quickstart](../README.md) · [Format limits](formats.md). Local checks pass with 107 unit tests; the [first successful CI run](https://github.com/FankChen/tracecrate/actions/runs/34461509021) passed the full job, including 36 browser tests. The hosted page and assets returned HTTP 200; live-site interactive smoke and screenshot verification are still pending. A 30-second interaction clip is planned, not published, and no release exists yet. Which part of reading an agent run would you want a synthetic example to explain better?

*Before posting: replace status statements only with verified results and add actual links; disclose your own contributor role accurately. Do not publish this draft verbatim as if the clip exists.*

## 中文发布文案 — 草稿，尚未发布

**TraceCrate：在本地读懂 AI agent 的运行记录**

我在分享 TraceCrate，一个原创的纯客户端 trace 工作台：无后端、无遥测、无账号，也不需要 API key。可以查看已有的 Claude Code 正常消息文件、Codex rollout、OTLP JSON 子集或 TraceCrate 报告，也可以直接体验合成示例。日志里的命令不会被执行。

核心流程很小：查看时间线、检查启发式提示、对比已记录指标，再导出仅结构报告。对比只是描述性统计，不是受控实验；模式脱敏可能漏掉秘密，仅结构导出的时间与指标也可能敏感。

[GitHub 源码](https://github.com/FankChen/tracecrate) · [在线演示](https://fankchen.github.io/tracecrate/) · [本地启动说明](../README.zh-CN.md) · [格式限制](formats.md)。本地检查通过，包括 107 项单元测试；[首次成功 CI](https://github.com/FankChen/tracecrate/actions/runs/34461509021) 完整通过，包括 36 项浏览器测试。线上页面及资源已确认返回 HTTP 200，线上交互 smoke 与截图验证仍待完成。30 秒操作视频尚未发布，也尚无正式 release。你最希望用一个合成样例解释运行记录中的哪个问题？

*发布前核实状态、补充真实链接，并如实说明自己的贡献者身份；不要把计划中的视频或验证写成已完成。*