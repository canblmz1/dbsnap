# Security

`dbsnap` is designed for local development databases. It is not a production backup product and should not be used as one.

## Safety Boundaries

- Restore refuses non-local PostgreSQL hosts by default.
- Restore refuses production-looking database names and SQLite paths by default.
- The explicit override is `--force-i-know-what-i-am-doing`.
- Database URLs are redacted before printing.
- Passwords are passed to PostgreSQL tools through environment variables, not command-line arguments.
- `.dbsnaps` is added to `.gitignore` by `dbsnap init`.

## Reporting Issues

Please report vulnerabilities privately through GitHub Security Advisories when available, or email the maintainers listed in the repository profile. Include reproduction steps and the dbsnap version.

Do not include real database credentials in reports.
