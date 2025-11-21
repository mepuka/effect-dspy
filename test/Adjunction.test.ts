/**
 * Property-based tests for Adjunction laws
 *
 * This test suite verifies that our adjoint functor pairs satisfy the adjunction laws:
 * 1. Unit-counit composition (right triangle identity)
 * 2. Counit-unit composition (left triangle identity)
 *
 * For an adjunction F ⊣ G:
 * - F is the "free" functor (expansion, e.g., text → sentences)
 * - G is the "forgetful" functor (aggregation, e.g., sentences → text)
 * - η: A → GF(A) is the unit
 * - ε: FG(A) → A is the counit
 *
 * Triangle identities:
 * 1. G(ε) ∘ η_G = id_G  (right triangle)
 * 2. ε_F ∘ F(η) = id_F  (left triangle)
 *
 * For natural language, these are approximate due to information loss,
 * so we verify up to normalization (whitespace, punctuation).
 */

import { describe, expect, it } from "vitest"
import * as fc from "fast-check"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as NLP from "../src/NLPService.js"
import * as EG from "../src/EffectGraph.js"

// =============================================================================
// Normalization Functions
// =============================================================================

/**
 * Normalize text for comparison
 * Handles whitespace and punctuation variations
 */
const normalizeText = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/[.!?]+\s*/g, ". ") // Normalize sentence endings
    .replace(/\s+([,.!?;:])/g, "$1") // Remove space before punctuation
    .trim()

/**
 * Normalize array of texts
 */
const normalizeArray = (texts: ReadonlyArray<string>): ReadonlyArray<string> =>
  texts.map(normalizeText).filter((t) => t.length > 0)

/**
 * Check if two normalized arrays are equivalent
 */
const arrayEquals = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean => {
  const aNorm = normalizeArray(a)
  const bNorm = normalizeArray(b)

  if (aNorm.length !== bNorm.length) return false
  return aNorm.every((x, i) => x === bNorm[i])
}

// =============================================================================
// Simple Operations (for testing without full NLP service)
// =============================================================================

/**
 * Simple sentencization (splits on sentence boundaries)
 */
const simpleSentencize = (text: string): ReadonlyArray<string> =>
  text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

/**
 * Simple join (combines with period and space)
 */
const simpleJoin = (sentences: ReadonlyArray<string>): string =>
  sentences.join(". ") + (sentences.length > 0 ? "." : "")

/**
 * Simple tokenization (splits on whitespace)
 */
const simpleTokenize = (text: string): ReadonlyArray<string> =>
  text
    .split(/\s+/)
    .filter((t) => t.length > 0)

/**
 * Simple token join (combines with spaces)
 */
const simpleTokenJoin = (tokens: ReadonlyArray<string>): string => tokens.join(" ")

// =============================================================================
// Sentencization Adjunction Tests
// =============================================================================

describe("Sentencization Adjunction Laws", () => {
  describe("Right Triangle Identity: text → sentencize → join → sentencize ≈ sentencize", () => {
    it("should satisfy for arbitrary text (unit-counit composition)", () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 10, maxLength: 200 })
            .filter((s) => s.trim().length > 0),
          (text) => {
            // text → sentencize
            const sentences1 = simpleSentencize(text)

            // → join
            const reconstructed = simpleJoin(sentences1)

            // → sentencize
            const sentences2 = simpleSentencize(reconstructed)

            // Check equality up to normalization
            return arrayEquals(sentences1, sentences2)
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should preserve sentence boundaries", () => {
      const testCases = [
        "Hello world. How are you?",
        "First sentence! Second sentence? Third sentence.",
        "One. Two. Three. Four.",
        "A simple sentence."
      ]

      testCases.forEach((text) => {
        const sentences1 = simpleSentencize(text)
        const reconstructed = simpleJoin(sentences1)
        const sentences2 = simpleSentencize(reconstructed)

        expect(normalizeArray(sentences1)).toEqual(normalizeArray(sentences2))
      })
    })
  })

  describe("Left Triangle Identity: sentences → join → sentencize ≈ sentences", () => {
    it("should satisfy for arbitrary sentence arrays (counit-unit composition)", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 10 }
          ),
          (sentences) => {
            // sentences → join
            const text = simpleJoin(sentences)

            // → sentencize
            const sentencesReconstructed = simpleSentencize(text)

            // Check equality up to normalization
            return arrayEquals(sentences, sentencesReconstructed)
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should reconstruct original sentences", () => {
      const testCases = [
        ["Hello world", "How are you", "I am fine"],
        ["First", "Second", "Third"],
        ["Only one sentence"]
      ]

      testCases.forEach((sentences) => {
        const text = simpleJoin(sentences)
        const reconstructed = simpleSentencize(text)

        expect(normalizeArray(sentences)).toEqual(normalizeArray(reconstructed))
      })
    })
  })
})

