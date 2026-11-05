<div align="center">
  <img src="assets/sagana_logo.png" alt="Sagana logo" width="150" />

# Sagana Backend

API and device messaging services for the Sagana composting system

Machine management · Authentication · MQTT telemetry · Real-time updates

[Explore the docs](docs/index.md) · [Report a bug or request a feature](https://github.com/likha-innovations/sagana-backend/issues) · [Contact](mailto:likhainnovations.tech@gmail.com)

[![Contributors](https://img.shields.io/github/contributors/likha-innovations/sagana-backend)](https://github.com/likha-innovations/sagana-backend/graphs/contributors) [![Forks](https://img.shields.io/github/forks/likha-innovations/sagana-backend)](https://github.com/likha-innovations/sagana-backend/forks) [![Stars](https://img.shields.io/github/stars/likha-innovations/sagana-backend)](https://github.com/likha-innovations/sagana-backend/stargazers) [![Issues](https://img.shields.io/github/issues/likha-innovations/sagana-backend)](https://github.com/likha-innovations/sagana-backend/issues)

</div>

## Contents

- [About](#about)
- [Features](#features)
- [Built with](#built-with)
- [Getting started](#getting-started)
- [API and documentation](#api-and-documentation)
- [Commands](#commands)
- [Sagana ecosystem](#sagana-ecosystem)
- [Contact](#contact)

## About

Sagana Backend provides REST APIs, account management, and device messaging for the Sagana composting system. It connects mobile operators with machine records, receives telemetry over MQTT, and broadcasts real-time updates through Socket.IO.

The database schema includes compost batches and sensor data. Batch management endpoints are not currently implemented; the mobile batch workflow uses local mock data.

## Features

- **Authentication and profiles:** Verify Clerk tokens and retrieve and update user profiles.
- **Barangays and feedstocks:** Provide barangay and active feedstock data to clients.
- **Machine management:** Register, retrieve, update, and soft-remove machines. Machine reads are scoped to the authenticated user's barangay.
- **Telemetry and commands:** Receive device status and sensor messages over MQTT, store telemetry, and send commands to devices.
- **Real-time events:** Broadcast machine and telemetry updates to connected Socket.IO clients.
- **API validation and documentation:** Validate requests with Zod and explore endpoints through Swagger and VitePress.

## Built with

[NestJS](https://nestjs.com/) · [TypeScript](https://www.typescriptlang.org/) · [Prisma](https://www.prisma.io/) · [PostgreSQL](https://www.postgresql.org/) · [Clerk](https://clerk.com/) · [MQTT](https://mqtt.org/) · [Socket.IO](https://socket.io/)

## Getting started

### Prerequisites

- Node.js 22, matching backend CI, and pnpm 10.32.1.
- A PostgreSQL database, a Clerk application, and an MQTT broker configured for your environment.

### Installation

```bash
git clone https://github.com/likha-innovations/sagana-backend.git
cd sagana-backend
pnpm install --frozen-lockfile
cp .env.example .env
```

Configure the database, Clerk, server, and MQTT settings using [`.env.example`](.env.example). Keep credentials private. Generate the Prisma client and start the development server:

```bash
pnpm exec prisma generate
pnpm run start
```

The server listens on port 3000 by default. `API_PREFIX` controls the route prefix; the example configuration uses `api`. Apply database migrations only to the intended database. See [database setup](docs/database/schema-and-design.md) and the [developer guide](docs/development/getting-started.md).

## API and documentation

With the server running, open [Swagger UI](http://localhost:3000/api/docs). With the example `API_PREFIX=api`, the health endpoint is `http://localhost:3000/api/health`. A [Bruno collection](bruno/) contains example requests.

Machine registration and updates use camelCase fields such as `macAddress` and `wifiSsid`. See [machine endpoints](docs/modules/machines.md) and [telemetry](docs/modules/telemetry.md).

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm run start` | Start NestJS in watch mode |
| `pnpm run build` | Generate Prisma client and build the application |
| `pnpm run test` | Run the Jest test suite |
| `pnpm run test:e2e` | Run the configured end-to-end tests |
| `pnpm run lint` | Run ESLint with autofix |
| `pnpm run docs:dev` | Start the VitePress documentation server |
| `pnpm run docs:build` | Build the documentation |

## Sagana ecosystem

- **sagana-mobile:** Operator mobile application.
- **sagana-admin:** Administration application.
- **sagana-backend:** API, database, and device messaging services.
- **sagana-ai:** AI component.
- **sagana-firmware:** Machine firmware.

The mobile repository is available at [sagana-mobile](https://github.com/likha-innovations/sagana-mobile).

## Contact

Likha Innovations · [Email](mailto:likhainnovations.tech@gmail.com) · [Facebook](https://www.facebook.com/profile.php?id=61593904382435)

## License

This repository is marked `UNLICENSED` in its package configuration.
