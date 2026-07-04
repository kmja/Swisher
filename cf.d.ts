// Minimal Cloudflare Workers type surface for the Durable Object and bindings.
// Declared narrowly on purpose: pulling the full @cloudflare/workers-types
// globals would clash with the DOM lib the Next client relies on (e.g. it
// retypes Response.json() to unknown and overrides fetch/Request/WebSocket).

declare module "cloudflare:workers" {
  interface DurableObjectStorage {
    get<T = unknown>(key: string): Promise<T | undefined>;
    put<T = unknown>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<boolean>;
  }
  interface DurableObjectState {
    storage: DurableObjectStorage;
    blockConcurrencyWhile<T>(cb: () => Promise<T>): Promise<T>;
    /** Hibernation API: adopt a server-side socket so the runtime can evict
     *  the DO from memory between messages without dropping connections. */
    acceptWebSocket(ws: WebSocket, tags?: string[]): void;
    getWebSockets(tag?: string): WebSocket[];
  }
  export abstract class DurableObject<Env = unknown> {
    protected ctx: DurableObjectState;
    protected env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }
}

interface DurableObjectId {
  toString(): string;
}

/** Workers global for WebSocket upgrades: [0] goes back to the client in the
 *  101 response, [1] is the server end the DO accepts. The DOM WebSocket type
 *  is a compatible subset (send/close) of the workerd socket. */
declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}

/** RPC stub: each method of the DO class, always returning a Promise. */
type DurableObjectStub<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => R extends Promise<unknown> ? R : Promise<R>
    : never;
};

interface DurableObjectNamespace<T = unknown> {
  idFromName(name: string): DurableObjectId;
  idFromString(hex: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub<T>;
}