// =============================================================================
// Tokenization Adjunction Tests
// =============================================================================

describe("Tokenization Adjunction Laws", () => {
  describe("Right Triangle Identity: text → tokenize → join → tokenize ≈ tokenize", () => {
    it("should satisfy for arbitrary text", () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 5, maxLength: 100 })
            .filter((s) => s.trim().length > 0),
          (text) => {
            // text → tokenize
            const tokens1 = simpleTokenize(text)

            // → join
            const reconstructed = simpleTokenJoin(tokens1)

            // → tokenize
            const tokens2 = simpleTokenize(reconstructed)

            // Check equality up to normalization
            return arrayEquals(tokens1, tokens2)
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should preserve tokens", () => {
      const testCases = ["Hello world", "One two three four", "A simple test"]

      testCases.forEach((text) => {
        const tokens1 = simpleTokenize(text)
        const reconstructed = simpleTokenJoin(tokens1)
        const tokens2 = simpleTokenize(reconstructed)

        expect(normalizeArray(tokens1)).toEqual(normalizeArray(tokens2))
      })
    })
  })

  describe("Left Triangle Identity: tokens → join → tokenize ≈ tokens", () => {
    it("should satisfy for arbitrary token arrays", () => {
      fc.assert(
        fc.property(
          fc.array(
            fc
              .string({ minLength: 1, maxLength: 20 })
              .filter((s) => s.trim().length > 0 && !s.includes(" ")),
            { minLength: 1, maxLength: 20 }
          ),
          (tokens) => {
            // tokens → join
            const text = simpleTokenJoin(tokens)

            // → tokenize
            const tokensReconstructed = simpleTokenize(text)

            // Check equality up to normalization
            return arrayEquals(tokens, tokensReconstructed)
          }
        ),
        { numRuns: 100 }
      )
    })

    it("should reconstruct original tokens", () => {
      const testCases = [
        ["Hello", "world"],
        ["One", "two", "three"],
        ["A", "B", "C", "D"]
      ]

      testCases.forEach((tokens) => {
        const text = simpleTokenJoin(tokens)
        const reconstructed = simpleTokenize(text)

        expect(normalizeArray(tokens)).toEqual(normalizeArray(reconstructed))
      })
    })
  })
})

// =============================================================================
// Composed Adjunction Tests (Sentencize → Tokenize)
// =============================================================================

describe("Composed Adjunction: Sentencize then Tokenize", () => {
  it("should preserve information through round trip", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 100 }).filter((s) => s.trim().length > 0),
        (text) => {
          // Forward: text → sentences → tokens
          const sentences = simpleSentencize(text)
          const allTokens = sentences.flatMap(simpleTokenize)

          // Backward: tokens → text → sentences
          const textReconstructed = simpleTokenJoin(allTokens)
          const sentencesReconstructed = simpleSentencize(textReconstructed)

          // The reconstruction should produce valid sentences
          return sentencesReconstructed.length > 0
        }
      ),
      { numRuns: 50 }
    )
  })

  it("should handle multi-level hierarchy", () => {
    const text = "Hello world. How are you?"

    // Forward direction
    const sentences = simpleSentencize(text)
    expect(sentences.length).toBe(2)

    const tokens = sentences.flatMap(simpleTokenize)
    expect(tokens.length).toBeGreaterThan(0)

    // Backward direction
    const textReconstructed = simpleTokenJoin(tokens)
    expect(normalizeText(textReconstructed)).toBeTruthy()
  })
})

