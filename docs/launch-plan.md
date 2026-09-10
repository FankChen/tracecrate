# Organic launch plan

[Home](../README.md) · [Publication gates](release.md) · [Roadmap issue seeds](roadmap.md)

**Planning document, not a record of distribution already performed.** Hosted demo pending publication. All launch copy below is draft; there is no published clip/release link yet.

## Phase 0 — Earn a useful first impression

Ship one useful flagship workflow: **open a synthetic run → inspect a tool call → understand a recorded difference → review a structure-only report**. Keep that experience coherent before broadening ingestion claims.

- Complete the release/security checklist. Browser E2E is currently unverified because an enterprise firewall blocked browser download; wait for actual CI results before claiming browser validation.
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

Add captions and an accessible text walkthrough. Use the original SVG as an explicitly labeled illustration, not evidence of tested rendering. Publish the clip/demo only after review; add their actual links afterward.

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

Hosted demo pending publication; [local quickstart](../README.md) and [format limits](formats.md) are available. A 30-second interaction clip is planned, not published. Browser E2E is pending after a firewall-blocked browser download; no passing CI claim yet. Which part of reading an agent run would you want a synthetic example to explain better?

*Before posting: replace status statements only with verified results and add actual links; disclose your own contributor role accurately. Do not publish this draft verbatim as if the clip exists.*

## 中文发布文案 — 草稿，尚未发布

**TraceCrate：在本地读懂 AI agent 的运行记录**

我在分享 TraceCrate，一个原创的纯客户端 trace 工作台：无后端、无遥测、无账号，也不需要 API key。可以查看已有的 Claude Code 正常消息文件、Codex rollout、OTLP JSON 子集或 TraceCrate 报告，也可以直接体验合成示例。日志里的命令不会被执行。

核心流程很小：查看时间线、检查启发式提示、对比已记录指标，再导出仅结构报告。对比只是描述性统计，不是受控实验；模式脱敏可能漏掉秘密，仅结构导出的时间与指标也可能敏感。

托管演示待发布，可先看[本地启动说明](../README.zh-CN.md)与[格式限制](formats.md)。30 秒操作视频仍在计划中，尚未发布。企业防火墙阻止了浏览器下载，浏览器 E2E 和新 CI 的验证还在等待，当前不宣称通过。你最希望用一个合成样例解释运行记录中的哪个问题？

*发布前核实状态、补充真实链接，并如实说明自己的贡献者身份；不要把计划中的视频或验证写成已完成。*