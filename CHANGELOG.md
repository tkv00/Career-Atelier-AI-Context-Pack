# Changelog

User-facing changes are recorded here before release. See [the release policy](docs/RELEASING.md).

## [Unreleased]

### Added

- Synchronized package-version checks and a dry-run-first release preparation command.
- CI for runner/tooling tests on Windows and Linux, and web type checking, lint, and build.
- Tag-triggered draft releases, dependency-update configuration, and upgrade documentation.
- Character introductions, dedicated FAQs, and task-oriented installation and feature guides.

### Fixed

- Explain web signup, confirmation, and runner credential/project mismatches instead of treating every authentication failure as an incorrect password.

### Upgrade notes

- The setup wizard no longer creates temporary service passwords. Create the owner account in the web app and use the same credentials for the runner.
- Review changes to setup and database migrations before updating an existing installation.

No published release is claimed by this file. The existing package version `0.1.0` is the development baseline; move reviewed changes into a dated version section when preparing the first release. Uncommitted experiments are not automatically release contents.
