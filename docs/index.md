---
layout: home

hero:
  name: "Sagana Backend"
  text: "System Architecture & Logic Guide"
  tagline: "High-performance, type-safe backend engine built with NestJS 11, Prisma 7, Clerk, and PostgreSQL"
  actions:
    - theme: brand
      text: Explore Architecture →
      link: /overview/system-architecture
    - theme: alt
      text: Folder Structure
      link: /overview/folder-structure
    - theme: alt
      text: Developer Guide
      link: /development/getting-started

features:
  - icon: 🛡️
    title: Clerk-Driven Authentication
    details: Complete JWT verification lifecycle, global route protection, and easy @Public / @CurrentUserId decorators.
  - icon: 🔄
    title: Real-Time Webhook Sync
    details: Cryptographic Svix signature validation for incoming Clerk user events with PostgreSQL upsert/delete handlers.
  - icon: 💎
    title: Type Safety & Validation
    details: Unified Zod v4 schemas for request payloads, environment variables, and Prisma client generation.
  - icon: 📊
    title: Standardized API Contract
    details: Global interceptors wrapping responses into predictable envelopes alongside comprehensive error code translation.
  - icon: 🗄️
    title: Modern PostgreSQL Layer
    details: Prisma 7 ORM with @prisma/adapter-pg native connection pooling for maximum throughput and reliability.
  - icon: ⚡
    title: Developer Ergonomics
    details: Built-in Bruno API testing collections, Swagger / Scalar OpenAPI explorer, and structured file logging.
---
