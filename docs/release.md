# Publication and release checklist

[Home](../README.md) · [Launch plan](launch-plan.md)

**Current state:** hosted demo pending publication; no release URL or repository owner is assumed. The package version is not a published release. Browser download was blocked by the current enterprise firewall; browser E2E has not run here and the new GitHub workflows have not yet executed. Resolve and record validation before announcing a release.

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

## 2. Authenticate safely and choose the owner explicitly

If using GitHub CLI, authenticate with **`gh auth login --web`** and complete authorization in the browser. Do not paste tokens into shell commands, chat, issues, or this repository. Never use an invented owner inferred from a local path or account label. Verify the selected GitHub account and its authorization to publish under the intended organization.

**`OWNER` below is a placeholder the user must replace with their chosen GitHub user or organization. Do not run it literally.** Only after the review above passes and publication is explicitly approved, use `gh repo create OWNER/tracecrate --public` to create an empty public repository. This publishes repository visibility; it does not upload local source. If a repository already exists, skip creation and verify it is the intended target.

Review and publish only the intended source/history through your normal Git workflow. This guide deliberately does not automate broad staging, initialization, remote replacement, or pushing from an unknown working tree. Set/confirm the repository's actual default branch; the workflows do not assume it is named main.

Enable private vulnerability reporting, review Actions permissions, require CI in branch protection/rulesets as appropriate, and review Dependabot updates. No API key or manually pasted deployment secret is required by TraceCrate's workflows.

## 3. Verify CI before deployment

[CI](../.github/workflows/ci.yml) runs on pushes and pull requests using official `actions/checkout@v4` and `actions/setup-node@v4`, Node 24, and:

1. `npm ci`
2. `npm run check`
3. `npx playwright install --with-deps chromium`
4. `npm run test:e2e`

Its repository permission is `contents: read`; checkout does not persist credentials. No `pull_request_target`, repository write token, deploy job, or secret is used. Do not claim CI passed until the actual run passes. Browser traces may contain page data: use only synthetic fixtures and review artifacts before sharing. The workflow does not automatically upload diagnostic artifacts.

## 4. Publish Pages manually

1. In repository **Settings → Pages → Build and deployment**, select **GitHub Actions**. This is a user prerequisite; the workflow does not automatically enable Pages.
2. Review the **github-pages** environment and restrict deployment branches to the actual default branch; add approval protection if desired.
3. Ensure the [Pages workflow](../.github/workflows/pages.yml) is present on the default branch. In **Actions → Pages → Run workflow**, select that branch and run manually. Other branch/tag refs are blocked by the job conditions.
4. The build job runs Node 24 installation, checks, and Chromium E2E before official `configure-pages@v5` and `upload-pages-artifact@v3` upload the tested production build. It has read-only contents/Pages access. Vite's relative base supports a project subpath; it is not a verified live deployment until checked.
5. The separate deployment job uses `deploy-pages@v4`. Only this job receives `pages: write` and `id-token: write`, and it does not check out or execute project code. Publication uses GitHub's short-lived workflow credentials/OIDC, not a pasted token.
6. Open the URL returned by the successful deployment job. Verify assets and workers load at the actual project path, then repeat the synthetic import/export walkthrough and check that no trace-content requests are sent. Record the revision/run and results.
7. Only after verification, update demo references with the actual URL. Until then keep **hosted demo pending publication**. Do not manufacture a Pages URL from a guessed owner.

The workflow has only `workflow_dispatch`: no push/PR deployment and no release automation. A failed gate means no artifact/deployment. Re-running a known-good reviewed revision still requires the default-branch check and normal gates; do not grant branch bypasses for rollback. A suspected exposure warrants disabling Pages while investigating.

## 5. Optional first release

After CI and manual checks pass, choose an actual version, review release contents, and replace the unreleased changelog with accurate dated notes as appropriate. Create a release using the GitHub UI if desired; no automatic tag, package publish, or release workflow is provided. Keep test limitations and known format gaps in the notes. Only link a release after it exists. Announce one useful workflow, not first/best claims, performance gains from synthetic comparisons, or star-count predictions.