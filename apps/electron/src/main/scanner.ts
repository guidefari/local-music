import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { resolve } from "node:path"
import { Effect, Schema } from "effect"
import { decodeScanFrame } from "./scanner-protocol"

const execFileAsync = promisify(execFile)
const scanner = resolve(__dirname, "../../../../target/debug/local-music-scan")

export class ScanFailed extends Schema.TaggedError<ScanFailed>()("ScanFailed", {
  message: Schema.String,
}) {}

export const scanFolder = Effect.fn("scanFolder")(function* (folder: string) {
  const { stdout } = yield* Effect.tryPromise({
    try: () => execFileAsync(scanner, [folder], { encoding: "buffer", timeout: 30_000, maxBuffer: 64 * 1024 * 1024 }),
    catch: () => new ScanFailed({ message: "The local music scanner could not read this folder." }),
  })
  return yield* decodeScanFrame(stdout)
})
