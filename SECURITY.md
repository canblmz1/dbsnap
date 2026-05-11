# Security Policy

`dbsnap` is intended for local development and test environments. It is not a production backup product and should not be used against production databases.

## Supported Scope

Security reports are most useful when they involve:

- leaking raw `DATABASE_URL` credentials in logs, metadata, or errors
- unsafe child-process execution
- bypassing local-database safety checks
- unintended destructive restore behavior
- path traversal through snapshot names or snapshot paths
- npm package integrity, bin entrypoint, or published artifact issues

## Safety Boundaries

- `save` and `restore` refuse non-local PostgreSQL hosts by default.
- `save` and `restore` refuse production-looking database names and SQLite paths by default.
- `NODE_ENV=production` is refused by default.
- Restore refuses snapshots saved from a different database target unless explicitly allowed.
- The risky-target override is `--force-i-know-what-i-am-doing`.
- The different-target override is `--allow-different-target`.
- Database URLs are redacted before printing, including usernames, passwords, and common secret query parameters.
- PostgreSQL passwords are passed through environment variables, not command-line arguments.
- Child processes use argument arrays with `shell: false`.
- `dbsnap init` adds the snapshot directory to `.gitignore`.

These checks reduce accidents, but they do not turn dbsnap into a production backup or disaster recovery system.

## Reporting Vulnerabilities

Please report vulnerabilities privately through GitHub Security Advisories when available. If that is not available, contact the maintainer through the repository profile.

Include:

- dbsnap version
- operating system
- Node version
- database type
- minimal reproduction steps
- whether the issue involves CLI usage or the Node API

Do not include real database credentials, production data, or private dumps in reports.
