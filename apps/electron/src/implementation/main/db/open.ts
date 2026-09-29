import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'

import * as schema from '@/implementation/main/db/schema'

export async function openLibraryDatabase(path: string, migrationsFolder: string) {
  await mkdir(dirname(path), { recursive: true })
  const client = createClient({ url: `file:${path}` })
  const db = drizzle(client, { schema })

  try {
    await migrate(db, { migrationsFolder })
    await db.delete(schema.scanStagePaths).run()

    return { db, close: () => client.close() }
  } catch (error) {
    client.close()
    throw error
  }
}

export type LibraryDatabase = Awaited<ReturnType<typeof openLibraryDatabase>>['db']
