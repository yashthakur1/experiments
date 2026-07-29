# Releasing BitPanel

How to cut a release of the `bitpanel` npm package and the panel installer it
points at. Written after the 0.1.0 and 0.1.1 releases on 28 July 2026, while
the reasons for each step were still fresh.

- **Package:** [`bitpanel`](https://www.npmjs.com/package/bitpanel) on npmjs.com
- **Repo:** `github.com/yashthakur1/bitroot-panel` (the panel source; `cli/` is the published package)
- **Docs:** https://yashthakur1.github.io/bitroot-panel/ (GitHub Pages, `main` → `/docs`)

---

## The short version

```bash
cd ~/local-documents/coding-projects/bitroot-panel

git checkout develop
git merge --ff-only main                    # develop must start from the real tip

git checkout -b release/0.1.2
#   bump "version" in cli/package.json to 0.1.2
git add -A && git commit -m "…"

git checkout main
git merge --no-ff release/0.1.2 -m "Release 0.1.2"
git tag -a v0.1.2 -m "bitpanel 0.1.2 — <what changed>"

git checkout develop && git merge --no-ff main -m "Merge release 0.1.2 back into develop"
git checkout main

git push origin main develop                # branches first
git push origin v0.1.2                      # tag last — this is the trigger
```

Then watch it:

```bash
gh run watch "$(gh run list --workflow=release.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

CI publishes. You never type a password, and no token exists anywhere.

---

## Why it works this way

### Nothing publishes by hand

Publishing runs in GitHub Actions via **npm trusted publishing (OIDC)**. The job
proves its identity to npm through GitHub's OIDC provider — there is no token to
leak, rotate, or commit by accident.

This is not just tidiness. npm is retiring token-based publishing:

| Date | What happens |
|---|---|
| Early Aug 2026 | 2FA-bypass tokens stop skipping 2FA for account changes |
| ~Jan 2027 | 2FA-bypass tokens lose direct publishing entirely |

After that a publish token can only *stage* a release for a human to approve.
OIDC is the path that keeps working. ([changelog](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/))

### The version is pinned to the tag — in two places

Both halves are needed, and for a while only the first existed.

**The installer script** is fetched from the `vX.Y.Z` tag:

```
https://raw.githubusercontent.com/yashthakur1/bitroot-panel/v0.1.2/install.sh
```

**The panel source** is checked out at that tag too. The CLI passes its own
version through:

```bash
curl -fsSL <tagged install.sh> | BITPANEL_VERSION=0.1.2 bash
```

and `install.sh` does `git clone --depth 1 --branch v0.1.2`, then writes
`.bitpanel-version` recording the ref, commit and timestamp.

Until 0.1.2 the second half was missing: the script was pinned and then cloned
the *default branch*, so `bitpanel@0.1.1` installed whatever `main` was that
afternoon. The version number was decoration, and the README said otherwise.

Both fall back to `main` only when the tag is genuinely absent, and say so.

**Consequence:** the tag must contain a working `install.sh` **and** a working
panel. Test before tagging — the tag is what users get.

A shallow clone at a tag can still fetch other tags later
(`git fetch --depth 1 origin refs/tags/vX:refs/tags/vX`), which is what makes
in-place upgrades possible. Worth knowing, because it is not obvious that a
`--depth 1` clone can move at all.

### The panel updates itself

From 0.1.2 on, a running panel compares itself against the latest published
version and can move to it without a terminal.

| | |
|---|---|
| Installed version | `git describe --tags --exact-match`, falling back to `.bitpanel-version` |
| Latest version | `https://registry.npmjs.org/bitpanel/latest`, cached an hour |
| Applied by | Setup tab → Panel version → *Update to X.Y.Z* |

npm is the source of truth rather than the GitHub API: same version as the tag,
no rate limit, no credential. `git describe` is asked *before* the marker file —
the marker records what the installer last wrote, `describe` reflects what is
checked out now, and when they disagree the checkout is the truth.

The update runs **detached, logging to `~/.config/bitroot-panel/update.log`**.
It has to: the build takes minutes on a phone, and the process being restarted
is the one serving the request that asked for it. The UI polls that log rather
than holding a connection that is going to be cut.

**A machine installed from a branch says so** and offers nothing — there is no
release to compare against. Both development machines here are push-deployed,
so they read *"installed from a branch"*. That is correct, not a bug.

**Users below 0.1.2 cannot be reached retroactively.** The checking code did not
exist in what they installed; they need one final `npx bitpanel install`. That
cost ends at 0.1.2.

### The workflow refuses to publish a mismatch

`release.yml` compares the tag against `cli/package.json` and exits non-zero if
they disagree — a package that does not match the tag it claims to come from
defeats the pinning entirely. It also runs `npm pack --dry-run` first, so a
broken `bin` path or a missing file is caught before the registry, where a bad
version can only ever be deprecated, never replaced.

### Validating the workflow without releasing

`workflow_dispatch` runs it by hand. That path **cannot publish** — it checks
out, installs and packs, then stops. Pushing a `v*` tag stays the only route to
the registry, which keeps the published artefact tied to a ref rather than to
whoever pressed a button, and keeps the provenance attestation meaningful.

```bash
gh workflow run release.yml --ref main
```

Use it after touching the workflow. Otherwise a change to it is unexercised
until the next release, and a break surfaces halfway through one.

---

## One-time setup (already done — recorded for a rebuild)

### npm trusted publisher

npmjs.com → package → **Settings** → Trusted Publisher → GitHub Actions:

| Field | Value |
|---|---|
| Organization or user | `yashthakur1` |
| Repository | `bitroot-panel` |
| Workflow filename | `release.yml` |
| Environment name | *(empty)* |
| Allowed actions | `npm publish` ✔ |

`npm stage publish` is deliberately **off**. Staging makes a publish wait for
human approval, which would defeat a tag-triggered release. Turn it on only if
you want that gate.

### npm publishing access

Same page → **Publishing access** → **Require two-factor authentication and
disallow tokens (recommended)**.

No token can publish this package. Trusted publishers keep working regardless —
npm's own note on that page confirms it, and release 0.1.1 published cleanly
with this setting on, which is the proof.

### The workflow file

`.github/workflows/release.yml`, triggered on `v*` tags. It needs:

```yaml
permissions:
  contents: read
  id-token: write     # without this, npm cannot verify the job
```

and `npm install -g npm@latest`, because the runner's bundled npm predates OIDC
support.

---

## After every release, verify

```bash
npm view bitpanel version dist-tags.latest       # the new version, tagged latest
npm view bitpanel dist.attestations              # SLSA provenance present

# on a clean machine
npx --yes bitpanel --version                     # matches the release
npx --yes bitpanel url                           # points at vX.Y.Z, NOT main
npx --yes bitpanel url 2>&1 >/dev/null           # silent when properly pinned
```

Then, on a machine that installed it — the check that the pin reached the panel
and not just the script:

```bash
cd ~/apps/bitroot-panel
git describe --tags --always                     # vX.Y.Z, not a bare commit
cat .bitpanel-version                            # ref= commit= installed=
```

The Setup tab should read *"Running X.Y.Z, which is the latest release."* If it
says *"installed from a branch"* on a machine installed via npm, the pin did not
reach the clone.

### Provenance

OIDC publishes generate a **signed SLSA v1 provenance attestation**, logged to
Sigstore's public transparency log. Anyone can verify the tarball was built from
your commit, in your repo, by that workflow — no trust in npm, or in you,
required. A token publish cannot produce this. If `dist.attestations` is empty,
something published outside CI.

### A real install

The npm package is only a front door; the installer is the product. On a throwaway
VM (OrbStack Ubuntu works well):

```bash
ssh ubuntu-mac@orb 'pm2 delete all; rm -rf ~/apps/bitroot-panel ~/bin'
ssh ubuntu-mac@orb 'npx --yes bitpanel install'
```

Then check the things that have actually broken before:

```bash
ss -lntp | grep 3210                             # bound on 3210, not 3000
curl -s -o /dev/null -w '%{http_code}' localhost:3210/setup
[ -d ~/apps/bitroot-panel/node_modules/typescript ] && echo ok
ls ~/bin | wc -l                                 # ~14 scripts
command -v project                               # the project CLI is on PATH
```

---

## Troubleshooting

Every one of these was hit for real.

| Symptom | Cause | Fix |
|---|---|---|
| `npm error code EOTP` — "requires a one-time password" | A token is publishing, and the package/account requires 2FA. Granular tokens do **not** override this unless created with the bypass option, which is a checkbox shown *at token creation*. | Publish via CI (OIDC). Locally, `npm login` first. |
| `npm error code ENEEDAUTH` — "need auth" | The machine has no npm credentials. Easy to hit if earlier attempts used `--userconfig` pointing elsewhere. | `npm login` |
| npm asks for an OTP but no code arrives | The account uses a **passkey**. Passkeys are WebAuthn — there is no 6-digit code, ever. npm prints a browser URL instead. | Complete it in the browser. `--otp=` cannot help. |
| Workflow runs but does not publish | Tag and `cli/package.json` disagree; the guard exits 1. | Bump the version, retag. |
| Publish succeeds but no provenance | It published outside CI, or `id-token: write` is missing. | Check the workflow permissions. |
| GitHub Pages serving stale content | The Pages build did not fire for that commit. | `gh api -X POST repos/yashthakur1/bitroot-panel/pages/builds`, then poll `.../pages/builds`. |
| Setup tab says "installed from a branch" after an npm install | `BITPANEL_VERSION` did not reach `install.sh`, so it cloned the default branch. | Check the CLI passes it: `curl … \| BITPANEL_VERSION=x.y.z bash`. |
| Update button does nothing visible | It is detached by design and takes minutes. | `cat ~/.config/bitroot-panel/update.log` on the server. |
| A shipped script behaves like an older version | Scripts live in `~/bin`, outside the deployed tree. The post-receive hook syncs them, but only for the panel's own repo, and only files with a shebang. | Re-push, or copy from `server-scripts/` and restart the service. |
| A value is in `.env` but the panel does not see it | pm2 captured a blank at first start and dotenv never overwrites an existing variable, so the blank outlives every edit. | `set -a; . ~/apps/bitroot-panel/.env; set +a; pm2 restart bitroot-panel --update-env` |

### If a bad version reaches npm

You cannot replace it. Publish a fixed patch version and, if it is genuinely
harmful, `npm deprecate bitpanel@X.Y.Z "reason"`. Unpublishing is restricted to
72 hours and breaks anyone who already installed it.

---

## Installer bugs worth remembering

These made a fresh install impossible and none showed up in local testing —
only on a genuinely clean machine.

**`npm ci --omit=dev` breaks the build.** Next needs TypeScript to read the
`@/*` path aliases out of `tsconfig.json`. Without it, every internal import
fails with *"module not found"* for files sitting right there in the repo — the
error points at missing source when the real cause is a missing toolchain. The
build is a compile step; it needs the build tools. Use `--include=dev`
explicitly, since npm silently drops dev dependencies when `NODE_ENV=production`
— exactly the environment an installer runs in.

**`PORT` in `.env` does not reach `next start`.** Next reads the port from the
*process* environment, not from a dotenv file. The installer wrote `PORT=3210`
into `.env`, announced the panel on 3210, and the panel bound 3000 — while
nginx, the printed URL and the docs all pointed at 3210. Pass it to pm2 at start,
and use `--update-env` on restart.

**`pm2` remembers a blank and dotenv will not overwrite it.** The installer
writes empty placeholders for `CF_API_TOKEN` and `CF_ZONE_ID`; pm2 captures them
at first start; dotenv never overwrites a variable that is already set. The
empty string then outlives every later edit — a token sat in `.env`, 53
characters of it, while the process held `''`. Neither `pm2 restart` nor
`--update-env` reads `.env`; the file has to be sourced into the restarting
shell first.

**The general lesson:** every one was found by running the installer on a clean
box, not by reading it. Bugs concentrate in failure and recovery paths, and a
wiped VM is the only honest test. The same applies to probes: four separate
checks in the setup view were wrong because they tested a proxy — a CLI on
`PATH`, a config file's presence, a substring of command output, a regex over
JSON — instead of the capability itself.

---

## Versioning

Plain semver, on the CLI package:

- **patch** — installer fixes, CLI fixes, anything that does not change what a user types
- **minor** — new commands, new panel capabilities
- **major** — the install flow or the panel's contract changes under someone

The panel itself is not versioned separately; the tag covers the whole repo, and
the CLI version is what selects it.

---

## Credentials

Nothing in this process needs a long-lived publish credential. If one ever gets
created, it does not belong in a chat window, a commit, or a config file inside
the repo — and it should be revoked once the thing that needed it is done.

The account is **bitroot-org** on npmjs.com, 2FA via passkey.
