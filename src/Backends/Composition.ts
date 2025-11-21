/**
 * Backend Composition Utilities
 *
 * This module provides utilities for composing multiple NLP backends:
 * - FallbackBackend: Try primary, fall back to secondary
 * - CachingBackend: Add caching layer to any backend
 * - ParallelBackend: Run multiple backends and take best result
 *
 * Category theory: Backend composition forms a monoid where:
 * - Identity is the no-op backend
 * - Composition is fallback chaining
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Duration from "effect/Duration"
import * as Backend from "../NLPBackend.js"
import * as S from "../Schema.js"

// =============================================================================
// Fallback Backend
// =============================================================================

/**
 * Create a backend that tries the primary backend first, then falls back
 * to secondary if the primary fails or doesn't support the operation.
 *
 * Category theory: This forms a coproduct (sum type) in the category of backends.
 *
 * Usage:
 *   const backend = FallbackBackend(CoreNLPBackend, WinkBackend)
 *   // Will try CoreNLP first, fall back to Wink if it fails
 *
 * @param primary - Primary backend layer
 * @param fallback - Fallback backend layer
 */
export const FallbackBackend = (
  primary: Layer.Layer<Backend.NLPBackend, Backend.NLPBackendError, never>,
  fallback: Layer.Layer<Backend.NLPBackend, Backend.NLPBackendError, never>
): Layer.Layer<Backend.NLPBackend, Backend.NLPBackendError, never> =>
  Layer.unwrapEffect(
    Effect.gen(function* () {
      // Try to get primary backend
      const primaryBackend = yield* Effect.provide(Backend.NLPBackend, primary).pipe(
        Effect.option
      )

      // Get fallback backend
      const fallbackBackend = yield* Effect.provide(Backend.NLPBackend, fallback)

      // If primary failed to initialize, use fallback
      if (primaryBackend._tag === "None") {
        return Layer.succeed(Backend.NLPBackend, fallbackBackend)
      }

      const primaryValue = primaryBackend.value

      // Create composite backend that tries primary, falls back to secondary
      const composite: Backend.NLPBackend = {
        name: `${primaryValue.name}+${fallbackBackend.name}`,

        capabilities: {
          // Union of capabilities from both backends
          tokenization: primaryValue.capabilities.tokenization || fallbackBackend.capabilities.tokenization,
          sentencization: primaryValue.capabilities.sentencization || fallbackBackend.capabilities.sentencization,
          posTagging: primaryValue.capabilities.posTagging || fallbackBackend.capabilities.posTagging,
          lemmatization: primaryValue.capabilities.lemmatization || fallbackBackend.capabilities.lemmatization,
          ner: primaryValue.capabilities.ner || fallbackBackend.capabilities.ner,
          dependencyParsing:
            primaryValue.capabilities.dependencyParsing || fallbackBackend.capabilities.dependencyParsing,
          relationExtraction:
            primaryValue.capabilities.relationExtraction || fallbackBackend.capabilities.relationExtraction,
          coreferenceResolution:
            primaryValue.capabilities.coreferenceResolution ||
            fallbackBackend.capabilities.coreferenceResolution,
          constituencyParsing:
            primaryValue.capabilities.constituencyParsing || fallbackBackend.capabilities.constituencyParsing
        },

        // Core operations with fallback
        // Catches all backend errors and falls back to secondary
        tokenize: (text) =>
          primaryValue.tokenize(text).pipe(
            Effect.catchAll(() => fallbackBackend.tokenize(text))
          ),

        sentencize: (text) =>
          primaryValue.sentencize(text).pipe(
            Effect.catchAll(() => fallbackBackend.sentencize(text))
          ),

        posTag: (text) =>
          primaryValue.posTag(text).pipe(
            Effect.catchAll(() => fallbackBackend.posTag(text))
          ),

        lemmatize: (text) =>
          primaryValue.lemmatize(text).pipe(
            Effect.catchAll(() => fallbackBackend.lemmatize(text))
          ),

        extractEntities: (text) =>
          primaryValue.extractEntities(text).pipe(
            Effect.catchAll(() => fallbackBackend.extractEntities(text))
          ),

        parseDependencies: (sentence) =>
          primaryValue.parseDependencies(sentence).pipe(
            Effect.catchAll(() => fallbackBackend.parseDependencies(sentence))
          ),

        extractRelations: (text) =>
          primaryValue.extractRelations(text).pipe(
            Effect.catchAll(() => fallbackBackend.extractRelations(text))
          )
      }

      return Layer.succeed(Backend.NLPBackend, composite)
    })
  )

// =============================================================================
// Caching Backend
// =============================================================================

/**
 * Add caching to any backend
 *
 * This wraps a backend with an LRU cache to avoid recomputing expensive operations.
 *
 * @param backend - Backend layer to wrap with caching
 * @param options - Cache configuration (capacity, ttl)
 */
