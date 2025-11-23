/**
 * Cache - Effect-based caching service with TTL support
 *
 * Provides:
 * - In-memory caching with automatic TTL expiration
 * - LRU eviction policy
 * - Cache statistics and monitoring
 * - Composable cache layers for different scopes
 *
 * @module Mcp/Streaming/Cache
 */

import * as Context from "effect/Context"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as HashMap from "effect/HashMap"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"

// =============================================================================
// Types and Schemas
// =============================================================================

/**
 * Cache entry with metadata
 */
interface CacheEntry<A> {
  /** Cached value */
  readonly value: A
  /** Timestamp when entry was created */
  readonly createdAt: number
  /** Timestamp when entry expires */
  readonly expiresAt: number
  /** Last access timestamp */
  readonly lastAccessedAt: number
  /** Access count */
  readonly accessCount: number
  /** Size in bytes (estimated) */
  readonly sizeBytes: number
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
  /** Default TTL for entries (default: 5 minutes) */
  readonly defaultTtl?: Duration.DurationInput
  /** Maximum number of entries (default: 1000) */
  readonly maxEntries?: number
  /** Maximum total size in bytes (default: 50MB) */
  readonly maxSizeBytes?: number
  /** Enable LRU eviction (default: true) */
  readonly enableLru?: boolean
  /** Clean expired entries interval (default: 1 minute) */
  readonly cleanupInterval?: Duration.DurationInput
}

/**
 * Cache statistics
 */
export class CacheStats extends Schema.Class<CacheStats>("CacheStats")({
  /** Total number of entries */
  entries: Schema.Number,
  /** Total size in bytes */
  sizeBytes: Schema.Number,
  /** Total hits */
  hits: Schema.Number,
  /** Total misses */
  misses: Schema.Number,
  /** Hit ratio (0-1) */
  hitRatio: Schema.Number,
  /** Number of evictions */
  evictions: Schema.Number,
  /** Number of expirations */
  expirations: Schema.Number,
  /** Oldest entry age in ms */
  oldestEntryAge: Schema.Number,
  /** Average entry age in ms */
  avgEntryAge: Schema.Number
}) {}

/**
 * Cache operation result
 */
export type CacheResult<A> =
  | { readonly _tag: "Hit"; readonly value: A; readonly age: number }
  | { readonly _tag: "Miss" }
  | { readonly _tag: "Expired"; readonly value: A; readonly expiredBy: number }

// =============================================================================
// Cache Service Interface
// =============================================================================

/**
 * Cache service interface
 */
export interface CacheService {
  /**
   * Get a value from the cache
   */
  readonly get: <A>(key: string) => Effect.Effect<Option.Option<A>>

  /**
   * Get a value with result metadata
   */
  readonly getWithResult: <A>(key: string) => Effect.Effect<CacheResult<A>>

  /**
   * Set a value in the cache
   */
  readonly set: <A>(key: string, value: A, ttl?: Duration.DurationInput) => Effect.Effect<void>

  /**
   * Get or compute a value
   */
  readonly getOrSet: <A, E, R>(
    key: string,
    compute: Effect.Effect<A, E, R>,
    ttl?: Duration.DurationInput
  ) => Effect.Effect<A, E, R>

  /**
   * Check if a key exists and is not expired
   */
  readonly has: (key: string) => Effect.Effect<boolean>

  /**
   * Delete a key
   */
  readonly delete: (key: string) => Effect.Effect<boolean>

  /**
   * Clear all entries
   */
  readonly clear: () => Effect.Effect<void>

  /**
   * Get cache statistics
   */
  readonly stats: () => Effect.Effect<CacheStats>

  /**
   * Get all keys
   */
  readonly keys: () => Effect.Effect<ReadonlyArray<string>>

  /**
   * Invalidate entries matching a pattern
   */
  readonly invalidatePattern: (pattern: RegExp) => Effect.Effect<number>

  /**
   * Refresh TTL for an entry
   */
  readonly touch: (key: string, ttl?: Duration.DurationInput) => Effect.Effect<boolean>

  /**
   * Get remaining TTL for an entry
   */
  readonly ttl: (key: string) => Effect.Effect<Option.Option<number>>
}

/**
 * Cache service tag
 */
export class Cache extends Context.Tag("Cache")<Cache, CacheService>() {}

// =============================================================================
// Cache Implementation
// =============================================================================

/**
 * Internal cache state
 */
interface CacheState {
  entries: HashMap.HashMap<string, CacheEntry<unknown>>
  totalSizeBytes: number
  hits: number
  misses: number
  evictions: number
  expirations: number
}

const initialState: CacheState = {
  entries: HashMap.empty(),
  totalSizeBytes: 0,
  hits: 0,
  misses: 0,
  evictions: 0,
  expirations: 0
}

