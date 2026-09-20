# Sdelaet deployment

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

## Diagnostics

Run an immediate deployment check:

`systemctl start sdelaet-main-deploy.service`

View the latest deploy log:

`journalctl -u sdelaet-main-deploy.service -n 100 --no-pager`

Check timer state:

`systemctl list-timers sdelaet-main-deploy.timer --no-pager`

Check deployed SHA:

`cat /var/lib/sdelaet/deploy/main.sha`
