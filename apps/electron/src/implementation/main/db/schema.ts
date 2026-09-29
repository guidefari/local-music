import { sql } from 'drizzle-orm'
import { check, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const librarySources = sqliteTable('library_source', {
  id: text('id').primaryKey(),
  rootPath: text('root_path').notNull().unique(),
  addedAt: integer('added_at').notNull(),
  lastSuccessfulScanAt: integer('last_successful_scan_at'),
})

export const tracks = sqliteTable(
  'track',
  {
    id: text('id').primaryKey(),
    sourceId: text('source_id')
      .notNull()
      .references(() => librarySources.id),
    relativePath: text('relative_path').notNull(),
    observedTitle: text('observed_title').notNull(),
    observedArtist: text('observed_artist').notNull(),
    observedAlbum: text('observed_album').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    hasEmbeddedArtwork: integer('has_embedded_artwork', { mode: 'boolean' }).notNull(),
    artworkId: text('artwork_id'),
    artworkMimeType: text('artwork_mime_type'),
    presence: text('presence', { enum: ['present', 'missing'] }).notNull(),
    lastSeenAt: integer('last_seen_at').notNull(),
  },
  (table) => [
    uniqueIndex('track_source_path_unique').on(table.sourceId, table.relativePath),
    check(
      'track_artwork_pair',
      sql`(${table.artworkId} IS NULL AND ${table.artworkMimeType} IS NULL) OR (${table.artworkId} IS NOT NULL AND ${table.artworkMimeType} IS NOT NULL AND ${table.hasEmbeddedArtwork} = 1)`,
    ),
  ],
)

export const scanStagePaths = sqliteTable(
  'scan_stage_path',
  {
    scanId: text('scan_id').notNull(),
    sourceId: text('source_id')
      .notNull()
      .references(() => librarySources.id),
    relativePath: text('relative_path').notNull(),
    readState: text('read_state', { enum: ['observed', 'unreadable'] }).notNull(),
    observedTitle: text('observed_title'),
    observedArtist: text('observed_artist'),
    observedAlbum: text('observed_album'),
    durationSeconds: integer('duration_seconds'),
    hasEmbeddedArtwork: integer('has_embedded_artwork', { mode: 'boolean' }),
    artworkId: text('artwork_id'),
    artworkMimeType: text('artwork_mime_type'),
  },
  (table) => [
    primaryKey({ columns: [table.scanId, table.sourceId, table.relativePath] }),
    check(
      'stage_observation_complete',
      sql`(${table.readState} = 'unreadable' AND ${table.observedTitle} IS NULL AND ${table.observedArtist} IS NULL AND ${table.observedAlbum} IS NULL AND ${table.durationSeconds} IS NULL AND ${table.hasEmbeddedArtwork} IS NULL AND ${table.artworkId} IS NULL AND ${table.artworkMimeType} IS NULL) OR (${table.readState} = 'observed' AND ${table.observedTitle} IS NOT NULL AND ${table.observedArtist} IS NOT NULL AND ${table.observedAlbum} IS NOT NULL AND ${table.durationSeconds} IS NOT NULL AND ${table.hasEmbeddedArtwork} IS NOT NULL)`,
    ),
  ],
)
