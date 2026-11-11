# PostgreSQL & Prisma 7 Schema

Sagana Backend uses **PostgreSQL** hosted on Neon, managed with **Prisma 7** and driver adapters for high connection efficiency.

---

## 🗄️ Connection Pooling with `@prisma/adapter-pg`

Rather than relying purely on Prisma's internal binary engine for connections, the backend utilizes `pg.Pool` coupled with `@prisma/adapter-pg` in [`PrismaService`](../../src/infrastructure/database/prisma.service.ts):

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

---

## 📐 Database Models & Entity Relationship

```mermaid
erDiagram
    barangays ||--o{ users : "has"
    barangays ||--o{ machines : "contains"
    users ||--o{ compost_batches : "operates"
    machines ||--o{ compost_batches : "runs"
    machines ||--o{ sensors : "equipped with"
    machines ||--o{ telemetry_logs : "records"
    compost_batches ||--o{ batch_feedstocks : "includes"
    feedstocks ||--o{ batch_feedstocks : "categorizes"
    compost_batches ||--o{ composting_phases : "progresses through"
    compost_batches ||--o{ sensor_readings : "captures"
    sensors ||--o{ sensor_readings : "measures"

    barangays {
        string id PK "cuid"
        string name "Barangay name"
        string code UK "Unique join code (optional)"
        string status "active"
        datetime createdAt
    }

    users {
        string id PK "Clerk User ID (user_...)"
        string barangayId FK
        string fullName "Optional"
        datetime birthday "Optional"
        string email UK
        string role "operator"
        string status "active"
        string verificationStatus "unverified | verified"
        datetime createdAt
    }

    machines {
        string id PK "cuid"
        string barangayId FK
        string macAddress UK "Physical MAC"
        string name "Display name"
        string status "offline | active"
        string wifiSsid "Optional"
        datetime lastSeen
        datetime createdAt
        datetime removedAt "Nullable (soft delete)"
    }

    telemetry_logs {
        string id PK "cuid"
        string machineId FK
        string macAddress
        json payload "Raw MQTT readings"
        datetime recordedAt
    }

    compost_batches {
        string id PK "cuid"
        string machineId FK
        string userId FK
        float totalWeight "Total biomass kg"
        float finalWeight "Harvest yield kg (optional)"
        string batchCode UK
        datetime startDate
        datetime completionDate
        string status "active | completed"
    }

    feedstocks {
        string id PK "cuid"
        string name "Material name"
        string category "Green / Brown"
        string description
        string status "active"
    }

    batch_feedstocks {
        string id PK "cuid"
        string batchId FK
        string feedstockId FK
        float weight "kg"
    }

    composting_phases {
        string id PK "cuid"
        string batchId FK
        string phaseName "Mesophilic | Thermophilic"
        datetime timestamp
        string status "active"
    }

    sensors {
        string id PK "cuid"
        string machineId FK
        string sensorType "temperature | moisture | pH"
        string location
        string unit "°C | %"
        string status "active"
    }

    sensor_readings {
        string id PK "cuid"
        string sensorId FK
        string batchId FK
        float value
        datetime recordedAt "Recorded timestamp"
    }
```

---

## 🛠️ Prisma Management Commands

```bash
# Push schema changes directly to development database
pnpm prisma db push

# Generate Prisma Client and Zod types
pnpm prisma generate

# Open interactive Prisma Studio in browser
pnpm prisma studio

# Seed initial barangay join codes
pnpm run seed:barangay-codes

# Run machine hard-delete maintenance cleanup
pnpm run delete:machines
```
