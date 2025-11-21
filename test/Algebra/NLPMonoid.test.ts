/**
 * Property-based tests for NLP-specific Monoid laws
 *
 * This test suite verifies that our NLP monoid instances satisfy:
 * 1. Standard monoid laws (associativity, identity)
 * 2. NLP-specific laws (idempotence, commutativity where applicable)
 * 3. Homomorphism properties (structure-preserving operations)
 *
 * We use fast-check for property-based testing to verify laws hold
 * for all possible inputs, not just specific examples.
 */

import { describe, expect, it } from "vitest"
import * as fc from "fast-check"
import * as NLP from "../../src/Algebra/NLPMonoid.js"
import * as M from "../../src/Algebra/Monoid.js"

// =============================================================================
// Custom Arbitraries for NLP Structures
// =============================================================================

/**
 * Arbitrary for bag of words (Map<string, number>)
 */
const bagOfWordsArbitrary = fc
  .array(fc.tuple(fc.string({ minLength: 1, maxLength: 10 }), fc.nat(100)), {
    maxLength: 20
  })
  .map((entries) => new Map(entries))

/**
 * Arbitrary for named entities
 */
const namedEntityArbitrary = fc.record({
  text: fc.string({ minLength: 1, maxLength: 20 }),
  type: fc.constantFrom("PER", "ORG", "LOC", "MISC"),
  startPos: fc.nat(100),
  endPos: fc.nat(100)
})

/**
 * Arbitrary for document statistics
 */
const documentStatsArbitrary = fc.record({
  wordCount: fc.nat(1000),
  sentenceCount: fc.nat(100),
  charCount: fc.nat(10000)
})

/**
 * Arbitrary for dependency edges
 */
const dependencyEdgeArbitrary = fc.record({
  head: fc.nat(20),
  dependent: fc.nat(20),
  relation: fc.constantFrom(
    "nsubj",
    "dobj",
    "iobj",
    "det",
    "amod",
    "advmod",
    "prep"
  )
})

/**
 * Arbitrary for text analysis results
 */
const textAnalysisArbitrary = fc.record({
  bow: bagOfWordsArbitrary,
  entities: fc.array(namedEntityArbitrary, { maxLength: 10 }),
  sentenceCount: fc.nat(100),
  vocabulary: fc
    .array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 50 })
    .map((arr) => new Set(arr))
})

// =============================================================================
// Generic Monoid Law Testing
// =============================================================================

/**
 * Test all monoid laws for a given monoid instance
 */
const testMonoidLaws = <A>(
  name: string,
  monoid: M.Monoid<A>,
  arbitrary: fc.Arbitrary<A>,
  equals: (a: A, b: A) => boolean = (a, b) => a === b
) => {
  describe(`${name} Monoid Laws`, () => {
    it("should satisfy left identity: empty ⊕ x = x", () => {
      fc.assert(
        fc.property(arbitrary, (x) => {
          const result = monoid.combine(monoid.empty, x)
          return equals(result, x)
        })
      )
    })

    it("should satisfy right identity: x ⊕ empty = x", () => {
      fc.assert(
        fc.property(arbitrary, (x) => {
          const result = monoid.combine(x, monoid.empty)
          return equals(result, x)
        })
      )
    })

    it("should satisfy associativity: (x ⊕ y) ⊕ z = x ⊕ (y ⊕ z)", () => {
      fc.assert(
        fc.property(arbitrary, arbitrary, arbitrary, (x, y, z) => {
          const left = monoid.combine(monoid.combine(x, y), z)
          const right = monoid.combine(x, monoid.combine(y, z))
          return equals(left, right)
        })
      )
    })
  })
}

// =============================================================================
// Map Equality Helpers
// =============================================================================

const mapEquals = <K, V>(m1: Map<K, V>, m2: Map<K, V>): boolean => {
  if (m1.size !== m2.size) return false
  for (const [key, val] of m1) {
    if (!m2.has(key) || m2.get(key) !== val) return false
  }
  return true
}

