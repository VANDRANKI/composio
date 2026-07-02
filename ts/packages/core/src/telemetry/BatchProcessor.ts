import {
  TelemetryMetricPayloadBody,
  TelemetryPayload,
} from '../services/telemetry/TelemetryService.types';

/**
 * Buffers telemetry payloads and flushes them in batches, either when the
 * batch reaches `batchSize` items or when `time` milliseconds elapse since
 * the first item was queued, whichever happens first.
 *
 * Flushes are fired-and-tracked (not awaited) so that `pushItem` never blocks
 * the caller. In-flight flushes are tracked in `pendingBatches` so callers
 * can await their completion via `flush()`, e.g. before process exit.
 */
export class BatchProcessor {
  private batch: TelemetryMetricPayloadBody = [];
  private time: number;
  private batchSize: number;
  private processBatchCallback: (data: TelemetryMetricPayloadBody) => Promise<void>;
  private timer: NodeJS.Timeout | null = null;
  private pendingBatches: Set<Promise<void>> = new Set();

  /**
   * @param time - Maximum time in milliseconds to wait before flushing a
   *               non-empty batch, even if `batchSize` has not been reached.
   * @param batchSize - Number of items that triggers an immediate flush.
   * @param processBatchCallback - Invoked with the queued items whenever a
   *                                batch is flushed. Errors thrown by this
   *                                callback are swallowed by `processBatch`,
   *                                so it is responsible for its own error
   *                                handling/reporting.
   */
  constructor(
    time: number = 2000,
    batchSize: number = 100,
    processBatchCallback: (data: TelemetryMetricPayloadBody) => Promise<void>
  ) {
    this.batch = [];
    this.time = time;
    this.batchSize = batchSize;
    this.processBatchCallback = processBatchCallback;
  }

  /**
   * Queues a telemetry item for the next batch. Triggers an immediate flush
   * if the batch is now full, otherwise (re)starts the flush timer.
   */
  pushItem(item: TelemetryPayload) {
    this.batch.push(item);
    if (this.batch.length >= this.batchSize) {
      this.processBatch();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.processBatch(), this.time);
    }
  }

  /**
   * Flushes the current batch (if non-empty) by invoking
   * `processBatchCallback` and clears any pending flush timer. The callback
   * runs asynchronously; its promise is tracked in `pendingBatches` rather
   * than awaited here, so this method returns as soon as the batch has been
   * handed off.
   */
  processBatch() {
    if (this.batch.length > 0) {
      const batchToProcess = this.batch;
      this.batch = [];
      const pending = this.processBatchCallback(batchToProcess)
        .catch(() => {
          // Silently ignore errors - they should be handled by the callback
        })
        .finally(() => {
          this.pendingBatches.delete(pending);
        });

      this.pendingBatches.add(pending);
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Flush any pending batches and wait for all of them to complete.
   * Useful for ensuring telemetry is sent before process exit.
   */
  async flush(): Promise<void> {
    this.processBatch();
    if (this.pendingBatches.size > 0) {
      await Promise.all(this.pendingBatches);
    }
  }
}
