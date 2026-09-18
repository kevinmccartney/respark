import { Inject, Injectable } from '@nestjs/common'
import { DATABASE, type Database } from '../db/database.module'
import { users } from '../db/schema'

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Resolves a Clerk user id to the local user id, creating the row on first use.
   * The no-op conflict update lets a single statement return the row either way.
   */
  async resolveLocalId(clerkUserId: string): Promise<string> {
    const [user] = await this.db
      .insert(users)
      .values({ clerkUserId })
      .onConflictDoUpdate({ target: users.clerkUserId, set: { clerkUserId } })
      .returning({ id: users.id })

    return user.id
  }
}
