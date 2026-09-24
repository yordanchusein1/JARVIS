# Security policy

Arclight handles API keys, business contact details and your agency's leads, so we take security reports seriously.

## Reporting a vulnerability

**Please don't open a public issue.** Report it privately through GitHub instead: open the repository's **Security** tab and choose **Report a vulnerability**. Include what you found, how to reproduce it, and the impact you expect.

You'll get a reply within a week. Once a fix is available, we'll publish an advisory and credit you if you'd like.

## Supported versions

Arclight is in early access. Only the latest commit on the default branch receives security fixes.

## Scope

Examples of what we want to hear about:

- Bypassing dashboard sign-in or API-key authentication
- Making the audit worker reach private or internal network addresses (SSRF)
- Leaking API keys, session secrets or another agency's data
- Prompt injection from a prospect's website that changes what Arclight does beyond the text of a draft

## Hardening your installation

See the [deployment security checklist](docs/deployment.md#security-checklist). In short: keep API keys on servers, use long random secrets, put the dashboard behind HTTPS, and back up your database.
