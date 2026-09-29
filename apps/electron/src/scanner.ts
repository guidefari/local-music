import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { resolve } from "node:path"
import { Effect, Schema } from "effect"
import { ScanResult } from "./contract"

const execFileAsync = promisify(execFile)
const scanner = resolve(__dirname, "../../../target/debug/local-music-scan")

export class ScanFailed extends Schema.TaggedError<ScanFailed>()("ScanFailed", {
  message: Schema.String,
}) {}

export const scanFolder = Effect.fn("scanFolder")(function* (folder: string) {
  const { stdout } = yield* Effect.tryPromise({
    try: () => execFileAsync(scanner, [folder], { timeout: 30_000, maxBuffer: 64 * 1024 * 1024 }),
    catch: () => new ScanFailed({ message: "The local music scanner could not read this folder." }),
  })
  const raw: unknown = yield* Effect.try({
    try: () => JSON.parse(stdout),
    catch: () => new ScanFailed({ message: "The local music scanner returned invalid data." }),
  })
  return yield* Schema.decodeUnknownEffect(ScanResult)(raw).pipe(
    Effect.mapError(() => new ScanFailed({ message: "The local music scanner returned an unexpected result." })),
  )
})