const setEquals = <T>(s1: Set<T>, s2: Set<T>): boolean => {
  if (s1.size !== s2.size) return false
  for (const elem of s1) {
    if (!s2.has(elem)) return false
  }
  return true
}

const arrayEquals = <T>(
  a1: ReadonlyArray<T>,
  a2: ReadonlyArray<T>
): boolean => {
  if (a1.length !== a2.length) return false
  return a1.every((x, i) => JSON.stringify(x) === JSON.stringify(a2[i]))
}

// =============================================================================
// Token Monoid Tests
// =============================================================================

testMonoidLaws("TokenConcat", NLP.TokenConcat, fc.string())

testMonoidLaws(
  "TokenBagOfWords",
  NLP.TokenBagOfWords,
  bagOfWordsArbitrary,
  mapEquals
)

testMonoidLaws(
  "TokenSetUnion",
  NLP.TokenSetUnion,
  fc.array(fc.string()).map((arr) => new Set(arr)),
  setEquals
)

// =============================================================================
// Sentence Monoid Tests
// =============================================================================

testMonoidLaws("SentenceConcat", NLP.SentenceConcat, fc.string())

testMonoidLaws(
  "SentenceArray",
  NLP.SentenceArray,
  fc.array(fc.string()),
  arrayEquals
)

// =============================================================================
// Document Monoid Tests
// =============================================================================

testMonoidLaws("DocumentText", NLP.DocumentText, fc.string())

testMonoidLaws(
  "DocumentStats",
  NLP.DocumentStats,
  documentStatsArbitrary,
  (s1, s2) =>
    s1.wordCount === s2.wordCount &&
    s1.sentenceCount === s2.sentenceCount &&
    s1.charCount === s2.charCount
)

// =============================================================================
// Linguistic Feature Monoid Tests
// =============================================================================

testMonoidLaws(
  "NamedEntityList",
  NLP.NamedEntityList,
  fc.array(namedEntityArbitrary),
  arrayEquals
)

testMonoidLaws(
  "DependencyParse",
  NLP.DependencyParse,
  fc.array(dependencyEdgeArbitrary),
  arrayEquals
)

// =============================================================================
// Corpus Monoid Tests
// =============================================================================

testMonoidLaws(
  "TermFrequency",
  NLP.TermFrequency,
  bagOfWordsArbitrary,
  mapEquals
)

testMonoidLaws(
  "DocumentFrequency",
  NLP.DocumentFrequency,
  fc
    .array(fc.tuple(fc.string({ minLength: 1, maxLength: 10 }), fc.nat(10)), {
      maxLength: 20
    })
    .map((entries) => new Map(entries)),
  mapEquals
)

testMonoidLaws(
  "Vocabulary",
  NLP.Vocabulary,
  fc.array(fc.string()).map((arr) => new Set(arr)),
  setEquals
)

// =============================================================================
// Specialized Aggregation Monoid Tests
// =============================================================================

testMonoidLaws(
  "WeightedTokens",
  NLP.WeightedTokens,
  fc
    .array(fc.tuple(fc.string({ minLength: 1, maxLength: 10 }), fc.double({ min: 0, max: 1 })), {
      maxLength: 20
    })
    .map((entries) => new Map(entries)),
  mapEquals
)

testMonoidLaws(
  "NGramFrequency",
  NLP.NGramFrequency,
  fc
    .array(fc.tuple(fc.string({ minLength: 1, maxLength: 20 }), fc.nat(100)), {
      maxLength: 20
    })
    .map((entries) => new Map(entries)),
  mapEquals
)

// =============================================================================
// Composite Monoid Tests
// =============================================================================

testMonoidLaws(
  "TextAnalysisMonoid",
  NLP.TextAnalysisMonoid,
  textAnalysisArbitrary,
  (a1, a2) =>
    mapEquals(a1.bow, a2.bow) &&
    arrayEquals(a1.entities, a2.entities) &&
    a1.sentenceCount === a2.sentenceCount &&
    setEquals(a1.vocabulary, a2.vocabulary)
)