/**
 * Estimate size of a value in bytes
 */
const estimateSize = (value: unknown): number => {
  if (value === null || value === undefined) return 0
  if (typeof value === "string") return value.length * 2 // UTF-16
  if (typeof value === "number") return 8
  if (typeof value === "boolean") return 4
  if (Array.isArray(value)) {
    return value.reduce((acc, v) => acc + estimateSize(v), 8)
  }
  if (typeof value === "object") {
    return Object.entries(value).reduce(
      (acc, [k, v]) => acc + k.length * 2 + estimateSize(v),
      8
    )
  }
  return 8
}

/**
 * Create cache service implementation
 */
const makeCacheService = (config: CacheConfig): Effect.Effect<CacheService> =>
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<CacheState>(initialState)

    const defaultTtl = Duration.toMillis(config.defaultTtl ?? Duration.minutes(5))
    const maxEntries = config.maxEntries ?? 1000
    const maxSizeBytes = config.maxSizeBytes ?? 50 * 1024 * 1024 // 50MB
    const enableLru = config.enableLru ?? true

    /**
     * Evict entries if over limits
     */
    const evictIfNeeded = Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      let newEntries = state.entries
      let newSize = state.totalSizeBytes
      let evictions = 0

      // Check entry count limit
      while (HashMap.size(newEntries) > maxEntries) {
        // Find oldest/least accessed entry
        let oldest: [string, CacheEntry<unknown>] | undefined

        for (const [key, entry] of newEntries) {
          if (!oldest) {
            oldest = [key, entry]
            continue
          }

          if (enableLru) {
            // LRU: evict least recently accessed
            if (entry.lastAccessedAt < oldest[1].lastAccessedAt) {
              oldest = [key, entry]
            }
          } else {
            // FIFO: evict oldest created
            if (entry.createdAt < oldest[1].createdAt) {
              oldest = [key, entry]
            }
          }
        }

        if (oldest) {
          newEntries = HashMap.remove(newEntries, oldest[0])
          newSize -= oldest[1].sizeBytes
          evictions++
        }
      }

      // Check size limit
      while (newSize > maxSizeBytes && HashMap.size(newEntries) > 0) {
        let oldest: [string, CacheEntry<unknown>] | undefined

        for (const [key, entry] of newEntries) {
          if (!oldest) {
            oldest = [key, entry]
            continue
          }

          if (enableLru) {
            if (entry.lastAccessedAt < oldest[1].lastAccessedAt) {
              oldest = [key, entry]
            }
          } else {
            if (entry.createdAt < oldest[1].createdAt) {
              oldest = [key, entry]
            }
          }
        }

        if (oldest) {
          newEntries = HashMap.remove(newEntries, oldest[0])
          newSize -= oldest[1].sizeBytes
          evictions++
        }
      }

      yield* Ref.update(stateRef, (s) => ({
        ...s,
        entries: newEntries,
        totalSizeBytes: newSize,
        evictions: s.evictions + evictions
      }))
    })

    /**
     * Remove expired entries
     */
    const cleanExpired = Effect.gen(function* () {
      const now = Date.now()
      const state = yield* Ref.get(stateRef)
      let newEntries = state.entries
      let newSize = state.totalSizeBytes
      let expirations = 0

      for (const [key, entry] of state.entries) {
        if (entry.expiresAt <= now) {
          newEntries = HashMap.remove(newEntries, key)
          newSize -= entry.sizeBytes
          expirations++
        }
      }

      yield* Ref.update(stateRef, (s) => ({
        ...s,
        entries: newEntries,
        totalSizeBytes: newSize,
        expirations: s.expirations + expirations
      }))
    })

    const service: CacheService = {
      get: <A>(key: string) =>
        Effect.gen(function* () {
          yield* cleanExpired
          const state = yield* Ref.get(stateRef)
          const now = Date.now()

          const entry = HashMap.get(state.entries, key)

          if (Option.isNone(entry)) {
            yield* Ref.update(stateRef, (s) => ({ ...s, misses: s.misses + 1 }))
            return Option.none<A>()
          }

          if (entry.value.expiresAt <= now) {
            // Expired - remove and return none
            yield* Ref.update(stateRef, (s) => ({
              ...s,
              entries: HashMap.remove(s.entries, key),
              totalSizeBytes: s.totalSizeBytes - entry.value.sizeBytes,
              misses: s.misses + 1,
              expirations: s.expirations + 1
            }))
            return Option.none<A>()
          }

          // Hit - update access time
          yield* Ref.update(stateRef, (s) => ({
            ...s,
            entries: HashMap.set(s.entries, key, {
              ...entry.value,
              lastAccessedAt: now,
              accessCount: entry.value.accessCount + 1
            }),
            hits: s.hits + 1
          }))

          return Option.some(entry.value.value as A)
        }),

      getWithResult: <A>(key: string) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const now = Date.now()

          const entry = HashMap.get(state.entries, key)

          if (Option.isNone(entry)) {
            yield* Ref.update(stateRef, (s) => ({ ...s, misses: s.misses + 1 }))
            return { _tag: "Miss" } as CacheResult<A>
          }

          const age = now - entry.value.createdAt

          if (entry.value.expiresAt <= now) {
            // Expired
            const expiredBy = now - entry.value.expiresAt
            yield* Ref.update(stateRef, (s) => ({
              ...s,
              entries: HashMap.remove(s.entries, key),
              totalSizeBytes: s.totalSizeBytes - entry.value.sizeBytes,
              expirations: s.expirations + 1
            }))
            return { _tag: "Expired", value: entry.value.value as A, expiredBy } as CacheResult<A>
          }

          // Hit
          yield* Ref.update(stateRef, (s) => ({
            ...s,
            entries: HashMap.set(s.entries, key, {
              ...entry.value,
              lastAccessedAt: now,
              accessCount: entry.value.accessCount + 1
            }),
            hits: s.hits + 1
          }))

          return { _tag: "Hit", value: entry.value.value as A, age } as CacheResult<A>
        }),

      set: <A>(key: string, value: A, ttl?: Duration.DurationInput) =>
        Effect.gen(function* () {
          const now = Date.now()
          const ttlMs = ttl ? Duration.toMillis(ttl) : defaultTtl
          const sizeBytes = estimateSize(value)

          const entry: CacheEntry<A> = {
            value,
            createdAt: now,
            expiresAt: now + ttlMs,
            lastAccessedAt: now,
            accessCount: 0,
            sizeBytes
          }

          yield* Ref.update(stateRef, (s) => {
            const existing = HashMap.get(s.entries, key)
            const oldSize = Option.isSome(existing) ? existing.value.sizeBytes : 0

            return {
              ...s,
              entries: HashMap.set(s.entries, key, entry),
              totalSizeBytes: s.totalSizeBytes - oldSize + sizeBytes
            }
          })

          yield* evictIfNeeded
        }),

      getOrSet: <A, E, R>(
        key: string,
        compute: Effect.Effect<A, E, R>,
        ttl?: Duration.DurationInput
      ) =>
        Effect.gen(function* () {
          const cached = yield* service.get<A>(key)

          if (Option.isSome(cached)) {
            return cached.value
          }

          const value = yield* compute
          yield* service.set(key, value, ttl)
          return value
        }),

      has: (key: string) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const now = Date.now()

          const entry = HashMap.get(state.entries, key)

          if (Option.isNone(entry)) {
            return false
          }

          return entry.value.expiresAt > now
        }),

      delete: (key: string) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const entry = HashMap.get(state.entries, key)

          if (Option.isNone(entry)) {
            return false
          }

          yield* Ref.update(stateRef, (s) => ({
            ...s,
            entries: HashMap.remove(s.entries, key),
            totalSizeBytes: s.totalSizeBytes - entry.value.sizeBytes
          }))

          return true
        }),

      clear: () =>
        Ref.update(stateRef, (s) => ({
          ...s,
          entries: HashMap.empty(),
          totalSizeBytes: 0
        })),

      stats: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const now = Date.now()

          let oldestAge = 0
          let totalAge = 0
          let count = 0

          for (const [_, entry] of state.entries) {
            const age = now - entry.createdAt
            totalAge += age
            count++
            if (age > oldestAge) oldestAge = age
          }

          const total = state.hits + state.misses

          return new CacheStats({
            entries: HashMap.size(state.entries),
            sizeBytes: state.totalSizeBytes,
            hits: state.hits,
            misses: state.misses,
            hitRatio: total > 0 ? state.hits / total : 0,
            evictions: state.evictions,
            expirations: state.expirations,
            oldestEntryAge: oldestAge,
            avgEntryAge: count > 0 ? totalAge / count : 0
          })
        }),

      keys: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const keys: string[] = []
          for (const [key, _] of state.entries) {
            keys.push(key)
          }
          return keys
        }),

      invalidatePattern: (pattern: RegExp) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          let removed = 0
          let newEntries = state.entries
          let newSize = state.totalSizeBytes

          for (const [key, entry] of state.entries) {
            if (pattern.test(key)) {
              newEntries = HashMap.remove(newEntries, key)
              newSize -= entry.sizeBytes
              removed++
            }
          }

          yield* Ref.update(stateRef, (s) => ({
            ...s,
            entries: newEntries,
            totalSizeBytes: newSize
          }))

          return removed
        }),

      touch: (key: string, ttl?: Duration.DurationInput) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const now = Date.now()
          const entry = HashMap.get(state.entries, key)

          if (Option.isNone(entry)) {
            return false
          }

          const ttlMs = ttl ? Duration.toMillis(ttl) : defaultTtl

          yield* Ref.update(stateRef, (s) => ({
            ...s,
            entries: HashMap.set(s.entries, key, {
              ...entry.value,
              expiresAt: now + ttlMs,
              lastAccessedAt: now
            })
          }))

          return true
        }),

      ttl: (key: string) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const now = Date.now()
          const entry = HashMap.get(state.entries, key)

          if (Option.isNone(entry)) {
            return Option.none<number>()
          }

          const remaining = entry.value.expiresAt - now
          return remaining > 0 ? Option.some(remaining) : Option.none<number>()
        })
    }

    return service
  })

