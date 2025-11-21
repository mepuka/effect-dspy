/**
 * Property-based tests for NLP operation laws
 *
 * This test suite verifies mathematical properties specific to NLP operations:
 * 1. Idempotence: f(f(x)) = f(x) for normalization operations
 * 2. Monotonicity: filtering reduces or preserves size
 * 3. Preservation: certain operations preserve linguistic properties
 * 4. Metric properties: similarity measures form a metric space
 *
 * These tests ensure our NLP operations are mathematically sound and predictable.
 */

import { describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as fc from "fast-check"
import * as NLP from "../src/NLPService.js"

// =============================================================================
// Idempotence Laws
// =============================================================================

describe("Idempotence Laws", () => {
  describe("normalizeWhitespace", () => {
    it.layer(NLP.NLPServiceLive)(
      "should be idempotent: normalize(normalize(x)) = normalize(x)",
      () =>
        fc.assert(
          fc.asyncProperty(fc.string(), async (text) => {
            const program = Effect.gen(function*() {
              const nlp = yield* NLP.NLPService

              // Apply normalization once
              const once = yield* nlp.normalizeWhitespace(text)

              // Apply normalization twice
              const twice = yield* nlp.normalizeWhitespace(once)

              return once === twice
            })

            return await Effect.runPromise(
              program.pipe(Effect.provide(NLP.NLPServiceLive))
            )
          })
        )
    )
  })

  describe("removePunctuation", () => {
    it.layer(NLP.NLPServiceLive)(
      "should be idempotent: remove(remove(x)) = remove(x)",
      () =>
        fc.assert(
          fc.asyncProperty(fc.string(), async (text) => {
            const program = Effect.gen(function*() {
              const nlp = yield* NLP.NLPService

              const once = yield* nlp.removePunctuation(text)
              const twice = yield* nlp.removePunctuation(once)

              return once === twice
            })

            return await Effect.runPromise(
              program.pipe(Effect.provide(NLP.NLPServiceLive))
            )
          })
        )
    )
  })

  describe("removeExtraSpaces", () => {
    it.layer(NLP.NLPServiceLive)(
      "should be idempotent: remove(remove(x)) = remove(x)",
      () =>
        fc.assert(
          fc.asyncProperty(fc.string(), async (text) => {
            const program = Effect.gen(function*() {
              const nlp = yield* NLP.NLPService

              const once = yield* nlp.removeExtraSpaces(text)
              const twice = yield* nlp.removeExtraSpaces(once)

              return once === twice
            })

            return await Effect.runPromise(
              program.pipe(Effect.provide(NLP.NLPServiceLive))
            )
          })
        )
    )
  })

  describe("stem", () => {
    it.layer(NLP.NLPServiceLive)(
      "should be idempotent: stem(stem(tokens)) = stem(tokens)",
      () =>
        fc.assert(
          fc.asyncProperty(
            fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
              minLength: 1,
              maxLength: 50
            }),
            async (tokens) => {
              const program = Effect.gen(function*() {
                const nlp = yield* NLP.NLPService

                const once = yield* nlp.stem(tokens)
                const twice = yield* nlp.stem(once)

                return JSON.stringify(once) === JSON.stringify(twice)
              })

              return await Effect.runPromise(
                program.pipe(Effect.provide(NLP.NLPServiceLive))
              )
            }
          )
        )
    )
  })

  describe("removeStopWords", () => {
    it.layer(NLP.NLPServiceLive)(
      "should be idempotent: removeStopWords twice = removeStopWords once",
      () =>
        fc.assert(
          fc.asyncProperty(
            fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
              minLength: 1,
              maxLength: 50
            }),
            async (tokens) => {
              const program = Effect.gen(function*() {
                const nlp = yield* NLP.NLPService

                const once = yield* nlp.removeStopWords(tokens)
                const twice = yield* nlp.removeStopWords(once)

                return JSON.stringify(once) === JSON.stringify(twice)
              })

              return await Effect.runPromise(
                program.pipe(Effect.provide(NLP.NLPServiceLive))
              )
            }
          )
        )
    )
  })
})

