// The backup export worker (D8 A128, P29): a dedicated module worker that runs the export pipeline
// against its own IndexedDB connection, so the page stays responsive while the snapshot is read,
// hashed and compressed. It receives one job, posts progress, and posts the finished run.
import { runExport, type ExportJob, type ExportRun } from '../coordinators/workspace/backup-export.ts';
import { readExportSnapshot } from '../persistence/export-snapshot.ts';

// The job without its progress callback: a function cannot be posted, so the worker reports progress by message.
export type WorkerExportJob = Omit<ExportJob, 'onProgress'>;

export type WorkerExportMessage =
  | { readonly kind: 'progress'; readonly done: number; readonly total: number }
  | { readonly kind: 'run'; readonly run: ExportRun };

const post = (message: WorkerExportMessage) => self.postMessage(message);

self.onmessage = (event: MessageEvent<WorkerExportJob>) => {
  void runExport(
    (database, layout, onBatch, onStart) => readExportSnapshot(self.indexedDB, database, layout, onBatch, onStart),
    { ...event.data, onProgress: ({ done, total }) => post({ kind: 'progress', done, total }) },
  ).then((run) => post({ kind: 'run', run }));
};
