# Keyboard-only synthetic walkthrough / 键盘操作路径

[Home](../README.md) · [中文](../README.zh-CN.md) · [Verification](verification.md)

Use only the built-in synthetic demo. No agent installation or private file is needed. V0.2's automated keyboard path passed in the browser run recorded below; this is not a claim that every manual assistive-technology path was exercised. Keyboard automation and axe do **not** certify screen-reader accessibility.

| Step | Keys and expected focus | Purpose |
| --- | --- | --- |
| Enter workspace | Press Tab to the skip link; Enter moves into the workspace. Continue Tab through session controls and Export report to the active Timeline tab. | Visible focus and ordinary page navigation; no positive tab indexes. |
| Switch views | On a view tab, Right/Left moves to the next/previous tab; Home selects Timeline; End selects Compare. Tab leaves the tab list. | Inspect Insights or Compare without a mouse. |
| Focus evidence | On Timeline, Tab to search and type literal text; use native select controls for kind/status/order and the numeric duration input. | All filters combine. Unknown duration is excluded when a minimum is supplied. |
| Clear filters | Tab to Reset filters (or Clear filters in an empty result), press Enter. | Focus returns to Search events; all filters/order reset. |
| Open inspector | Tab to an event, press Enter or Space. | Selection opens and focus moves to Event details, including on mobile emulation. |
| Return from inspector | Escape from inside details, or Tab to Close event details and activate. | Focus returns to that event if still rendered, otherwise Search events. |
| Compare evidence | In Compare, use Session A/B, Comparison scope and Differences only; Tab to an event button and Enter. | Opens the original event/session and correct timeline page, then focuses details. |
| Export deliberately | Tab to Export report and Enter. Initial focus is Close export report; Tab/Shift+Tab stay inside the modal. | Structure only is default. Timing/token checkboxes are optional. |
| Inspect/close | Tab to Show redacted preview and Enter; continue to the preview/download controls. Escape closes. | Focus returns to Export report; reopening resets mode, checkboxes and preview. |

Native select keyboard conventions differ slightly by browser/OS. Use their normal arrow/Space/Enter keys. Do not document a focus trap workaround as intended behavior: report a reproducible blocker with a synthetic case.

## Browser evidence

- Test: [keyboard-only regression](../tests/v2.spec.ts), run by desktop Chromium and Pixel 7 emulation. The test uses Tab, arrows, Home/End, Enter, Space and Escape for the core path, checks focus trapping/return and executes axe on the dialog.
- Filter-reset and original-event navigation are separately checked by the same suite. They supplement, not replace, keyboard assertions.
- **Observed automation (2026-09-13):** [CI 34747596321](https://github.com/FankChen/tracecrate/actions/runs/34747596321), candidate `29bfa6ff462b112030cb1af3035d7a1002704908`, Chromium **153.0.8010.12**, GitHub-hosted Ubuntu Linux; desktop and Pixel 7 emulation both passed the keyboard path. All 64 browser cases passed with no failed/flaky cases reported. Local Chromium is unavailable; this is remote browser evidence, not a local manual walkthrough.
- The first candidate exposed a real Shift+Tab boundary problem in both projects. Explicit first/last modal focus wrapping fixed it; the original test assertions were retained. This result is not inferred from v0.1 tests.
- No physical Android, Firefox/WebKit, screen-reader or manual assistive-technology certification is claimed.

## 中文简述

Tab 顺序进入控件；视图标签用左右方向键切换、Home 回 Timeline、End 到 Compare。事件按钮按 Enter／空格后焦点进入详情；Escape 返回事件。清除筛选后焦点回搜索框。导出弹窗内 Tab／Shift+Tab 不离开弹窗，Escape 关闭并回到 Export report；重新打开恢复默认策略并收起预览。仅使用合成示例；自动化键盘验证不等于屏幕阅读器认证。