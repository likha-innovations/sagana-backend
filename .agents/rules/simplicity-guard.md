# Code Discipline & Simplicity Rules (ponytail & caveman guard)

## 1. YAGNI & Lean Implementation
- **No Speculative Coding**: Build only what is needed for the current requirement. Never create premature abstractions or anticipatory helper modules.
- **Stdlib & Native First**: Prefer built-in language capabilities (`fetch`, `Date`, native `Array`/`Object` methods) before introducing external packages.
- **Banned Packages**: Axios (use native `fetch`), Lodash, Moment.js (use native `Date`), Ramda.

## 2. DRY with Pragmatism
- **Centralize Critical Contracts**: Schemas, payload interfaces, and decorators belong in `dto/`, `src/core/`, or `src/infrastructure/`.
- **Avoid Premature DRY**: Do not combine superficially similar services or controllers into complex generic superclasses. Duplicate small logic blocks until a clear pattern emerges across 3+ distinct call sites.

## 3. Guard Clauses & Flat Control Flow
- **Early Exits First**: Exit immediately at the top of functions, guards, and services for invalid inputs, missing entities, or error scenarios.
- **Eliminate Deep Nesting**: Maximum nesting depth for conditional logic is 2 levels.
- **Null Safety**: Prefer optional chaining (`?.`) and nullish coalescing (`??`).

## 4. Single-Line Comments Only (Zero Multiline / Zero JSDoc)
- **Strictly Banned**: Multiline comments (`/* ... */`) and JSDoc blocks (`/** ... */`) are forbidden in all application code.
- **Single-Line Only**: Use strictly single-line comments (`// ...`).
- **Explain Why, Never What**: Write comments only to explain non-obvious business constraints or hardware quirks. Never narrate self-evident code.

## 5. Clean Diffs & Zero Dead Code
- **No Zombie Code**: Never leave commented-out code, unused variables, or dead imports.
- **Strict Typing**: Zero `any`. Always use explicit TypeScript types or Zod inferred types.
- **Structured Logging**: Use `LoggerService` / `Logger` from `@nestjs/common` — no raw `console.log` in production code.