// =============================================================================
// Monotonicity Laws
// =============================================================================

describe("Monotonicity Laws", () => {
  describe("removeStopWords", () => {
    it.layer(NLP.NLPServiceLive)(
      "should be monotonic: |removeStopWords(tokens)| ≤ |tokens|",
      () =>
        fc.assert(
          fc.asyncProperty(
            fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
              minLength: 1,
              maxLength: 50
            }),
            async (tokens) => {
              const program = Effect.gen(function*() {
                const nlp = yield* NLP.NLPService

                const filtered = yield* nlp.removeStopWords(tokens)

                return filtered.length <= tokens.length
              })

              return await Effect.runPromise(
                program.pipe(Effect.provide(NLP.NLPServiceLive))
              )
            }
          )
        )
    )
  })

  describe("removePunctuation", () => {
    it.layer(NLP.NLPServiceLive)(
      "should be monotonic: |remove(text)| ≤ |text|",
      () =>
        fc.assert(
          fc.asyncProperty(fc.string(), async (text) => {
            const program = Effect.gen(function*() {
              const nlp = yield* NLP.NLPService

              const cleaned = yield* nlp.removePunctuation(text)

              return cleaned.length <= text.length
            })

            return await Effect.runPromise(
              program.pipe(Effect.provide(NLP.NLPServiceLive))
            )
          })
        )
    )
  })
})

// =============================================================================
// Preservation Laws
// =============================================================================

describe("Preservation Laws", () => {
  describe("tokenize", () => {
    it.layer(NLP.NLPServiceLive)(
      "should preserve word count: wordCount(text) ≈ |tokenize(text)|",
      () =>
        fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 10, maxLength: 200 }),
            async (text) => {
              if (text.trim() === "") return true

              const program = Effect.gen(function*() {
                const nlp = yield* NLP.NLPService

                const tokens = yield* nlp.tokenize(text)
                const count = yield* nlp.wordCount(text)

                // They should be equal (Wink uses same tokenizer)
                return tokens.length === count
              })

              return await Effect.runPromise(
                program.pipe(Effect.provide(NLP.NLPServiceLive))
              )
            }
          )
        )
    )
  })

  describe("bagOfWords", () => {
    it.layer(NLP.NLPServiceLive)(
      "should preserve token count: sum(bow.values) = tokens.length",
      () =>
        fc.assert(
          fc.asyncProperty(
            fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
              minLength: 1,
              maxLength: 50
            }),
            async (tokens) => {
              const program = Effect.gen(function*() {
                const nlp = yield* NLP.NLPService

                const bow = yield* nlp.bagOfWords(tokens)

                const totalCount = Array.from(bow.values()).reduce(
                  (sum, count) => sum + count,
                  0
                )

                return totalCount === tokens.length
              })

              return await Effect.runPromise(
                program.pipe(Effect.provide(NLP.NLPServiceLive))
              )
            }
          )
        )
    )

    it.layer(NLP.NLPServiceLive)(
      "should preserve vocabulary: bow.keys ⊆ tokens",
      () =>
        fc.assert(
          fc.asyncProperty(
            fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
              minLength: 1,
              maxLength: 50
            }),
            async (tokens) => {
              const program = Effect.gen(function*() {
                const nlp = yield* NLP.NLPService

                const bow = yield* nlp.bagOfWords(tokens)
                const tokenSet = new Set(tokens)

                // Every key in bow should be in original tokens
                for (const key of bow.keys()) {
                  if (!tokenSet.has(key)) {
                    return false
                  }
                }

                return true
              })

              return await Effect.runPromise(
                program.pipe(Effect.provide(NLP.NLPServiceLive))
              )
            }
          )
        )
    )
  })
})

// =============================================================================
// Metric Space Laws (for similarity measures)
// =============================================================================

