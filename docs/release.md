# Publication and release checklist

[Home](../README.md) · [Launch plan](launch-plan.md)

**Repository:** [FankChen/tracecrate](https://github.com/FankChen/tracecrate). See the [verification record](verification.md) for actual checks and the README for live deployment status. This checklist also applies to future releases; a package version alone is not a published release.

**V0.2 published · 2026-09-13:** [v0.2.0](https://github.com/FankChen/tracecrate/releases/tag/v0.2.0) targets `dc5d92daabe84378d994f09637db317f36b21024`. [Release validation 34748718079](https://github.com/FankChen/tracecrate/actions/runs/34748718079) passed all checks, 225 unit / 64 browser tests, coverage and dependency audit. Automatic publication returned HTTP 500; the matching draft was recovered using the unchanged validation artifact and independently verified public downloads. The overall workflow remains failed. See [complete recovery and asset provenance](verification.md). [Pages 34747767675](https://github.com/FankChen/tracecrate/actions/runs/34747767675) separately passed actual V0.2 public smoke; the next section is historical V0.1 evidence.

**Published snapshot · 2026-09-10:** [v0.1.0](https://github.com/FankChen/tracecrate/releases/tag/v0.1.0) was created at tested commit `52d9ae9b73f815c264a3eb39f5fc3eedc5cb9715`. The [live demo](https://fankchen.github.io/tracecrate/) is deployed and interactively verified.

## Completed v0.1.0 evidence

- [x] [CI 34462095959](https://github.com/FankChen/tracecrate/actions/runs/34462095959) succeeded: lint, TypeScript/build, 107 unit tests, and 36 desktop Chromium / Pixel 7 emulation browser tests.
- [x] [Pages 34462098830](https://github.com/FankChen/tracecrate/actions/runs/34462098830) succeeded in build, deploy, and actual public-site Playwright smoke: subpath assets, cold offline first import using a synthetic Claude fixture after page load, default structure-only HTML download, and no console/page errors.
- [x] Downloaded the live-site evidence artifact and visually reviewed the [1440 × 2026 full-page synthetic demo screenshot](screenshots/tracecrate-desktop.png).
- [x] Created the actual [v0.1.0 release](https://github.com/FankChen/tracecrate/releases/tag/v0.1.0) at the tested commit above; see its dated [changelog entry](../CHANGELOG.md).

**Still unpublished:** launch posts, the interaction video, and an npm package. No Firefox/WebKit, screen-reader certification, or security audit is claimed. Private vulnerability reporting configuration is not verified here.

## 1. Review checklist for future releases

These are repeatable instructions, not pending v0.1.0 CI/deployment tasks or evidence that every manual review was completed.

- Confirm this is the intended TraceCrate project root, not a parent workspace or a directory containing other projects.
- Review the entire proposed repository and its history, not just the working tree: no secrets, actual agent histories, customer code/prompts, personal paths, private exports, browser traces, or local environment files. Ignore rules do not sanitize already tracked files/history.
- Keep fixtures and any recording synthetic. Review generated static assets as well as source; Vite copies public assets into the build.
- Check MIT copyright/third-party notices and the original artwork. Do not claim another organization's endorsement.
- Run `npm ci` and `npm run check` on Node 24; record actual output. Install the approved browser runtime with `npx playwright install --with-deps chromium`, then run `npm run test:e2e`. Do not disable TLS or bypass corporate policy if installation is blocked; use an authorized runner.
- Confirm E2E tests exist and are discovered; do not use `--pass-with-no-tests`, `continue-on-error`, or remove the E2E gate to obtain a green build. A missing suite is a publication blocker.
- Manually inspect demo, synthetic imports, malformed input handling, clear-during-import, keyboard/dialog behavior, narrow viewport, comparison caveat, and both full exports. Record what is tested vs unverified.
- Review README claims, support table, privacy warnings, security channel, and changelog. Claim each new hosted deployment/release only after verifying it.

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
6. The separate read-only verification job runs Playwright against the deployment URL, checking project-subpath assets, cold offline first import with synthetic Claude data after page load, default structure-only HTML download, and console/page errors. It retains the `live-site-evidence` artifact for seven days. Review the screenshot and record the revision/run and results; supplement automated smoke with manual checks as needed.
7. Link only the actual verified URL, and distinguish HTTP/asset availability from interactive smoke results. The current demo passed both in the recorded Pages run above; this does not establish future deployment success or replace an actual release record.

The workflow has only `workflow_dispatch`: no push/PR deployment and no release automation. A failed pre-deployment gate prevents deployment; a failed post-deployment smoke marks the run failed after the site has already been published and does not automatically roll it back. Re-running a known-good reviewed revision still requires the default-branch check and normal gates; do not grant branch bypasses for rollback. A suspected exposure warrants disabling Pages while investigating.

## 5. Publish subsequent releases

[v0.1.0](https://github.com/FankChen/tracecrate/releases/tag/v0.1.0) already exists. V0.2 adds a separate [manual Release workflow](../.github/workflows/release.yml):

1. Review the candidate on a branch; require its CI before a fast-forward/normal reviewed merge to the default branch. Confirm the package/lock version and version marker agree, and the matching versioned notes exist under the releases documentation directory.
2. Run **Actions → Release → Run workflow**, explicitly on the default branch. No push, PR or tag event automatically publishes a release.
3. Its read-only validation job runs locked installation, lint, 225 current unit tests, application/browser typechecking, build, coverage, dependency audit and 64 current Chromium desktop/mobile tests. Failures block publication; test counts may change in later releases.
4. The packaging script copies only the already-built static site, app license and runtime dependency licenses, then adds version/source/dirty-checkout metadata and static deployment instructions. CI refuses a dirty working tree. It creates a tarball and SHA-256 checksum; source archives are separately provided by GitHub.
5. A separate `contents: write` job downloads the artifact, verifies its checksum and uses the built-in short-lived GitHub token to create the tag at the tested SHA and publish assets. This job does not check out or execute application source. Existing tags are rejected, never force-moved or overwritten.
6. Record the actual release URL, tag SHA, validation run, asset names/checksums and Pages evidence in the verification record. Download and verify release assets independently. Pages remains separately dispatched; publishing a release does not deploy the site.

### Recovering a failed publication

A failed create-release API request can leave a draft even when the tag endpoint returns 404. Before rerunning, inspect the authenticated **release list**, drafts, tags and assets; do not interpret an absent public release as proof that nothing was created. Repeated creation can leave duplicate drafts.

If validation passed, a maintainer may recover the matching draft using that exact run's original artifact: verify the draft's tag/target SHA, clean build metadata and checksum; upload missing assets without replacing any existing bytes; verify remote digests; then publish and independently download/check the public files. If state is inconsistent, stop rather than guess. Never move a published tag, overwrite an asset, weaken validation or mark the failed workflow as successful. Record the failure and recovery explicitly. Remove an abandoned draft only after confirming its identity, that it remains unpublished and that it contains no assets.

Build artifacts contain synthetic examples only. Local dirty-checkout packaging is a smoke test, not release evidence. Run the packaged site through an approved static server; direct file-URL loading is not supported. No npm publish, offline installation promise or reproducible-byte-for-byte build claim is made. Preserve third-party notices when redistributing.

Keep test limitations and known format gaps in the notes. Only link a release after it exists. Announce one useful workflow, not first/best claims, performance gains from synthetic comparisons, or star-count predictions.