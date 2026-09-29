import { decode } from "@msgpack/msgpack"
import { Effect, Schema } from "effect"
import { ScanResult, Track } from "../shared/library-contract"

const Artwork = Schema.Struct({
  id: Schema.String,
  mimeType: Schema.Union([
    Schema.Literal("image/png"),
    Schema.Literal("image/jpeg"),
    Schema.Literal("image/webp"),
    Schema.Literal("image/gif"),
    Schema.Literal("image/svg+xml"),
    Schema.Literal("image/bmp"),
    Schema.Literal("image/tiff"),
    Schema.Literal("image/ico"),
    Schema.Literal("image/x-portable-anymap"),
  ]),
  bytes: Schema.Uint8Array,
})

const ScannerWire = Schema.Struct({
  version: Schema.Literal(1),
  tracks: Schema.Array(Track),
  covers: Schema.Array(Artwork),
  skipped: Schema.Number,
})

export class ScanProtocolFailed extends Schema.TaggedError<ScanProtocolFailed>()("ScanProtocolFailed", {
  message: Schema.String,
}) {}

export const decodeScanFrame = Effect.fn("decodeScanFrame")(function* (output: Uint8Array): Effect.fn.Return<ScanResult, ScanProtocolFailed> {
  if (output.length < 4) {
    return yield* new ScanProtocolFailed({ message: "The scanner response is incomplete." })
  }
  const frame = Buffer.from(output.buffer, output.byteOffset, output.byteLength)
  const length = frame.readUInt32BE(0)
  if (length !== output.length - 4) {
    return yield* new ScanProtocolFailed({ message: "The scanner response has an invalid length." })
  }
  const raw: unknown = yield* Effect.try({
    try: () => decode(output.subarray(4)),
    catch: () => new ScanProtocolFailed({ message: "The scanner response is not valid MessagePack." }),
  })
  const result = yield* Schema.decodeUnknownEffect(ScannerWire)(raw).pipe(
    Effect.mapError(() => new ScanProtocolFailed({ message: "The scanner response has an unexpected format or version." })),
  )
  const covers = Object.fromEntries(result.covers.map((cover) => [
    cover.id,
    `data:${cover.mimeType};base64,${Buffer.from(cover.bytes).toString("base64")}`,
  ]))
  return { tracks: result.tracks, covers, skipped: result.skipped }
})
