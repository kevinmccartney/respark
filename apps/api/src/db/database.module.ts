import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { Global, Inject, Logger, Module, OnApplicationShutdown, OnModuleInit } from '@nestjs/common'
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import * as schema from './schema'

export const DATABASE = Symbol('DATABASE')
export const DATABASE_POOL = Symbol('DATABASE_POOL')

export type Database = NodePgDatabase<typeof schema>

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: () => {
        const connectionString = process.env.DATABASE_URL
        if (!connectionString) {
          throw new Error('DATABASE_URL is required. Copy apps/api/.env.example to apps/api/.env.')
        }

        // Present only in the deployed image, where RDS requires verified TLS.
        const caPath = process.env.DATABASE_CA_PATH
        const ssl = caPath && existsSync(caPath) ? { ca: readFileSync(caPath, 'utf8') } : undefined

        return new Pool(ssl ? { connectionString, ssl } : { connectionString })
      },
    },
    {
      provide: DATABASE,
      inject: [DATABASE_POOL],
      useFactory: (pool: Pool) => drizzle(pool, { schema }),
    },
  ],
  exports: [DATABASE, DATABASE_POOL],
})
export class DatabaseModule implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name)

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(DATABASE_POOL) private readonly pool: Pool,
  ) {}

  /**
   * Deployed instances migrate on boot; locally this stays off so `task db:migrate`
   * remains the explicit step. Safe for a single instance only.
   */
  async onModuleInit() {
    if (process.env.RUN_MIGRATIONS !== 'true') return

    const migrationsFolder = resolve(__dirname, '../../drizzle')
    this.logger.log({ event: 'db.migrate.start', migrationsFolder }, 'Applying migrations')
    await migrate(this.db, { migrationsFolder })
    this.logger.log({ event: 'db.migrate.complete' }, 'Migrations applied')
  }

  async onApplicationShutdown() {
    await this.pool.end()
  }
}