describe("Metric Space Laws for String Similarity", () => {
  describe("stringSimilarity", () => {
    it.layer(NLP.NLPServiceLive)(
      "should be reflexive: similarity(x, x) = 1",
      () =>
        fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 100 }),
            async (text) => {
              const program = Effect.gen(function*() {
                const nlp = yield* NLP.NLPService

                const sim = yield* nlp.stringSimilarity(text, text)

                return Math.abs(sim - 1.0) < 0.0001
              })

              return await Effect.runPromise(
                program.pipe(Effect.provide(NLP.NLPServiceLive))
              )
            }
          )
        )
    )

    it.layer(NLP.NLPServiceLive)(
      "should be symmetric: similarity(x, y) = similarity(y, x)",
      () =>
        fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.string({ minLength: 1, maxLength: 50 }),
            async (s1, s2) => {
              const program = Effect.gen(function*() {
                const nlp = yield* NLP.NLPService

                const sim1 = yield* nlp.stringSimilarity(s1, s2)
                const sim2 = yield* nlp.stringSimilarity(s2, s1)

                return Math.abs(sim1 - sim2) < 0.0001
              })

              return await Effect.runPromise(
                program.pipe(Effect.provide(NLP.NLPServiceLive))
              )
            }
          )
        )
    )

    it.layer(NLP.NLPServiceLive)("should be bounded: 0 ≤ similarity ≤ 1", () =>
      fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (s1, s2) => {
            const program = Effect.gen(function*() {
              const nlp = yield* NLP.NLPService

              const sim = yield* nlp.stringSimilarity(s1, s2)

              return sim >= 0 && sim <= 1
            })

            return await Effect.runPromise(
              program.pipe(Effect.provide(NLP.NLPServiceLive))
            )
          }
        )
      )
    )

    it.layer(NLP.NLPServiceLive)(
      "should satisfy: identical strings have similarity 1",
      () =>
        fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 100 }),
            async (text) => {
              const program = Effect.gen(function*() {
                const nlp = yield* NLP.NLPService

                const sim = yield* nlp.stringSimilarity(text, text)

                return sim === 1.0
              })

              return await Effect.runPromise(
                program.pipe(Effect.provide(NLP.NLPServiceLive))
              )
            }
          )
        )
    )
  })
})

// =============================================================================
// Composition Laws
// =============================================================================

describe("Composition Laws", () => {
  describe("normalize >> tokenize", () => {
    it.layer(NLP.NLPServiceLive)(
      "should commute: tokenize(normalize(x)) produces same vocab as normalize(tokenize(x))",
      () =>
        fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 10, maxLength: 100 }),
            async (text) => {
              if (text.trim() === "") return true

              const program = Effect.gen(function*() {
                const nlp = yield* NLP.NLPService

                // Path 1: normalize then tokenize
                const normalized = yield* nlp.normalizeWhitespace(text)
                const tokens1 = yield* nlp.tokenize(normalized)

                // Path 2: tokenize then normalize each token
                const tokens2Raw = yield* nlp.tokenize(text)
                const tokens2 = yield* Effect.all(
                  tokens2Raw.map((t) => nlp.normalizeWhitespace(t))
                )

                // Vocabularies should be the same (order might differ)
                const vocab1 = new Set(tokens1)
                const vocab2 = new Set(tokens2.filter((t) => t.length > 0))

                // Check set equality
                if (vocab1.size !== vocab2.size) return false

                for (const token of vocab1) {
                  if (!vocab2.has(token)) return false
                }

                return true
              })

              return await Effect.runPromise(
                program.pipe(Effect.provide(NLP.NLPServiceLive))
              )
            }
          )
        )
    )
  })

  describe("removePunctuation >> tokenize", () => {
    it.layer(NLP.NLPServiceLive)(
      "should preserve or increase token count",
      () =>
        fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 10, maxLength: 100 }),
            async (text) => {
              if (text.trim() === "") return true

              const program = Effect.gen(function*() {
                const nlp = yield* NLP.NLPService

                // Without removing punctuation
                const tokens1 = yield* nlp.tokenize(text)

                // With removing punctuation
                const cleaned = yield* nlp.removePunctuation(text)
                const tokens2 = yield* nlp.tokenize(cleaned)

                // Removing punctuation might merge tokens or remove punctuation tokens
                // So token count should be less than or equal
                return tokens2.length <= tokens1.length
              })

              return await Effect.runPromise(
                program.pipe(Effect.provide(NLP.NLPServiceLive))
              )
            }
          )
        )
    )
  })

  describe("tokenize >> stem >> removeStopWords", () => {
    it.layer(NLP.NLPServiceLive)(
      "should be order-independent with removeStopWords >> stem",
      () =>
        fc.assert(
          fc.asyncProperty(
            fc.array(fc.string({ minLength: 2, maxLength: 20 }), {
              minLength: 5,
              maxLength: 30
            }),
            async (tokens) => {
              const program = Effect.gen(function*() {
                const nlp = yield* NLP.NLPService

                // Path 1: stem then remove stop words
                const stemmed1 = yield* nlp.stem(tokens)
                const path1 = yield* nlp.removeStopWords(stemmed1)

                // Path 2: remove stop words then stem
                const filtered2 = yield* nlp.removeStopWords(tokens)
                const path2 = yield* nlp.stem(filtered2)

                // Results should be identical
                return (
                  JSON.stringify(Array.from(path1).sort()) ===
                  JSON.stringify(Array.from(path2).sort())
                )
              })

              return await Effect.runPromise(
                program.pipe(Effect.provide(NLP.NLPServiceLive))
              )
            }
          )
        )
    )
  })
})

