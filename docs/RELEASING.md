# Package and release policy

[한국어 비교·도입 배경](OPEN-SOURCE-READINESS.ko.md) · [Changelog](../CHANGELOG.md) · [Upgrade guide](UPGRADING.md)

## Distribution model

Career Atelier is one self-hosted product with three private npm packages: the root installer/tools, `web`, and `runner`. All share one product version. Their lockfiles stay separate because Vercel installs `web` independently and users install the runner on their PCs. All packages remain `private: true`; there is no public npm package or container image implied by this policy.

`packageManager` pins the maintainer/CI toolchain to npm 10.9.2. The project requires Node >=22.13.0; `.nvmrc` and `.node-version` select Node 22. CI tests the minimum Node 22.13.0 and Node 24 on Linux and Windows. These are configured targets, not proof of remote CI completion. Contributors should use the pinned npm to avoid incidental lockfile churn. npm itself does not enforce the `packageManager` field; CI installs the pinned version explicitly.

## Reproducible installation and checks

From the repository root:

```bash
npm ci
npm ci --prefix runner
npm ci --prefix web
npm run verify
```

`verify` checks synchronized versions, tooling and runner tests, web types, lint, and production build. Local web checks require the two public Supabase settings from setup. CI uses non-production placeholders and does not run signup, deploy, migrations, or AI-provider login. Fixture tests do not substitute for real CLI and browser smoke checks before release.

Use `npm install <dependency>` in the affected package when intentionally changing dependencies, and commit its manifest and lockfile together. Dependabot proposes weekly updates; it does not merge them automatically. Major changes require review. Next/ESLint and React packages are grouped to reduce incompatible partial updates. Do not use `npm audit fix --force` as an unattended upgrade strategy.

## Version rules

Use [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`, optionally `-beta.N` or `-rc.N`. The helper deliberately supports these two prerelease channels, not every possible SemVer label.

- Patch: compatible fixes and documentation/operational corrections.
- Minor: compatible capabilities. During `0.x`, incompatible changes also increment the minor version and must have migration notes.
- Major: incompatible public behavior after 1.0, including supported setup/CLI/MCP contracts.
- Prerelease: a version explicitly offered for testing. Never imply a beta is stable.

Database migrations are append-only and do not become reversible because a tag exists. Keep web and runner at the same release; mixed-version compatibility is not promised yet.

## Prepare a release locally

Start from reviewed changes on main with a clean working tree. Decide which changes actually belong in the release. Do not include local credentials, test accounts, or experimental output.

```bash
npm run release:prepare -- 0.2.0-beta.1
npm run release:prepare -- 0.2.0-beta.1 --write
npm run check:version
```

The first command previews; the second updates all three manifests and all three lock roots without altering dependency versions. Versions must increase. No command commits, tags, pushes, deploys, or publishes. Review the six-file diff after writing; filesystem write failures still require inspecting the working tree before retrying.

Update version references in both READMEs together. If changing the npm toolchain, also update the explicit npm install steps in CI.

Move reviewed `[Unreleased]` entries into a section such as `## [0.2.0-beta.1] - YYYY-MM-DD` in `CHANGELOG.md`, using the actual release date. Explain user-visible changes, required configuration/migrations, known limitations, and what was exercised. Keep `[Unreleased]` for subsequent work. Existing `0.1.0` metadata is only a baseline, not evidence that a release was published.

Run `npm run verify`, plus the relevant browser/CLI smoke checks, then commit according to [CONTRIBUTING.md](../CONTRIBUTING.md): English imperative subject and a body explaining why. Conventional Commit prefixes are not required and release automation does not infer version bumps from commit messages.

## Tag and review the draft

After the release commit is on main, an authorized maintainer can run:

```bash
git tag -a v0.2.0-beta.1 -m "Release 0.2.0-beta.1"
git push origin v0.2.0-beta.1
```

The tag workflow runs the same CI, checks that the commit belongs to main, requires an exact package/tag match and version-specific changelog notes, then creates a **draft GitHub Release**. Beta/RC tags are marked prerelease. Reruns leave an existing release unchanged. It does not publish npm packages or deploy Vercel. GitHub provides tag-based source archives when a release is published; there is no custom binary artifact yet.

Review the draft, upgrade instructions, CI results, and real-provider verification before publishing it in GitHub. Do not move an already published tag; issue a new version for a correction. GitHub Actions must be enabled. Configure branch/tag protection and required CI checks in repository settings; YAML files do not enable those settings automatically.