// =============================================================================
// Layers
// =============================================================================

/**
 * Create a cache layer with custom configuration
 */
export const layer = (config: CacheConfig = {}): Layer.Layer<Cache> =>
  Layer.effect(Cache, makeCacheService(config))

/**
 * Default cache layer (5 min TTL, 1000 entries, 50MB)
 */
export const defaultLayer: Layer.Layer<Cache> = layer({})

/**
 * Short-lived cache layer (1 min TTL)
 */
export const shortLivedLayer: Layer.Layer<Cache> = layer({
  defaultTtl: Duration.minutes(1),
  maxEntries: 500
})

/**
 * Long-lived cache layer (30 min TTL)
 */
export const longLivedLayer: Layer.Layer<Cache> = layer({
  defaultTtl: Duration.minutes(30),
  maxEntries: 2000,
  maxSizeBytes: 100 * 1024 * 1024 // 100MB
})

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get a value from the cache
 */
export const get = <A>(key: string): Effect.Effect<Option.Option<A>, never, Cache> =>
  Effect.flatMap(Cache, (cache) => cache.get<A>(key))

/**
 * Set a value in the cache
 */
export const set = <A>(
  key: string,
  value: A,
  ttl?: Duration.DurationInput
): Effect.Effect<void, never, Cache> =>
  Effect.flatMap(Cache, (cache) => cache.set(key, value, ttl))

