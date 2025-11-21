/**
 * Backend Composition Tests
 *
 * Tests for backend composition utilities (FallbackBackend, CachingBackend, etc.)
 */

import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Duration from "effect/Duration"
import * as Backend from "../../src/NLPBackend.js"
import * as WinkBackend from "../../src/Backends/WinkBackend.js"
import * as Composition from "../../src/Backends/Composition.js"

describe("FallbackBackend", () => {
  // Create a mock failing backend for testing
  const FailingBackend: Layer.Layer<Backend.NLPBackend, Backend.BackendInitError, never> =
    Layer.succeed(Backend.NLPBackend, {
      name: "failing-backend",
      capabilities: {
        tokenization: true,
        sentencization: true,
        posTagging: false,
        lemmatization: false,
        ner: false,
        dependencyParsing: true, // Claims to support it
        relationExtraction: false,
        coreferenceResolution: false,
        constituencyParsing: false
      },
      tokenize: (_text) =>
        Effect.fail(Backend.operationError("failing-backend", "tokenize", new Error("Always fails"))),
      sentencize: (_text) =>
        Effect.fail(Backend.operationError("failing-backend", "sentencize", new Error("Always fails"))),
      posTag: (_text) =>
        Effect.fail(Backend.notSupported("failing-backend", "posTag")),
      lemmatize: (_text) =>
        Effect.fail(Backend.notSupported("failing-backend", "lemmatize")),
      extractEntities: (_text) =>
        Effect.fail(Backend.notSupported("failing-backend", "extractEntities")),
      parseDependencies: (_sentence) =>
        Effect.fail(Backend.notSupported("failing-backend", "parseDependencies")),
      extractRelations: (_text) =>
        Effect.fail(Backend.notSupported("failing-backend", "extractRelations"))
    })

  it.effect("should fall back to secondary backend when primary fails", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.tokenize("Hello world")

      // Should succeed with Wink backend
      expect(result).toEqual(["Hello", "world"])
    }).pipe(Effect.provide(Composition.FallbackBackend(FailingBackend, WinkBackend.WinkBackendLive)))
  )

  it.effect("should report combined capabilities", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend

      // Should have capabilities from both backends (union)
      expect(backend.capabilities.tokenization).toBe(true) // From both
      expect(backend.capabilities.posTagging).toBe(true) // From Wink
      expect(backend.capabilities.dependencyParsing).toBe(true) // From failing (claimed)
    }).pipe(Effect.provide(Composition.FallbackBackend(FailingBackend, WinkBackend.WinkBackendLive)))
  )

  it.effect("should use primary when it supports the operation", () =>
    Effect.gen(function* () {
      // If we reverse the order, Wink should be primary
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.tokenize("Test")

      // Should succeed with Wink (primary)
      expect(result).toBeDefined()
    }).pipe(Effect.provide(Composition.FallbackBackend(WinkBackend.WinkBackendLive, FailingBackend)))
  )

  it.effect("should fall back for BackendNotSupported errors", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend

      // Failing backend doesn't support posTag, should fall back to Wink
      const result = yield* backend.posTag("The dog runs.")

      expect(result.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(Composition.FallbackBackend(FailingBackend, WinkBackend.WinkBackendLive)))
  )
})

describe("CachingBackend", () => {
  it.effect("should cache tokenization results", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const text = "Hello world test"

      // First call - should compute
      const result1 = yield* backend.tokenize(text)

      // Second call - should hit cache
      const result2 = yield* backend.tokenize(text)

      expect(result1).toEqual(result2)
      expect(result1).toEqual(["Hello", "world", "test"])
    }).pipe(
      Effect.provide(
        Composition.CachingBackend(WinkBackend.WinkBackendLive, {
          capacity: 10,
          ttl: Duration.seconds(10)
        })
      )
    )
  )

  it.effect("should cache POS tagging results", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const text = "The quick fox."

      const result1 = yield* backend.posTag(text)
      const result2 = yield* backend.posTag(text)

      expect(result1).toEqual(result2)
      expect(result1.length).toBeGreaterThan(0)
    }).pipe(
      Effect.provide(
        Composition.CachingBackend(WinkBackend.WinkBackendLive, {
          capacity: 10,
          ttl: Duration.seconds(10)
        })
      )
    )
  )

  it.effect("should preserve backend name and capabilities", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend

      expect(backend.name).toBe("cached-wink-nlp")
      expect(backend.capabilities.tokenization).toBe(true)
      expect(backend.capabilities.posTagging).toBe(true)
    }).pipe(
      Effect.provide(
        Composition.CachingBackend(WinkBackend.WinkBackendLive, {
          capacity: 10,
          ttl: Duration.seconds(10)
        })
      )
    )
  )
})

describe("safeCall", () => {
  it.effect("should return result on success", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const operation = backend.tokenize("Hello world")

      const result = yield* Composition.safeCall(operation, [])

      expect(result).toEqual(["Hello", "world"])
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("should return empty value on failure", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const operation = backend.parseDependencies("Test") // Not supported by Wink

      const result = yield* Composition.safeCall(operation, [])

      expect(result).toEqual([])
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )
})

describe("tryOperation", () => {
  it.effect("should return result on success", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const operation = backend.tokenize("Test")

      const result = yield* Composition.tryOperation(operation)

      expect(result).not.toBeNull()
      expect(result).toEqual(["Test"])
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("should return null for BackendNotSupported", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const operation = backend.parseDependencies("Test") // Not supported

      const result = yield* Composition.tryOperation(operation)

      expect(result).toBeNull()
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )
})

describe("Backend Selection", () => {
  it.effect("should select backend with required capabilities", () =>
    Effect.gen(function* () {
      const backends = [WinkBackend.WinkBackendLive]
      const selected = yield* Composition.selectBackend(backends, ["tokenization", "posTagging"])

      const backend = yield* Effect.provide(Backend.NLPBackend, selected)

      expect(backend.name).toBe("wink-nlp")
      expect(backend.capabilities.tokenization).toBe(true)
      expect(backend.capabilities.posTagging).toBe(true)
    })
  )

  it.effect("should fail when no backend supports required capabilities", () =>
    Effect.gen(function* () {
      const backends = [WinkBackend.WinkBackendLive]

      // Try to select with capability Wink doesn't support
      const result = yield* Composition.selectBackend(backends, ["dependencyParsing"]).pipe(
        Effect.flip
      )

      expect(result._tag).toBe("BackendInitError")
      expect(result.backend).toBe("backend-selection")
    })
  )
})
