import { trace, SpanStatusCode } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { NodeSDK } from '@opentelemetry/sdk-node'

// Only initialize when explicitly configured; never export local paths or track metadata.
const sdk = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ? new NodeSDK({
      serviceName: 'local-music-desktop',
      traceExporter: new OTLPTraceExporter(),
      resourceDetectors: [],
    })
  : null

sdk?.start()

const tracer = trace.getTracer('local-music-library')

export async function traceLibraryOperation<T>(
  name: string,
  operation: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      return await operation()
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR })
      // Error objects can contain paths or metadata; do not record the exception.
      throw error
    } finally {
      span.end()
    }
  })
}

export async function stopTelemetry(): Promise<void> {
  await sdk?.shutdown()
}