/**
 * Get or compute a value
 */
export const getOrSet = <A, E, R>(
  key: string,
  compute: Effect.Effect<A, E, R>,
  ttl?: Duration.DurationInput
): Effect.Effect<A, E, Cache | R> =>
  Effect.flatMap(Cache, (cache) => cache.getOrSet(key, compute, ttl))

/**
 * Check if a key exists
 */
export const has = (key: string): Effect.Effect<boolean, never, Cache> =>
  Effect.flatMap(Cache, (cache) => cache.has(key))

/**
 * Delete a key
 */
export const del = (key: string): Effect.Effect<boolean, never, Cache> =>
  Effect.flatMap(Cache, (cache) => cache.delete(key))

/**
 * Clear the cache
 */
export const clear = (): Effect.Effect<void, never, Cache> =>
  Effect.flatMap(Cache, (cache) => cache.clear())

/**
 * Get cache statistics
 */
export const stats = (): Effect.Effect<CacheStats, never, Cache> =>
  Effect.flatMap(Cache, (cache) => cache.stats())

/**
 * Create a cache key from multiple parts
 */
export const makeKey = (...parts: ReadonlyArray<string | number>): string =>
  parts.join(":")

/**
 * Create a cache key with namespace
 */
export const namespacedKey = (namespace: string, key: string): string =>
  `${namespace}:${key}`

// =============================================================================
// Caching Decorators
// =============================================================================

/**
 * Wrap an effect with caching
 *
 * @example
 * ```typescript
 * const fetchUser = (id: number) =>
 *   cached(
 *     `user:${id}`,
 *     Effect.tryPromise(() => fetch(`/api/users/${id}`)),
 *     Duration.minutes(5)
 *   )
 * ```
 */
export const cached = <A, E, R>(
  key: string,
  effect: Effect.Effect<A, E, R>,
  ttl?: Duration.DurationInput
): Effect.Effect<A, E, Cache | R> =>
  getOrSet(key, effect, ttl)

/**
 * Wrap a function with caching
 *
 * @example
 * ```typescript
 * const cachedFetch = memoize(
 *   (url: string) => Effect.tryPromise(() => fetch(url).then(r => r.text())),
 *   (url) => `fetch:${url}`,
 *   Duration.minutes(10)
 * )
 * ```
 */
export const memoize = <Args extends ReadonlyArray<unknown>, A, E, R>(
  fn: (...args: Args) => Effect.Effect<A, E, R>,
  keyFn: (...args: Args) => string,
  ttl?: Duration.DurationInput
): ((...args: Args) => Effect.Effect<A, E, Cache | R>) =>
  (...args) => getOrSet(keyFn(...args), fn(...args), ttl)
