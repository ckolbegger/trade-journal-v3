// Service-worker entry: wires the worker's events to the tested handlers in release.ts.
import { RELEASE_ID } from '../delivery/release-identity.ts';
import {
  handleActivate,
  handleInstall,
  handleMessage,
  serveRequest,
  type ServiceWorkerEnv,
  type WorkerMessage,
} from './release.ts';

// The few service-worker scope types used here (the DOM library does not declare them).
interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}
interface FetchEvent extends ExtendableEvent {
  readonly request: Request;
  respondWith(response: Promise<Response>): void;
}
interface ExtendableMessageEvent extends ExtendableEvent {
  readonly data: unknown;
  readonly ports: readonly MessagePort[];
  readonly source: { postMessage(message: unknown): void } | null;
}
interface WorkerScope {
  readonly location: Location;
  readonly caches: CacheStorage;
  readonly clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
  addEventListener(type: 'message', listener: (event: ExtendableMessageEvent) => void): void;
}

const scope = self as unknown as WorkerScope;

const env: ServiceWorkerEnv = {
  releaseId: RELEASE_ID,
  origin: scope.location.origin,
  caches: scope.caches,
  fetch: (input, init) => scope.fetch(input, init),
  skipWaiting: () => scope.skipWaiting(),
  claimClients: () => scope.clients.claim(),
};

scope.addEventListener('install', (event) => event.waitUntil(handleInstall(env)));
scope.addEventListener('activate', (event) => event.waitUntil(handleActivate(env)));
scope.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== env.origin) return;
  event.respondWith(serveRequest(env, request));
});
scope.addEventListener('message', (event) => {
  const reply = (answer: unknown) => (event.ports[0] ?? event.source)?.postMessage(answer);
  event.waitUntil(handleMessage(env, event.data as WorkerMessage, reply));
});