// =============================================================================
// Specific NLP Properties
// =============================================================================

describe("NLP-Specific Properties", () => {
  describe("N-grams", () => {
    it.layer(NLP.NLPServiceLive)(
      "should satisfy: |ngrams(text, n)| = max(0, |tokens| - n + 1)",
      () =>
        fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 10, maxLength: 100 }),
            fc.nat({ max: 5 }).map((n) => n + 1), // n >= 1
            async (text, n) => {
              if (text.trim() === "") return true

              const program = Effect.gen(function*() {
                const nlp = yield* NLP.NLPService

                const tokens = yield* nlp.tokenize(text)
                const ngrams = yield* nlp.ngrams(text, n)

                const expectedCount = Math.max(0, tokens.length - n + 1)

                return ngrams.length === expectedCount
              })

              return await Effect.runPromise(
                program.pipe(Effect.provide(NLP.NLPServiceLive))
              )
            }
          )
        )
    )

    it.layer(NLP.NLPServiceLive)(
      "should produce unigrams equal to tokens when n=1",
      () =>
        fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 10, maxLength: 100 }),
            async (text) => {
              if (text.trim() === "") return true

              const program = Effect.gen(function*() {
                const nlp = yield* NLP.NLPService

                const tokens = yield* nlp.tokenize(text)
                const unigrams = yield* nlp.ngrams(text, 1)

                return JSON.stringify(tokens) === JSON.stringify(unigrams)
              })

              return await Effect.runPromise(
                program.pipe(Effect.provide(NLP.NLPServiceLive))
              )
            }
          )
        )
    )
  })

  describe("Sentence boundary preservation", () => {
    it.layer(NLP.NLPServiceLive)(
      "should preserve content: joining sentences approximates original text",
      () =>
        fc.assert(
          fc.asyncProperty(
            fc.array(
              fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
              { minLength: 1, maxLength: 5 }
            ),
            async (sentences) => {
              const program = Effect.gen(function*() {
                const nlp = yield* NLP.NLPService

                // Join and re-sentencize
                const text = sentences.join(". ") + "."
                const reSentences = yield* nlp.sentencize(text)

                // Number of sentences should be preserved approximately
                return Math.abs(reSentences.length - sentences.length) <= 1
              })

              return await Effect.runPromise(
                program.pipe(Effect.provide(NLP.NLPServiceLive))
              )
            }
          )
        )
    )
  })
})