export const CachingBackend = (
  backend: Layer.Layer<Backend.NLPBackend, Backend.NLPBackendError, never>,
  _options: {
    readonly capacity: number
    readonly ttl: Duration.DurationInput
  } = {
    capacity: 100,
    ttl: Duration.minutes(10)
  }
): Layer.Layer<Backend.NLPBackend, Backend.NLPBackendError, never> =>
  Layer.unwrapEffect(
    Effect.gen(function* () {
      const baseBackend = yield* Effect.provide(Backend.NLPBackend, backend)

      // Simple Map-based caching (TODO: Replace with proper LRU cache with TTL)
      const tokenizeCache = new Map<string, ReadonlyArray<string>>()
      const sentencizeCache = new Map<string, ReadonlyArray<string>>()
      const posTagCache = new Map<string, ReadonlyArray<S.POSNode>>()
      const lemmatizeCache = new Map<string, ReadonlyArray<S.LemmaNode>>()
      const entitiesCache = new Map<string, ReadonlyArray<S.EntityNode>>()

      const cached: Backend.NLPBackend = {
        name: `cached-${baseBackend.name}`,
        capabilities: baseBackend.capabilities,

        tokenize: (text) => {
          const cached = tokenizeCache.get(text)
          if (cached) return Effect.succeed(cached)
          return baseBackend.tokenize(text).pipe(
            Effect.tap((result) => Effect.sync(() => { tokenizeCache.set(text, result) }))
          )
        },

        sentencize: (text) => {
          const cached = sentencizeCache.get(text)
          if (cached) return Effect.succeed(cached)
          return baseBackend.sentencize(text).pipe(
            Effect.tap((result) => Effect.sync(() => { sentencizeCache.set(text, result) }))
          )
        },

        posTag: (text) => {
          const cached = posTagCache.get(text)
          if (cached) return Effect.succeed(cached)
          return baseBackend.posTag(text).pipe(
            Effect.tap((result) => Effect.sync(() => { posTagCache.set(text, result) }))
          )
        },

        lemmatize: (text) => {
          const cached = lemmatizeCache.get(text)
          if (cached) return Effect.succeed(cached)
          return baseBackend.lemmatize(text).pipe(
            Effect.tap((result) => Effect.sync(() => { lemmatizeCache.set(text, result) }))
          )
        },

        extractEntities: (text) => {
          const cached = entitiesCache.get(text)
          if (cached) return Effect.succeed(cached)
          return baseBackend.extractEntities(text).pipe(
            Effect.tap((result) => Effect.sync(() => { entitiesCache.set(text, result) }))
          )
        },

        // Advanced operations bypass cache (less frequently used)
        parseDependencies: (sentence) => baseBackend.parseDependencies(sentence),
        extractRelations: (text) => baseBackend.extractRelations(text)
      }

      return Layer.succeed(Backend.NLPBackend, cached)
    })
  )

// =============================================================================
// Safe Fallback Helpers
// =============================================================================

/**
 * Safely call a backend operation with automatic fallback to empty result
 *
 * This is useful when you want to try an operation but don't care if it fails.
 *
 * @param operation - Backend operation to try
 * @param emptyValue - Value to return if operation fails
 */
export const safeCall = <A>(
  operation: Effect.Effect<A, Backend.NLPBackendError, never>,
  emptyValue: A
): Effect.Effect<A, never, never> =>
  operation.pipe(
    Effect.catchAll(() => Effect.succeed(emptyValue))
  )

/**
 * Try an operation, return Option.None if not supported
 */
export const tryOperation = <A>(
  operation: Effect.Effect<A, Backend.NLPBackendError, never>
): Effect.Effect<A | null, Exclude<Backend.NLPBackendError, Backend.BackendNotSupported>, never> =>
  operation.pipe(
    Effect.catchTag("BackendNotSupported", () => Effect.succeed(null))
  )

// =============================================================================
// Backend Selection Helpers
// =============================================================================

/**
 * Select best backend based on required capabilities
 *
 * @param backends - Array of backend layers to choose from
 * @param requiredCapabilities - Capabilities that must be supported
 */
export const selectBackend = (
  backends: ReadonlyArray<Layer.Layer<Backend.NLPBackend, Backend.NLPBackendError, never>>,
  requiredCapabilities: ReadonlyArray<keyof Backend.BackendCapabilities>
): Effect.Effect<Layer.Layer<Backend.NLPBackend, Backend.NLPBackendError, never>, Backend.BackendInitError> =>
  Effect.gen(function* () {
    for (const backendLayer of backends) {
      const backend = yield* Effect.provide(Backend.NLPBackend, backendLayer).pipe(
        Effect.option
      )

      if (backend._tag === "Some") {
        const hasAllCapabilities = requiredCapabilities.every(
          (cap) => backend.value.capabilities[cap]
        )

        if (hasAllCapabilities) {
          return backendLayer
        }
      }
    }

    // No backend supports all required capabilities
    return yield* Effect.fail(
      Backend.initError(
        "backend-selection",
        new Error(
          `No backend supports all required capabilities: ${requiredCapabilities.join(", ")}`
        )
      )
    )
  })
