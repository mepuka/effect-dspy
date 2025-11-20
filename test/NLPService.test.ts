/**
 * Tests for NLPService using Wink NLP
 */

import * as Effect from "effect/Effect"
import { describe, expect, test } from "vitest"
import * as NLP from "../src/NLPService.js"

describe.skip("NLPService", () => {
  describe("Sentencize", () => {
    test("should split text into sentences", async () => {
      const text = "First sentence. Second sentence. Third sentence."
      const result = await Effect.runPromise(
        NLP.sentencize(text).pipe(Effect.provide(NLP.NLPServiceLive))
      )

      expect(result.length).toBe(3)
      expect(result[0]).toContain("First")
      expect(result[1]).toContain("Second")
      expect(result[2]).toContain("Third")
    })

    test("should handle empty text", async () => {
      const result = await Effect.runPromise(
        NLP.sentencize("").pipe(Effect.provide(NLP.NLPServiceLive))
      )

      expect(result.length).toBe(0)
    })
  })

  describe("Tokenize", () => {
    test("should split text into tokens", async () => {
      const text = "Hello world!"
      const result = await Effect.runPromise(
        NLP.tokenize(text).pipe(Effect.provide(NLP.NLPServiceLive))
      )

      expect(result.length).toBeGreaterThan(0)
      expect(result).toContain("Hello")
      expect(result).toContain("world")
    })

    test("should handle empty text", async () => {
      const result = await Effect.runPromise(
        NLP.tokenize("").pipe(Effect.provide(NLP.NLPServiceLive))
      )

      expect(result.length).toBe(0)
    })
  })

  describe("Paragraphize", () => {
    test("should split text into paragraphs", async () => {
      const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
      const result = await Effect.runPromise(
        NLP.paragraphize(text).pipe(Effect.provide(NLP.NLPServiceLive))
      )

      expect(result.length).toBe(3)
    })

    test("should handle single paragraph", async () => {
      const text = "Single paragraph."
      const result = await Effect.runPromise(
        NLP.paragraphize(text).pipe(Effect.provide(NLP.NLPServiceLive))
      )

      expect(result.length).toBe(1)
    })
  })

  describe("Normalize Whitespace", () => {
    test("should normalize whitespace", async () => {
      const text = "  Hello    world  "
      const result = await Effect.runPromise(
        NLP.normalizeWhitespace(text).pipe(Effect.provide(NLP.NLPServiceLive))
      )

      expect(result).toBe("Hello world")
    })

    test("should remove zero-width characters", async () => {
      const text = "Hello\u200Bworld"
      const result = await Effect.runPromise(
        NLP.normalizeWhitespace(text).pipe(Effect.provide(NLP.NLPServiceLive))
      )

      expect(result).toBe("Helloworld")
    })
  })

  describe("Word Count", () => {
    test("should count words", async () => {
      const text = "Hello world, this is a test."
      const result = await Effect.runPromise(
        NLP.wordCount(text).pipe(Effect.provide(NLP.NLPServiceLive))
      )

      expect(result).toBeGreaterThan(0)
    })

    test("should return zero for empty text", async () => {
      const result = await Effect.runPromise(
        NLP.wordCount("").pipe(Effect.provide(NLP.NLPServiceLive))
      )

      expect(result).toBe(0)
    })
  })

  describe("N-grams", () => {
    test("should extract bigrams", async () => {
      const text = "hello world test"
      const result = await Effect.runPromise(
        NLP.ngrams(text, 2).pipe(Effect.provide(NLP.NLPServiceLive))
      )

      expect(result.length).toBeGreaterThan(0)
    })

    test("should extract trigrams", async () => {
      const text = "hello world test case"
      const result = await Effect.runPromise(
        NLP.ngrams(text, 3).pipe(Effect.provide(NLP.NLPServiceLive))
      )

      expect(result.length).toBeGreaterThan(0)
    })

    test("should return empty for insufficient tokens", async () => {
      const text = "hello"
      const result = await Effect.runPromise(
        NLP.ngrams(text, 3).pipe(Effect.provide(NLP.NLPServiceLive))
      )

      expect(result.length).toBe(0)
    })
  })

  describe("Mock Service", () => {
    test("should use mock implementation", async () => {
      const mockLayer = NLP.makeMockNLPService({
        sentencize: (text) => Effect.succeed(["mocked sentence"])
      })

      const result = await Effect.runPromise(
        NLP.sentencize("any text").pipe(Effect.provide(mockLayer))
      )

      expect(result).toEqual(["mocked sentence"])
    })
  })
})
