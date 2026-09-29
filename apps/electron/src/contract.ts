import { Schema } from "effect"

export const Track = Schema.Struct({
  path: Schema.String,
  title: Schema.String,
  artist: Schema.String,
  album: Schema.String,
  durationSeconds: Schema.Number,
  coverId: Schema.NullOr(Schema.String),
})

export interface Track extends Schema.Schema.Type<typeof Track> {}

export const ScanResult = Schema.Struct({
  tracks: Schema.Array(Track),
  covers: Schema.Record(Schema.String, Schema.String),
  skipped: Schema.Number,
})

export interface ScanResult extends Schema.Schema.Type<typeof ScanResult> {}

export const ScanReply = Schema.Union([
  Schema.Struct({ ok: Schema.Literal(true), folder: Schema.String, data: ScanResult }),
  Schema.Struct({ ok: Schema.Literal(false), message: Schema.String }),
  Schema.Struct({ ok: Schema.Literal(false), cancelled: Schema.Literal(true) }),
])

export type ScanReply = typeof ScanReply.Type
