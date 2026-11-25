# Sdelaet deployment

## P0 payment release receipt · 2026-11-25

- [PR #15](https://github.com/smirnovartem57-cell/sdelaet/pull/15), approved HEAD `818a8f0653e699bfff59239fce8de6e5285fd4bb`, previous deployment `45451f745883756182b583f910d47bbafa46d0e0`, deployed SHA `2a89d6d47deeece659fb27ac06eb104a11c1e368`. [Exact deployment workflow](https://github.com/smirnovartem57-cell/sdelaet/actions/runs/45697288328).
- Protected FirstVDS backup ID `20261125-pr15-818a8f0`. Restored copies of the payments and watchdog JSON parsed successfully. The application SQLite copy passed integrity_check, and the unit and runtime manifests verified.
- Both payment units ran on Node.js 24.20.0. Public health and exact-SHA parity passed. All eight orders and existing task and CRM rows were retained. The first post-cutover watchdog run succeeded, recovered one paid CRM projection, and left zero pending CRM deliveries.
- Tariffs 990 / 2 590 / 690 / 1 790 ₽ verified. No new refunds appeared in the production snapshot. Replay of a missed refund and stale approvals passed on the exact code with the bank emulator. No live charge was initiated.

### Payment release checks

- Stage the separate Payment API and watchdog with the same verified Node 24 binary. System Node 18.19.1 cannot load `node:sqlite`. Verify shared sidecar lock access under the actual service users and application read access to the same JSON.
- Stop automated deployment and hold the canonical publish lock before merge. Quiesce both payment writers for the backup. Verify a restore of the order JSON, watchdog state, unit configuration, and application SQLite before cutover.
- Record the first scheduled watchdog result and the number of pending CRM deliveries. If rollback is needed, preserve live order and CRM changes since the backup before restoring code. A whole-file data restore requires reconciling those changes first.

## Search quality release receipt · 2026-11-26

- [PR #160](https://github.com/smirnovartem57-cell/sdelaet/pull/160), approved HEAD `b2bdf49b6b83389ea5b76ace2337a74813581ced`, previous deployment `2a89d6d47deeece659fb27ac06eb104a11c1e368`, deployed SHA `2ceb59f418e7736d094c737cd77de1d038a2e836`.
- Protected backup ID `20261126-pr160-b2bdf49`. Restore checks passed for order JSON, watchdog state and application SQLite. Source tree, public exact-SHA marker, parity and public health matched the deployed release.
- Payment runtime files and unit overrides matched the pre-release hashes. Payment API and watchdog remained on Node.js 24.20.0. All eight orders and existing task and CRM rows were retained. The watchdog was healthy and zero CRM deliveries were pending. Four plan amounts were verified.
- PR CI and independent exact-HEAD review passed. The controlled production check made no paid search or banking calls. No rollback was required.

### Search release rollback

Hold the canonical publish lock and stop its timer before restoring code. Restore the verified application and public webroot snapshots first. Verify base parity and application health, then record the restored exact base marker. Leave current orders, CRM and task data in place, including any events created during the window. Keep deployment gated if restored parity or health fails.

## Canonical deployment path

Production site deployment is server-side and does not require GitHub SSH secrets.

Source:
- repository: `smirnovartem57-cell/sdelaet`
- branch: `main`
- repository is public
- exact remote SHA is resolved with `git ls-remote`

FirstVDS:
- host: `157.22.187.184`
- deploy source clone: `/home/sdelaet-runner/deploy-repo`
- application tree: `/opt/sdelaet/current`
- public nginx webroot: `/var/www/www-root/data/www/onsdelaet.ru`
- deploy state: `/var/lib/sdelaet/deploy/main.sha`
- public exact-SHA marker: `/assets/deploy-version.txt`

Systemd:
- service: `sdelaet-main-deploy.service`
- timer: `sdelaet-main-deploy.timer`
- timer interval: 60 seconds

## Deployment contract

Before files are copied, the server:
1. fetches the current exact `main` SHA;
2. resets the deploy clone to that SHA;
3. runs `node tools/platform-readiness.mjs`;
4. runs `node tests/metrika-goals-regression.mjs`;
5. creates a timestamped hard-link backup.

After validation it:
1. syncs the repository to `/opt/sdelaet/current`;
2. syncs public HTML/assets/uslugi/sitemaps to the nginx webroot;
3. checks API module syntax;
4. restarts `sdelaet-api.service` when present;
5. verifies the local health endpoint;
6. writes the exact SHA to state and `assets/deploy-version.txt`.

Backups:
`/opt/sdelaet/backups/auto-main/`

The latest ten automatic backups are retained.

## GitHub Actions

`.github/workflows/deploy-site-vds.yml` no longer uses:
- `VDS_HOST`
- `VDS_USER`
- `VDS_SSH_KEY`

GitHub Actions validates the repository and then waits until:

`https://onsdelaet.ru/assets/deploy-version.txt`

equals the workflow `GITHUB_SHA`.

Do not reintroduce SSH-secret deployment unless the server-side deployment architecture is intentionally retired.

## Production lock and parity

Production publication is always subordinate to `docs/product/PUBLISH_POLICY.md`.

- `/var/lib/sdelaet/deploy/PRODUCTION_LOCKED` means **do not publish**. It is a hard operational stop, not a warning.
- A GitHub `main` SHA newer than `/var/lib/sdelaet/deploy/main.sha` is not permission to deploy.
- Before any publication the canonical path must prove production parity against the recorded baseline, preserve concurrent work and pass the compare-and-swap guard immediately before mutation.
- Product/documentation PRs may continue while production is locked; they must not unlock or publish production as a side effect.

## Diagnostics

Run an immediate deployment check:

`systemctl start sdelaet-main-deploy.service`

View the latest deploy log:

`journalctl -u sdelaet-main-deploy.service -n 100 --no-pager`

Check timer state:

`systemctl list-timers sdelaet-main-deploy.timer --no-pager`

Check deployed SHA:

`cat /var/lib/sdelaet/deploy/main.sha`
