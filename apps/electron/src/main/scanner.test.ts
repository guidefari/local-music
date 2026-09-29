import { afterEach, test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect, Schema } from "effect"
import { ScanResult } from "../shared/library-contract"
import { scanFolder } from "./scanner"

const folders: string[] = []

afterEach(async () => {
  for (const folder of folders.splice(0)) await rm(folder, { recursive: true })
})

test("scanner indexes an audio file through the executable boundary", async () => {
  const folder = await mkdtemp(join(tmpdir(), "local-music-scan-"))
  folders.push(folder)
  const pcm = Buffer.alloc(44_100 * 2)
  const wav = Buffer.alloc(44 + pcm.length)
  wav.write("RIFF", 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write("WAVEfmt ", 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(44_100, 24)
  wav.writeUInt32LE(88_200, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write("data", 36)
  wav.writeUInt32LE(pcm.length, 40)
  pcm.copy(wav, 44)
  await writeFile(join(folder, "Sample.wav"), wav)

  const result = await Effect.runPromise(scanFolder(folder))
  assert.equal(result.tracks.length, 1)
  assert.equal(result.tracks[0]?.title, "Sample")
  assert.equal(result.tracks[0]?.durationSeconds, 1)
  assert.equal(result.skipped, 0)
})

test("scanner contract rejects malformed track data", () => {
  const decode = Schema.decodeUnknownResult(ScanResult)
  const result = decode({ tracks: [{ title: "Only a title" }], covers: {}, skipped: 0 })
  assert.equal(result._tag, "Failure")
})