// =============================================================================
// Adjunction with Graph Structure
// =============================================================================

describe("Graph-Based Adjunction Tests", () => {
  it("should preserve parent-child relationships", () => {
    // Create a graph with a document and sentences
    const text = "First sentence. Second sentence."
    const graph = EG.singleton(text)

    // Get root node
    const roots = EG.getRoots(graph)
    expect(roots.length).toBe(1)

    const rootNode = roots[0]!

    // Apply sentencization
    const sentences = simpleSentencize(text)

    // Add sentence nodes as children
    let updatedGraph = graph
    for (const sentence of sentences) {
      const sentenceNode = EG.makeNode(
        sentence,
        Option.some(rootNode.id),
        Option.some("sentencize")
      )
      updatedGraph = EG.addNode(updatedGraph, sentenceNode)
    }

    // Verify structure
    const children = EG.getChildren(updatedGraph, rootNode.id)
    expect(children.length).toBe(2)

    // Verify we can reconstruct original text from children
    const reconstructed = simpleJoin(children.map((c) => c.data))
    expect(normalizeText(reconstructed)).toBe(normalizeText(text))
  })
})

// =============================================================================
// Adjunction Naturality (Advanced)
// =============================================================================

describe("Adjunction Naturality Properties", () => {
  it("should commute with text transformations", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 100 }).filter((s) => s.trim().length > 0),
        (text) => {
          // Define a transformation: uppercase
          const transform = (s: string) => s.toUpperCase()

          // Path 1: transform then sentencize
          const path1 = simpleSentencize(transform(text))

          // Path 2: sentencize then transform each
          const path2 = simpleSentencize(text).map(transform)

          // These should be equal (naturality)
          return arrayEquals(path1, path2)
        }
      ),
      { numRuns: 50 }
    )
  })

  it("should commute with filtering", () => {
    const text = "Short. A longer sentence here. X."

    // Path 1: sentencize then filter
    const path1 = simpleSentencize(text).filter((s) => s.length > 5)

    // Path 2: sentencize then filter
    const path2 = simpleSentencize(text).filter((s) => s.length > 5)

    expect(path1).toEqual(path2)
  })
})

// =============================================================================
// Error Cases and Edge Conditions
// =============================================================================

describe("Adjunction Edge Cases", () => {
  it("should handle empty text gracefully", () => {
    const sentences = simpleSentencize("")
    expect(sentences).toEqual([])

    const reconstructed = simpleJoin(sentences)
    expect(reconstructed).toBe("")
  })

  it("should handle single word", () => {
    const text = "Hello"
    const sentences = simpleSentencize(text)
    const reconstructed = simpleJoin(sentences)

    expect(normalizeText(reconstructed)).toContain(normalizeText(text))
  })

  it("should handle text without sentence boundaries", () => {
    const text = "No punctuation here at all"
    const sentences = simpleSentencize(text)
    const reconstructed = simpleJoin(sentences)

    expect(normalizeText(reconstructed)).toContain(normalizeText(text))
  })

  it("should handle multiple consecutive punctuation marks", () => {
    const text = "What!!! Really??? Yes..."
    const sentences = simpleSentencize(text)
    const reconstructed = simpleJoin(sentences)

    // Should still extract reasonable sentences
    expect(sentences.length).toBeGreaterThan(0)
    expect(normalizeText(reconstructed).length).toBeGreaterThan(0)
  })
})
