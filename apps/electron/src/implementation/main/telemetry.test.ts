import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, test } from 'node:test'

const server = createServer()

after(() => server.close())

test('exports only named operations and failure status with the configured bearer header', async () => {
  const requests: Array<{ path: string; authorization: string | undefined; body: Buffer }> = []
  server.on('request', (request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      requests.push({
        path: request.url ?? '',
        authorization: request.headers.authorization,
        body: Buffer.concat(chunks),
      })
      response.writeHead(200).end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  // SAFETY: listen(host, port) creates a TCP listener, never a Unix socket.
  const address = server.address() as AddressInfo

  const child = spawn(
    process.execPath,
    [
      '-e',
      `import { traceLibraryOperation, stopTelemetry } from './src/implementation/main/telemetry.ts';
       await traceLibraryOperation('library.rescan', async () => 1);
       try { await traceLibraryOperation('library.addFolder', async () => { throw new Error('private-path-sentinel') }) } catch {}
       await stopTelemetry();`,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${address.port}`,
        OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
        OTEL_EXPORTER_OTLP_HEADERS: 'Authorization=Bearer test-token',
      },
      stdio: 'ignore',
    },
  )

  const exitCode = await new Promise<number | null>((resolve) => child.on('exit', resolve))

  assert.equal(exitCode, 0)
  assert.equal(requests.length, 1)
  assert.equal(requests[0]?.path, '/v1/traces')
  assert.equal(requests[0]?.authorization, 'Bearer test-token')
  assert.ok(requests[0]?.body.length)
  assert.match(requests[0].body.toString(), /library.rescan/)
  assert.match(requests[0].body.toString(), /library.addFolder/)
  assert.doesNotMatch(requests[0].body.toString(), /private-path-sentinel/)
})
