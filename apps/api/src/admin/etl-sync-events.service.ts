import { Injectable } from '@nestjs/common'
import { Subject, type Observable } from 'rxjs'
import type { SyncEvent } from 'etl'

/**
 * Process-wide bus so Nest hot-reload does not orphan a running sync's
 * publishers from newly connected WebSocket subscribers.
 */
const globalBus = globalThis as typeof globalThis & {
  __resparkEtlSyncEvents?: Subject<SyncEvent>
}

function bus(): Subject<SyncEvent> {
  if (!globalBus.__resparkEtlSyncEvents) {
    globalBus.__resparkEtlSyncEvents = new Subject<SyncEvent>()
  }
  return globalBus.__resparkEtlSyncEvents
}

@Injectable()
export class EtlSyncEventsService {
  publish(event: SyncEvent): void {
    bus().next(event)
  }

  events(): Observable<SyncEvent> {
    return bus().asObservable()
  }
}
