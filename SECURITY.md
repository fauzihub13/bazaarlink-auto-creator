# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅        |

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Instead, report them
privately via GitHub's [Security Advisories](https://github.com/0xgetz/bazaarlink-auto-creator/security/advisories/new)
or by contacting the maintainer. We will acknowledge your report as soon as possible
and keep you informed of the fix.

## Handling of secrets

This tool generates real credentials. Never commit `results.json`, `.env*`, or any
file containing API keys or passwords — they are git-ignored by default. If you
accidentally expose a key, revoke it immediately in your BazaarLink dashboard.