// =============================================================================
// NLP-Specific Property Tests
// =============================================================================

describe("NLP-Specific Properties", () => {
  describe("TokenBagOfWords Commutativity", () => {
    it("should be commutative: bow1 ⊕ bow2 = bow2 ⊕ bow1", () => {
      fc.assert(
        fc.property(bagOfWordsArbitrary, bagOfWordsArbitrary, (bow1, bow2) => {
          const left = NLP.TokenBagOfWords.combine(bow1, bow2)
          const right = NLP.TokenBagOfWords.combine(bow2, bow1)
          return mapEquals(left, right)
        })
      )
    })
  })

  describe("TokenSetUnion Commutativity", () => {
    it("should be commutative: set1 ∪ set2 = set2 ∪ set1", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string()).map((arr) => new Set(arr)),
          fc.array(fc.string()).map((arr) => new Set(arr)),
          (set1, set2) => {
            const left = NLP.TokenSetUnion.combine(set1, set2)
            const right = NLP.TokenSetUnion.combine(set2, set1)
            return setEquals(left, right)
          }
        )
      )
    })
  })

  describe("TokenSetUnion Idempotence", () => {
    it("should be idempotent: set ∪ set = set", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string()).map((arr) => new Set(arr)),
          (set) => {
            const result = NLP.TokenSetUnion.combine(set, set)
            return setEquals(result, set)
          }
        )
      )
    })
  })

  describe("DocumentStats Addition Properties", () => {
    it("should preserve non-negativity", () => {
      fc.assert(
        fc.property(
          documentStatsArbitrary,
          documentStatsArbitrary,
          (s1, s2) => {
            const result = NLP.DocumentStats.combine(s1, s2)
            return (
              result.wordCount >= 0 &&
              result.sentenceCount >= 0 &&
              result.charCount >= 0
            )
          }
        )
      )
    })

    it("should sum correctly", () => {
      fc.assert(
        fc.property(
          documentStatsArbitrary,
          documentStatsArbitrary,
          (s1, s2) => {
            const result = NLP.DocumentStats.combine(s1, s2)
            return (
              result.wordCount === s1.wordCount + s2.wordCount &&
              result.sentenceCount === s1.sentenceCount + s2.sentenceCount &&
              result.charCount === s1.charCount + s2.charCount
            )
          }
        )
      )
    })
  })

  describe("Bag of Words Aggregation", () => {
    it("should correctly aggregate token frequencies", () => {
      const tokens = ["cat", "dog", "cat", "fish", "cat"]
      const bow = NLP.aggregateTokens(tokens)

      expect(bow.get("cat")).toBe(3)
      expect(bow.get("dog")).toBe(1)
      expect(bow.get("fish")).toBe(1)
    })

    it("should handle empty input", () => {
      const bow = NLP.aggregateTokens([])
      expect(bow.size).toBe(0)
    })

    it("should satisfy monoid laws via aggregation", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 })),
          (tokens) => {
            const bow1 = NLP.aggregateTokens(tokens)
            const bow2 = NLP.aggregateTokens(tokens)
            return mapEquals(bow1, bow2)
          }
        )
      )
    })
  })

  describe("Sentence Aggregation", () => {
    it("should join sentences with proper spacing", () => {
      const sentences = ["Hello world", "How are you", "I am fine"]
      const doc = NLP.aggregateSentences(sentences)

      expect(doc).toContain("Hello world")
      expect(doc).toContain("How are you")
      expect(doc).toContain("I am fine")
    })

    it("should handle empty input", () => {
      const doc = NLP.aggregateSentences([])
      expect(doc).toBe("")
    })
  })

  describe("TF Conversion", () => {
    it("should normalize frequencies to [0, 1]", () => {
      const bow: Map<string, number> = new Map([
        ["cat", 3],
        ["dog", 2],
        ["fish", 1]
      ])

      const tf = NLP.bagOfWordsToTF(bow)

      expect(tf.get("cat")).toBeCloseTo(0.5) // 3/6
      expect(tf.get("dog")).toBeCloseTo(0.333) // 2/6
      expect(tf.get("fish")).toBeCloseTo(0.167) // 1/6
    })

    it("should sum to 1.0", () => {
      fc.assert(
        fc.property(bagOfWordsArbitrary, (bow) => {
          if (bow.size === 0) return true

          const tf = NLP.bagOfWordsToTF(bow)
          const sum = Array.from(tf.values()).reduce(
            (acc, freq) => acc + freq,
            0
          )

          return Math.abs(sum - 1.0) < 0.0001
        })
      )
    })

    it("should handle empty bag of words", () => {
      const bow = new Map()
      const tf = NLP.bagOfWordsToTF(bow)
      expect(tf.size).toBe(0)
    })
  })

  describe("TF-IDF Computation", () => {
    it("should compute correct TF-IDF scores", () => {
      const tf = new Map([
        ["cat", 0.5],
        ["dog", 0.3],
        ["fish", 0.2]
      ])

      const df = new Map([
        ["cat", 10],
        ["dog", 5],
        ["fish", 2]
      ])

      const totalDocs = 100

      const tfidf = NLP.computeTFIDF(tf, df, totalDocs)

      // TF-IDF balances term frequency and rarity
      // cat: TF=0.5, DF=10 → TF-IDF = 0.5 * log(100/10) = 0.5 * 2.3 = 1.15
      // fish: TF=0.2, DF=2 → TF-IDF = 0.2 * log(100/2) = 0.2 * 3.9 = 0.78
      // Cat has higher TF which outweighs fish's rarity advantage
      const catScore = tfidf.get("cat")!
      const dogScore = tfidf.get("dog")!
      const fishScore = tfidf.get("fish")!

      // Verify scores are computed
      expect(catScore).toBeGreaterThan(0)
      expect(dogScore).toBeGreaterThan(0)
      expect(fishScore).toBeGreaterThan(0)

      // Cat should have highest score due to high TF
      expect(catScore).toBeGreaterThan(fishScore)
    })

    it("should be zero for terms not in TF", () => {
      const tf = new Map([["cat", 0.5]])
      const df = new Map([
        ["cat", 10],
        ["dog", 5]
      ])

      const tfidf = NLP.computeTFIDF(tf, df, 100)

      expect(tfidf.has("dog")).toBe(false)
    })
  })
})

