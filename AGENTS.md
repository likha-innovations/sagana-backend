# Backend Agent Directives: sagana-backend

## Property naming
- Use camelCase for properties in application-owned models, schemas, DTOs, and REST contracts.
- Preserve required external contract keys, MQTT/WebSocket payloads, and database column names; use Prisma mappings where needed.

## 1. 🛡️ STRICT PRIVACY & ENVIRONMENT SHIELD (CRITICAL)
- **NEVER READ `.env` FILES DIRECTLY**: Under no circumstances should any agent open, read, view, or grep `.env`, `.env.local`, `.env.development`, `.env.staging`, `.env.production`, or any file containing live credentials.
- **Inspect Schemas Only**: When verifying environment variable names, fallback defaults, or configuration shapes, inspect strictly:
  1. `.env.example`
  2. `src/core/config/env.validation.ts`
- **Zero Secrets in Logs or Output**: Never output, print, or leak raw API keys, secrets, tokens, or database connection strings containing passwords in conversation, commit messages, or artifacts.

---

## 2. ⚡ Cognitive Flow Protocol (`i-have-adhd`)
- **Lead With the Next Action**: Start every response with the immediate, concrete next action.
- **Numbered Steps**: Break all multi-step tasks into clear, sequential numbers (1, 2, 3).
- **Zero Tangents & No Cognitive Overwhelm**: Suppress unsolicited essays, tangential rabbit holes, and speculative future features. Stick strictly to the active task.
- **Visible Milestone Wins**: Highlight concrete wins and passing tests as soon as they are completed.
- **Realistic Time & Scope Scoping**: Provide quick, realistic estimates for multi-step tasks.

---

## 3. 🍯 Code & Prose Density Protocol (`honey`)
- **Minimum Code That Needs to Exist**: Apply strict YAGNI. Write lean, stdlib/native-first implementations.
- **Strip All Conversational Fluff**: Eliminate polite filler, preamble, self-evident narration, and hedging ("Sure!", "I'd be glad to help", "As an AI model", "As requested").
- **Dense, Exact Prose**: Keep technical terms exact, file links clickable, and explanations terse and compact.

---

## 4. 📬 Endpoint Management & Bruno Collections (Mandatory)
- **Always Create/Update `.bru` Files**: Whenever a new endpoint is created or an existing route/payload is modified, immediately create or update the corresponding `.bru` file under `bruno/<module>/`.
- **Collection Standards**:
  - Organize requests by module directory (`bruno/<module>/<Action Name>.bru`).
  - Use `{{baseUrl}}` in all request URLs (`{{baseUrl}}/<path>`).
  - Use `auth: bearer` with `token: {{token}}` for authenticated routes; `auth: none` for `@Public()` routes.
  - Provide valid sample payloads conforming to the endpoint's Zod DTO schema.
  - Define route/path parameters via `params:path` and query parameters via `params:query`.

