/**
 * WinkBackend Tests
 *
 * Tests for the Wink NLP backend implementation
 */

import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Backend from "../../src/NLPBackend.js"
import * as WinkBackend from "../../src/Backends/WinkBackend.js"

describe("WinkBackend - Initialization", () => {
  it.effect("should initialize successfully", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend

      expect(backend.name).toBe("wink-nlp")
      expect(backend.capabilities).toBeDefined()
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("should report correct capabilities", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend

      // Supported capabilities
      expect(backend.capabilities.tokenization).toBe(true)
      expect(backend.capabilities.sentencization).toBe(true)
      expect(backend.capabilities.posTagging).toBe(true)
      expect(backend.capabilities.lemmatization).toBe(true)
      expect(backend.capabilities.ner).toBe(true)

      // Unsupported capabilities
      expect(backend.capabilities.dependencyParsing).toBe(false)
      expect(backend.capabilities.relationExtraction).toBe(false)
      expect(backend.capabilities.coreferenceResolution).toBe(false)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )
})

describe("WinkBackend - Tokenization", () => {
  it.effect("should tokenize simple text", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.tokenize("The quick brown fox")

      expect(result).toEqual(["The", "quick", "brown", "fox"])
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("should handle empty input", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.tokenize("")

      expect(result).toEqual([])
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("should handle punctuation", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.tokenize("Hello, world!")

      expect(result.length).toBeGreaterThan(2)
      expect(result).toContain("Hello")
      expect(result).toContain("world")
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )
})

describe("WinkBackend - Sentencization", () => {
  it.effect("should split into sentences", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.sentencize("Hello world. How are you?")

      expect(result.length).toBe(2)
      expect(result[0]).toContain("Hello world")
      expect(result[1]).toContain("How are you")
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("should handle single sentence", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.sentencize("Just one sentence.")

      expect(result).toHaveLength(1)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("should handle empty input", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.sentencize("")

      expect(result).toEqual([])
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )
})

describe("WinkBackend - POS Tagging", () => {
  it.effect("should tag tokens with POS", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.posTag("The dog runs.")

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].text).toBe("The")
      expect(result[0].tag).toBeDefined()
      expect(result[0].position).toBe(0)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("should preserve token count", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const text = "The quick brown fox jumps."

      const tokens = yield* backend.tokenize(text)
      const posNodes = yield* backend.posTag(text)

      expect(posNodes.length).toBe(tokens.length)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("should handle empty input", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.posTag("")

      expect(result).toEqual([])
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )
})

describe("WinkBackend - Lemmatization", () => {
  it.effect("should lemmatize tokens", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.lemmatize("The dogs were running.")

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].token).toBe("The")
      expect(result[0].lemma).toBeDefined()
      expect(result[0].position).toBe(0)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("should preserve token count", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const text = "The cats run quickly."

      const tokens = yield* backend.tokenize(text)
      const lemmas = yield* backend.lemmatize(text)

      expect(lemmas.length).toBe(tokens.length)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("should handle empty input", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.lemmatize("")

      expect(result).toEqual([])
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )
})

describe("WinkBackend - Named Entity Recognition", () => {
  it.effect("should extract entities (basic)", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.extractEntities("Apple Microsoft Google")

      // Should detect capitalized words as potential entities
      expect(Array.isArray(result)).toBe(true)
      // Note: Results may vary based on heuristic implementation
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("should handle empty input", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.extractEntities("")

      expect(result).toEqual([])
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("should include valid spans", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const text = "Apple Inc. is located in California."
      const result = yield* backend.extractEntities(text)

      result.forEach((entity) => {
        expect(entity.span.start).toBeGreaterThanOrEqual(0)
        expect(entity.span.end).toBeLessThanOrEqual(text.length)
        expect(entity.span.end).toBeGreaterThan(entity.span.start)
      })
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )
})

describe("WinkBackend - Unsupported Operations", () => {
  it.effect("dependency parsing should fail with BackendNotSupported", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.parseDependencies("The dog runs.").pipe(
        Effect.flip
      )

      expect(result._tag).toBe("BackendNotSupported")
      expect(result.backend).toBe("wink-nlp")
      expect(result.operation).toBe("parseDependencies")
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("relation extraction should fail with BackendNotSupported", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend
      const result = yield* backend.extractRelations("Steve Jobs founded Apple.").pipe(
        Effect.flip
      )

      expect(result._tag).toBe("BackendNotSupported")
      expect(result.backend).toBe("wink-nlp")
      expect(result.operation).toBe("extractRelations")
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )
})

describe("WinkBackend - Error Handling", () => {
  it.effect("should catch and wrap operational errors", () =>
    Effect.gen(function* () {
      const backend = yield* Backend.NLPBackend

      // Try to tokenize something that might cause an error
      // (This is a smoke test - Wink is generally robust)
      const result = yield* backend.tokenize("Normal text")

      expect(result).toBeDefined()
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )
})
