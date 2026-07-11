# Security

Do not commit `.env` files, database credentials, API keys, tokens, or private certificates. Use the tracked `.env.*.example` files as templates.

Report a suspected vulnerability privately to the repository owner instead of opening a public issue with exploit details. Include the affected component, reproduction steps, impact, and a suggested mitigation when available.

Before deploying, provide explicit production values for server-only configuration, especially `DATABASE_URL`, and verify that browser-exposed variables use the `NEXT_PUBLIC_` prefix only when they are safe to disclose.
