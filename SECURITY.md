# Security policy

Please report vulnerabilities privately through GitHub's "Report a vulnerability" (Security tab) rather than a public issue.
Include steps to reproduce and the affected version. We aim to acknowledge reports within 7 days.

Design principles: minimal permissions (no host permissions), no remote code, untrusted page text is only ever rendered with `textContent`, and imported backups are validated (only http/https URLs are kept).
