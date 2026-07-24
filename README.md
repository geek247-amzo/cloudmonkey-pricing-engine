# CloudMonkey Platform

CloudMonkey's customer, operations, billing, support, cloud, business, website, security, and AI platform.

This repository contains the CloudMonkey web application and its supporting server, database migrations, tests, and automation workflows. It is built and maintained for CloudMonkey (Pty) Ltd and is not a Lovable template or starter project.

## Development

```bash
bun install
bun run dev
```

Useful commands:

```bash
bun run build
bun run lint
bun test
```

The application uses TanStack Start, Vite, React, Drizzle ORM, and PostgreSQL. Runtime configuration is supplied through environment variables; use `.env.production.example` as the starting point and never commit secrets.

## Ownership

Copyright © 2026 CloudMonkey (Pty) Ltd. All rights reserved. CloudMonkey names, logos, product concepts, service definitions, operational tooling, and platform code in this repository are proprietary to CloudMonkey unless a component's own license states otherwise.
