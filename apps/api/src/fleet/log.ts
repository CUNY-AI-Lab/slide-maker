import { createCailLogger, defineEventCatalog } from '@cuny-ai-lab/cail-log'

const catalog = defineEventCatalog({
  'slide-maker.gateway.completed': {
    source: 'tenant', severity: 'outcome',
    required: ['request_id', 'terminal'], optional: [],
  },
  'slide-maker.request.failed': {
    source: 'tenant', severity: 'error',
    required: ['request_id', 'terminal'], optional: [],
  },
})
const log = createCailLogger({
  service: 'slide-maker', release: process.env.RELEASE_SHA ?? 'development',
  env: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  sourceClass: 'tenant', catalog,
  sink: (event) => { console.log(JSON.stringify(event)) },
})

export function logGatewayOutcome(requestId: string, outcome: 'ok' | 'error' | 'cancelled') {
  const terminal = outcome === 'ok'
    ? { outcome: 'ok', reason: 'completed' } as const
    : outcome === 'cancelled'
      ? { outcome: 'cancelled', reason: 'cancelled' } as const
      : { outcome: 'error', reason: 'upstream_failure' } as const
  log.emit('slide-maker.gateway.completed', { request_id: requestId, terminal })
}

export function logRequestFailure(requestId: string) {
  log.emit('slide-maker.request.failed', {
    request_id: requestId, terminal: { outcome: 'error', reason: 'application_failure' },
  })
}
