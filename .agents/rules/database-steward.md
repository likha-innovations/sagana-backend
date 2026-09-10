# Database & Prisma Rules (database-steward)

## 1. Prisma Client Lifecycle & Adapter
- **Singleton Pattern**: Always inject `PrismaService` from `src/infrastructure/database/prisma.service.ts`.
- **Connection Pool**: Uses `@prisma/adapter-pg` with `pg.Pool` for managed Neon PostgreSQL connection pooling.
- Never instantiate raw `new PrismaClient()` in feature services.

## 2. Table & Column Mapping Conventions
- **Database Tables**: Must always be mapped to snake_case using `@@map("table_name")` in `schema.prisma`.
- **TypeScript Models**: Prisma generator produces camelCase properties (`contactNumber`, `intakeRecords`) matching TypeScript standards.

## 3. Query Discipline & Performance
- **Conscious Selection**: Avoid blind relations fetching. Use explicit `select:` or `include:` only for fields the client needs.
- **Foreign Key Indexing**: Ensure all foreign key lookup fields (`userId`, `deviceId`, `batchId`) and time-series columns (`timestamp`, `createdAt`) are properly indexed.

## 4. Banned Code Generators
- **`prisma-zod-generator` is Banned**: Do not use auto-generated Zod schemas from Prisma models. Write clean, focused Zod DTOs in `src/modules/<feature>/dto/` decoupled from database schemas.
