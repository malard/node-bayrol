// Tiny typed wrapper around Node's EventEmitter. Avoids pulling in a
// third-party package just for type-safe `on`/`emit`.

import { EventEmitter } from "node:events";

export type EventMap = Record<string, unknown[]>;

export class TypedEmitter<T extends EventMap> {
  readonly #ee = new EventEmitter();

  on<K extends keyof T & string>(event: K, listener: (...args: T[K]) => void): this {
    this.#ee.on(event, listener as (...args: unknown[]) => void);
    return this;
  }

  off<K extends keyof T & string>(event: K, listener: (...args: T[K]) => void): this {
    this.#ee.off(event, listener as (...args: unknown[]) => void);
    return this;
  }

  emit<K extends keyof T & string>(event: K, ...args: T[K]): boolean {
    return this.#ee.emit(event, ...args);
  }

  removeAllListeners<K extends keyof T & string>(event?: K): this {
    if (event !== undefined) {
      this.#ee.removeAllListeners(event);
    } else {
      this.#ee.removeAllListeners();
    }
    return this;
  }

  listenerCount<K extends keyof T & string>(event: K): number {
    return this.#ee.listenerCount(event);
  }
}
