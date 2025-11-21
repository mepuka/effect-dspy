/**
 * ResultStore - Storage for operation results
 *
 * Provides caching and retrieval of operation results to avoid
 * recomputing expensive operations.
 *
 * Implementation: In-memory Map (extensible to IndexedDB, Redis, etc.)
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Ref from "effect/Ref"
import type { NodeId } from "../EffectGraph.js"
import type { OperationResult } from "./Types.js"
import { StorageError } from "./Errors.js"

// =============================================================================
// Result Store Interface
// =============================================================================

/**
 * Key for storing results
 * Combines operation name + node ID for unique lookup
 */
export interface ResultKey {
  readonly operationName: string
  readonly nodeId: NodeId
}

export const ResultKey = {
  make: (operationName: string, nodeId: NodeId): ResultKey => ({
    operationName,
    nodeId
  }),

  toString: (key: ResultKey): string => `${key.operationName}:${key.nodeId}`
}

/**
 * Stored result with metadata
 */
export interface StoredResult<A, B, E> {
  readonly key: ResultKey
  readonly result: OperationResult<A, B, E>
  readonly timestamp: number
  readonly hits: number // Number of cache hits
}

/**
 * ResultStore service interface
 */
export interface ResultStore {
  /**
   * Store an operation result
   */
  readonly store: <A, B, E>(
    key: ResultKey,
    result: OperationResult<A, B, E>
  ) => Effect.Effect<void, StorageError, never>

  /**
   * Retrieve an operation result
   */
  readonly get: <A, B, E>(
    key: ResultKey
  ) => Effect.Effect<Option.Option<OperationResult<A, B, E>>, StorageError, never>

  /**
   * Check if result exists
   */
  readonly has: (key: ResultKey) => Effect.Effect<boolean, never, never>

  /**
   * Delete a result
   */
  readonly delete: (key: ResultKey) => Effect.Effect<void, StorageError, never>

  /**
   * Clear all results
   */
  readonly clear: () => Effect.Effect<void, StorageError, never>

  /**
   * Get cache statistics
   */
  readonly stats: () => Effect.Effect<CacheStats, never, never>

  /**
   * Clear old results (garbage collection)
   */
  readonly gc: (
    olderThanMs: number
  ) => Effect.Effect<number, StorageError, never>
}

export interface CacheStats {
  readonly size: number
  readonly totalHits: number
  readonly oldestEntry: number | null
  readonly newestEntry: number | null
}

/**
 * Context tag for ResultStore
 */
export const ResultStore = Context.GenericTag<ResultStore>("ResultStore")

// =============================================================================
// In-Memory Implementation
// =============================================================================

/**
 * In-memory result store using Effect Ref
 */
const makeResultStore = Effect.gen(function* () {
  // Mutable reference to the store map
  const storeRef = yield* Ref.make<Map<string, StoredResult<any, any, any>>>(
    new Map()
  )

  return ResultStore.of({
    store: <A, B, E>(key: ResultKey, result: OperationResult<A, B, E>) =>
      Effect.gen(function* () {
        const keyStr = ResultKey.toString(key)
        const stored: StoredResult<A, B, E> = {
          key,
          result,
          timestamp: Date.now(),
          hits: 0
        }

        yield* Ref.update(storeRef, (map) => {
          const newMap = new Map(map)
          newMap.set(keyStr, stored)
          return newMap
        })
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new StorageError({ operation: "store", cause: error }))
        )
      ),

    get: <A, B, E>(key: ResultKey) =>
      Effect.gen(function* () {
        const keyStr = ResultKey.toString(key)
        const map = yield* Ref.get(storeRef)
        const stored = map.get(keyStr)

        if (!stored) {
          return Option.none<OperationResult<A, B, E>>()
        }

        // Increment hit counter
        yield* Ref.update(storeRef, (m) => {
          const newMap = new Map(m)
          newMap.set(keyStr, {
            ...stored,
            hits: stored.hits + 1
          })
          return newMap
        })

        return Option.some(stored.result as OperationResult<A, B, E>)
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            new StorageError({ operation: "retrieve", cause: error })
          )
        )
      ),

    has: (key: ResultKey) =>
      Effect.gen(function* () {
        const keyStr = ResultKey.toString(key)
        const map = yield* Ref.get(storeRef)
        return map.has(keyStr)
      }),

    delete: (key: ResultKey) =>
      Effect.gen(function* () {
        const keyStr = ResultKey.toString(key)

        yield* Ref.update(storeRef, (map) => {
          const newMap = new Map(map)
          newMap.delete(keyStr)
          return newMap
        })
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new StorageError({ operation: "delete", cause: error }))
        )
      ),

    clear: () =>
      Effect.gen(function* () {
        yield* Ref.set(storeRef, new Map())
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new StorageError({ operation: "delete", cause: error }))
        )
      ),

    stats: () =>
      Effect.gen(function* () {
        const map = yield* Ref.get(storeRef)
        const entries = Array.from(map.values())

        const totalHits = entries.reduce((sum, e) => sum + e.hits, 0)
        const timestamps = entries.map((e) => e.timestamp)

        return {
          size: map.size,
          totalHits,
          oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
          newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null
        }
      }),

    gc: (olderThanMs: number) =>
      Effect.gen(function* () {
        const cutoff = Date.now() - olderThanMs
        let deleted = 0

        yield* Ref.update(storeRef, (map) => {
          const newMap = new Map<string, StoredResult<any, any, any>>()

          for (const [key, value] of map.entries()) {
            if (value.timestamp >= cutoff) {
              newMap.set(key, value)
            } else {
              deleted++
            }
          }

          return newMap
        })

        return deleted
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(new StorageError({ operation: "delete", cause: error }))
        )
      )
  })
})

/**
 * Live layer for ResultStore (in-memory)
 */
export const ResultStoreLive: Layer.Layer<ResultStore, never, never> =
  Layer.effect(ResultStore, makeResultStore)

/**
 * Test layer for ResultStore (starts empty)
 */
export const ResultStoreTest: Layer.Layer<ResultStore, never, never> =
  ResultStoreLive
