# Publication and release checklist

[Home](../README.md) · [Launch plan](launch-plan.md)

**Repository:** [FankChen/tracecrate](https://github.com/FankChen/tracecrate). See the [verification record](verification.md) for actual checks and the README for live deployment status. This checklist also applies to future releases; a package version alone is not a published release.

**Current snapshot · 2026-09-10:** the repository is public; the [first successful CI run](https://github.com/FankChen/tracecrate/actions/runs/34461509021) passed the full job with 36 browser tests at commit `07a87aba1e4f7778057eafc3dca6159118b0fe43`. Local checks passed with 107 unit tests. The [hosted demo](https://fankchen.github.io/tracecrate/) and its JS/CSS assets returned HTTP 200. The [first Pages run](https://github.com/FankChen/tracecrate/actions/runs/34461509842) was still wrapping up; its final success is not recorded here. Post-deployment interactive smoke and screenshot verification remain pending. **No release exists; the changelog stays Unreleased.** Unchecked items below are review gates, not a claim that completed CI or hosting checks never ran.

## 1. Review before making anything public

- [ ] Confirm this is the intended TraceCrate project root, not a parent workspace or a directory containing other projects.
- [ ] Review the entire proposed repository and its history, not just the working tree: no secrets, actual agent histories, customer code/prompts, personal paths, private exports, browser traces, or local environment files. Ignore rules do not sanitize already tracked files/history.
- [ ] Keep fixtures and the 30-second recording synthetic. Review generated static assets as well as source; Vite copies public assets into the build.
- [ ] Check MIT copyright/third-party notices and the original artwork. Do not claim another organization's endorsement.
- [ ] Run `npm ci` and `npm run check` on Node 24; record actual output. Install the approved browser runtime with `npx playwright install --with-deps chromium`, then run `npm run test:e2e`. Do not disable TLS or bypass corporate policy if installation is blocked; use an authorized runner.
- [ ] Confirm E2E tests exist and are discovered; do not use `--pass-with-no-tests`, `continue-on-error`, or remove the E2E gate to obtain a green build. A missing suite is a publication blocker.
- [ ] Manually inspect demo, synthetic imports, malformed input handling, clear-during-import, keyboard/dialog behavior, narrow viewport, comparison caveat, and both full exports. Record what is tested vs unverified.
- [ ] Review README claims, support table, privacy warnings, security channel, and changelog. Keep hosted demo/release claims pending until verified.

No installation, Git operation, repository creation, or publication is performed by this checklist itself.

## 2. Confirm repository access and settings

Use the existing [FankChen/tracecrate](https://github.com/FankChen/tracecrate) repository; do not create a duplicate. Confirm the selected account is authorized for this target. If GitHub CLI authentication is needed, use `gh auth login --web` and complete authorization in the browser; never paste tokens into commands, chat, issues, or the repository.

Review and publish only intended source/history through the normal Git workflow. Do not broadly stage a parent workspace or replace remotes blindly. Confirm the actual default branch; the workflows do not assume it is named main.

Enable private vulnerability reporting, review Actions permissions, require CI in branch protection/rulesets as appropriate, and review Dependabot updates. No API key or manually pasted deployment secret is required by TraceCrate's workflows.

## 3. Verify CI before deployment

[CI](../.github/workflows/ci.yml) runs on pushes and pull requests using official `actions/checkout@v4` and `actions/setup-node@v4`, Node 24, and:

1. `npm ci`
2. `npm run check`
3. `npx playwright install --with-deps chromium`
4. `npm run test:e2e`

Its repository permission is `contents: read`; checkout does not persist credentials. No `pull_request_target`, repository write token, deploy job, or secret is used. Do not claim CI passed until the actual run passes. Browser traces may contain page data: use only synthetic fixtures and review artifacts before sharing. Diagnostic reports/test results are uploaded with seven-day retention; never substitute private histories for synthetic fixtures.

## 4. Publish Pages manually

1. In repository **Settings → Pages → Build and deployment**, select **GitHub Actions**. This is a user prerequisite; the workflow does not automatically enable Pages.
2. Review the **github-pages** environment and restrict deployment branches to the actual default branch; add approval protection if desired.
3. Ensure the [Pages workflow](../.github/workflows/pages.yml) is present on the default branch. In **Actions → Pages → Run workflow**, select that branch and run manually. Other branch/tag refs are blocked by the job conditions.
4. The build job runs Node 24 installation, checks, and Chromium E2E before official `configure-pages@v5` and `upload-pages-artifact@v3` upload the tested production build. It has read-only contents/Pages access. Vite's relative base supports a project subpath; each deployment still needs actual URL and interaction checks.
5. The separate deployment job uses `deploy-pages@v4`. Only this job receives `pages: write` and `id-token: write`, and it does not check out or execute project code. Publication uses GitHub's short-lived workflow credentials/OIDC, not a pasted token.
6. Open the URL returned by the successful deployment job. Verify assets and workers load at the actual project path, then repeat the synthetic import/export walkthrough and check that no trace-content requests are sent. Record the revision/run and results.
7. Link only the actual verified URL, and distinguish HTTP/asset availability from interactive smoke results. The current demo URL is verified for HTTP availability; do not infer future deployment success or a published release from that result.

The workflow has only `workflow_dispatch`: no push/PR deployment and no release automation. A failed gate means no artifact/deployment. Re-running a known-good reviewed revision still requires the default-branch check and normal gates; do not grant branch bypasses for rollback. A suspected exposure warrants disabling Pages while investigating.

## 5. Optional first release

After CI and manual checks pass, choose an actual version, review release contents, and replace the unreleased changelog with accurate dated notes as appropriate. Create a release using the GitHub UI if desired; no automatic tag, package publish, or release workflow is provided. Keep test limitations and known format gaps in the notes. Only link a release after it exists. Announce one useful workflow, not first/best claims, performance gains from synthetic comparisons, or star-count predictions.