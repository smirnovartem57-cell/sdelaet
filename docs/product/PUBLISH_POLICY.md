# Sdelaet production publishing policy

Status: MANDATORY / FAIL-CLOSED

## Critical rule

No deployment may publish GitHub `main` to production until the currently running production state has been checked against the last recorded deployed Git SHA.

The purpose of this rule is to prevent a stale Git branch from overwriting newer server-side work.

Before every publication the deployment system MUST:

1. Read the last deployed SHA from `/var/lib/sdelaet/deploy/main.sha`.
2. Compare source-owned production files against that exact SHA.
3. Check both:
   - `/opt/sdelaet/current`;
   - public webroot `/var/www/www-root/data/www/onsdelaet.ru`.
4. Detect:
   - modified tracked files;
   - missing tracked files;
   - new server-only runtime/source files.
5. If any production drift exists, stop BEFORE copying any files.
6. Reconcile the production changes into Git and run the full test suite before publishing.
7. Create a pre-deploy backup.
8. Publish the new SHA.
9. Verify production matches the new SHA before recording it as deployed.

## Fail-closed behavior

Publication MUST be blocked if:
- this policy file is missing;
- the parity verifier is missing;
- the deployed SHA baseline is invalid;
- `PUBLISH_LOCK` exists;
- production drift is detected;
- automated readiness fails;
- API health verification fails;
- post-deploy parity fails.

A backup alone is NOT permission to overwrite production drift.

Do not bypass this gate because a deployment is urgent. Reconcile first, publish second.

## Parallel work / multi-chat rule

Several chats, worktrees, or developers may prepare changes at the same time. Parallel preparation is allowed; parallel production mutation is not.

Mandatory contract:

1. Every change is prepared in its own branch/worktree. Production is published only from GitHub `main`.
2. Before merge, the change must be refreshed against the latest GitHub `main`; stale branches must not be treated as publishable snapshots.
3. The canonical server deploy holds a server-side deployment mutex for the whole validation/copy/verification cycle. A second deploy exits without mutating production.
4. The deploy records the current production baseline SHA and verifies production parity against it before doing any work.
5. After automated tests, it must verify the same baseline and parity again.
6. Immediately before the first `rsync`/production mutation, it must perform a compare-and-swap style guard:
   - `/var/lib/sdelaet/deploy/main.sha` must still equal the baseline that was validated;
   - production parity must still match that baseline;
   - the exact source SHA must still equal the latest GitHub `main`.
7. If another chat merged newer work, another deploy advanced the baseline, or production changed directly, the stale deployment exits before copying files.
8. After publication, production parity is verified against the deployed SHA before that SHA is recorded as the new baseline.

This means the last publisher never assumes that the state it saw at the start is still current. It re-reads the authoritative state immediately before mutation and fails closed if anything moved.

## Incident that created this rule

On 2026-09-20 an automated deployment was enabled before verifying that GitHub `main` fully represented the newer production state. It overwrote newer server-side changes, including the homepage and other runtime work. This rule exists to make that class of incident technically impossible through the canonical deploy path.
