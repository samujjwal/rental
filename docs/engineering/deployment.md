# Deployment Guide

This document is the canonical summary of supported deployment modes.

## Supported Modes

### MVP Single-VM

Deploy Postgres, Redis, API, web, Nginx, and supporting services on one host.

Use when:

- launching an initial production-like environment quickly
- operating on one Linux VM
- accepting an all-in-one deployment footprint

### Production Compose

Deploy API, web, and Nginx with external database and Redis services.

Use when:

- infrastructure services are managed externally
- the application layer is deployed separately from stateful services

## Prerequisites

- Linux host with Docker Engine and Docker Compose plugin
- DNS pointed to the host
- ports `80` and `443` open
- correctly populated environment files

## Common Commands

```bash
pnpm run deploy:mvp -- yourdomain.com
pnpm run deploy:prod

pnpm run backup:mvp
pnpm run backup:prod
```

## Verification

After deployment, verify at minimum:

- API health endpoint responds
- web app responds
- environment variables are loaded correctly
- payment, email, storage, and auth configuration are valid for the environment

## Related Docs

- [`integrations.md`](integrations.md)
- [`../operations/runbooks.md`](../operations/runbooks.md)