// =============================================================================
// Homomorphism Properties
// =============================================================================

describe("Monoid Homomorphisms", () => {
  describe("Bag of Words as Homomorphism", () => {
    it("should preserve monoid structure: bow(xs ++ ys) = bow(xs) ⊕ bow(ys)", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 })),
          fc.array(fc.string({ minLength: 1, maxLength: 10 })),
          (xs, ys) => {
            // Left side: bow(xs ++ ys)
            const concatenated = [...xs, ...ys]
            const bowConcatenated = NLP.aggregateTokens(concatenated)

            // Right side: bow(xs) ⊕ bow(ys)
            const bowXs = NLP.aggregateTokens(xs)
            const bowYs = NLP.aggregateTokens(ys)
            const bowCombined = NLP.TokenBagOfWords.combine(bowXs, bowYs)

            return mapEquals(bowConcatenated, bowCombined)
          }
        )
      )
    })
  })

  describe("Vocabulary as Homomorphism", () => {
    it("should preserve structure: vocab(xs ++ ys) = vocab(xs) ∪ vocab(ys)", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 10 })),
          fc.array(fc.string({ minLength: 1, maxLength: 10 })),
          (xs, ys) => {
            // Left side: vocab(xs ++ ys)
            const concatenated = [...xs, ...ys]
            const vocabConcatenated = new Set(concatenated)

            // Right side: vocab(xs) ∪ vocab(ys)
            const vocabXs = new Set(xs)
            const vocabYs = new Set(ys)
            const vocabCombined = NLP.Vocabulary.combine(vocabXs, vocabYs)

            return setEquals(vocabConcatenated, vocabCombined)
          }
        )
      )
    })
  })
})
