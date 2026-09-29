import { test } from "node:test"
import assert from "node:assert/strict"
import { encode } from "@msgpack/msgpack"
import { Effect } from "effect"
import { decodeScanFrame } from "./scanner-protocol"

function frame(value: unknown) {
  const payload = encode(value)
  const output = Buffer.alloc(4 + payload.length)
  output.writeUInt32BE(payload.length, 0)
  output.set(payload, 4)
  return output
}

test("decodes embedded artwork from the binary frame", async () => {
  const result = await Effect.runPromise(decodeScanFrame(frame({
    version: 1,
    tracks: [],
    covers: [{ id: "cover", mimeType: "image/png", bytes: new Uint8Array([1, 2, 3]) }],
    skipped: 0,
  })))
  assert.equal(result.covers.cover, "data:image/png;base64,AQID")
})

test("rejects truncated and incompatible frames", async () => {
  const valid = frame({ version: 1, tracks: [], covers: [], skipped: 0 })
  const truncated = await Effect.runPromise(Effect.flip(decodeScanFrame(valid.subarray(0, -1))))
  assert.equal(truncated.message, "The scanner response has an invalid length.")

  const incompatible = await Effect.runPromise(Effect.flip(decodeScanFrame(frame({
    version: 2, tracks: [], covers: [], skipped: 0,
  }))))
  assert.equal(incompatible.message, "The scanner response has an unexpected format or version.")
})
