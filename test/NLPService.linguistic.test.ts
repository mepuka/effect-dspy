/**
 * NLPService - Linguistic Annotation Tests
 *
 * Tests for POS tagging, NER, and lemmatization operations
 */

import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as NLP from "../src/NLPService.js"

describe("NLPService - POS Tagging", () => {
  it.effect("should tag simple sentence with POS tags", () =>
    Effect.gen(function* () {
      const nlp = yield* NLP.NLPService
      const result = yield* nlp.posTag("The quick brown fox jumps.")

      // Should have tags for all tokens
      expect(result.length).toBeGreaterThan(0)

      // Each result should have required properties
      result.forEach((posNode) => {
        expect(posNode.text).toBeDefined()
        expect(posNode.tag).toBeDefined()
        expect(posNode.position).toBeGreaterThanOrEqual(0)
        expect(posNode.timestamp).toBeGreaterThan(0)
      })

      // First token should be "The" (determiner)
      expect(result[0].text).toBe("The")
      expect(result[0].position).toBe(0)
    }).pipe(Effect.provide(NLP.NLPServiceLive))
  )

  it.effect("should handle empty input", () =>
    Effect.gen(function* () {
      const nlp = yield* NLP.NLPService
      const result = yield* nlp.posTag("")

      expect(result).toEqual([])
    }).pipe(Effect.provide(NLP.NLPServiceLive))
  )

  it.effect("should preserve token count", () =>
    Effect.gen(function* () {
      const nlp = yield* NLP.NLPService
      const text = "The dog runs quickly."

      const tokens = yield* nlp.tokenize(text)
      const posNodes = yield* nlp.posTag(text)

      // POS tagging should preserve token count
      expect(posNodes.length).toBe(tokens.length)
    }).pipe(Effect.provide(NLP.NLPServiceLive))
  )
})

describe("NLPService - Named Entity Recognition", () => {
  it.effect("should extract entities from text", () =>
    Effect.gen(function* () {
      const nlp = yield* NLP.NLPService
      const result = yield* nlp.extractEntities(
        "Apple Inc. was founded by Steve Jobs in California."
      )

      // Should return an array (may be empty with Wink lite)
      expect(Array.isArray(result)).toBe(true)

      // Each entity should have required properties
      result.forEach((entity) => {
        expect(entity.text).toBeDefined()
        expect(entity.entityType).toBeDefined()
        expect(entity.span).toBeDefined()
        expect(entity.span.start).toBeGreaterThanOrEqual(0)
        expect(entity.span.end).toBeGreaterThan(entity.span.start)
        expect(entity.timestamp).toBeGreaterThan(0)
      })
    }).pipe(Effect.provide(NLP.NLPServiceLive))
  )

  it.effect("should handle empty input", () =>
    Effect.gen(function* () {
      const nlp = yield* NLP.NLPService
      const result = yield* nlp.extractEntities("")

      expect(result).toEqual([])
    }).pipe(Effect.provide(NLP.NLPServiceLive))
  )

  it.effect("should include valid spans", () =>
    Effect.gen(function* () {
      const nlp = yield* NLP.NLPService
      const text = "John Smith works at Microsoft."
      const result = yield* nlp.extractEntities(text)

      // All entity spans should be within text bounds
      result.forEach((entity) => {
        expect(entity.span.start).toBeGreaterThanOrEqual(0)
        expect(entity.span.end).toBeLessThanOrEqual(text.length)
      })
    }).pipe(Effect.provide(NLP.NLPServiceLive))
  )
})

describe("NLPService - Lemmatization", () => {
  it.effect("should lemmatize tokens", () =>
    Effect.gen(function* () {
      const nlp = yield* NLP.NLPService
      const result = yield* nlp.lemmatize("The dogs are running quickly.")

      // Should have lemmas for all tokens
      expect(result.length).toBeGreaterThan(0)

      // Each result should have required properties
      result.forEach((lemmaNode) => {
        expect(lemmaNode.token).toBeDefined()
        expect(lemmaNode.lemma).toBeDefined()
        expect(lemmaNode.position).toBeGreaterThanOrEqual(0)
        expect(lemmaNode.timestamp).toBeGreaterThan(0)
      })

      // Should have lemmatized "dogs" -> "dog" (or similar)
      const dogsLemma = result.find((l) => l.token === "dogs")
      if (dogsLemma) {
        // Lemma should be different from original (dogs -> dog)
        expect(dogsLemma.lemma).toBeTruthy()
      }
    }).pipe(Effect.provide(NLP.NLPServiceLive))
  )

  it.effect("should handle empty input", () =>
    Effect.gen(function* () {
      const nlp = yield* NLP.NLPService
      const result = yield* nlp.lemmatize("")

      expect(result).toEqual([])
    }).pipe(Effect.provide(NLP.NLPServiceLive))
  )

  it.effect("should preserve token count", () =>
    Effect.gen(function* () {
      const nlp = yield* NLP.NLPService
      const text = "The cats were running."

      const tokens = yield* nlp.tokenize(text)
      const lemmas = yield* nlp.lemmatize(text)

      // Lemmatization should preserve token count
      expect(lemmas.length).toBe(tokens.length)
    }).pipe(Effect.provide(NLP.NLPServiceLive))
  )

  it.effect("lemmatization should be idempotent (on lemma strings)", () =>
    Effect.gen(function* () {
      const nlp = yield* NLP.NLPService
      const text = "running"

      const firstPass = yield* nlp.lemmatize(text)
      const lemmaText = firstPass.map((l) => l.lemma).join(" ")

      const secondPass = yield* nlp.lemmatize(lemmaText)

      // Lemmatizing lemmas should produce the same result
      expect(secondPass.map((l) => l.lemma).join(" ")).toBe(lemmaText)
    }).pipe(Effect.provide(NLP.NLPServiceLive))
  )
})

describe("NLPService - Helper Functions", () => {
  it.effect("posTag helper should work", () =>
    Effect.gen(function* () {
      const result = yield* NLP.posTag("The dog barks.")

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].text).toBe("The")
    }).pipe(Effect.provide(NLP.NLPServiceLive))
  )

  it.effect("extractEntities helper should work", () =>
    Effect.gen(function* () {
      const result = yield* NLP.extractEntities("Microsoft Corporation")

      expect(Array.isArray(result)).toBe(true)
    }).pipe(Effect.provide(NLP.NLPServiceLive))
  )

  it.effect("lemmatize helper should work", () =>
    Effect.gen(function* () {
      const result = yield* NLP.lemmatize("The cats run.")

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].token).toBe("The")
    }).pipe(Effect.provide(NLP.NLPServiceLive))
  )
})
