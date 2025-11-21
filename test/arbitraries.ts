/**
 * Reusable Fast-Check Arbitraries
 *
 * This module provides reusable arbitraries for property-based testing
 * across the test suite. These can be composed and customized as needed.
 */

import * as fc from "fast-check"

// =============================================================================
// Text Arbitraries
// =============================================================================

/**
 * Arbitrary for non-empty text strings
 * Useful for testing text operations that require content
 */
export const nonEmptyText = (options?: { minLength?: number; maxLength?: number }) =>
  fc
    .string({
      minLength: options?.minLength ?? 10,
      maxLength: options?.maxLength ?? 200
    })
    .filter((s) => s.trim().length > 0)

/**
 * Arbitrary for text with sentence boundaries
 * Generates text that may contain sentence-ending punctuation
 */
export const textWithSentences = (options?: { minLength?: number; maxLength?: number }) =>
  fc
    .string({
      minLength: options?.minLength ?? 10,
      maxLength: options?.maxLength ?? 200
    })
    .filter((s) => s.trim().length > 0)

/**
 * Arbitrary for short text (for tokenization tests)
 */
export const shortText = (options?: { minLength?: number; maxLength?: number }) =>
  fc
    .string({
      minLength: options?.minLength ?? 5,
      maxLength: options?.maxLength ?? 100
    })
    .filter((s) => s.trim().length > 0)

// =============================================================================
// Array Arbitraries
// =============================================================================

/**
 * Arbitrary for arrays of sentences
 * Each sentence is a non-empty string
 */
export const sentenceArray = (options?: {
  minLength?: number
  maxLength?: number
  sentenceMinLength?: number
  sentenceMaxLength?: number
}) =>
  fc.array(
    fc
      .string({
        minLength: options?.sentenceMinLength ?? 5,
        maxLength: options?.sentenceMaxLength ?? 50
      })
      // We exclude sentence-ending punctuation to keep simpleSentencize ∘ simpleJoin round-trippable
      .filter((s) => {
        const trimmed = s.trim()
        return trimmed.length > 0 && /[A-Za-z0-9]/.test(trimmed) && !/[.!?]/.test(trimmed)
      }),
    {
      minLength: options?.minLength ?? 1,
      maxLength: options?.maxLength ?? 10
    }
  )

/**
 * Arbitrary for arrays of tokens
 * Each token is a non-empty string without spaces
 */
export const tokenArray = (options?: {
  minLength?: number
  maxLength?: number
  tokenMinLength?: number
  tokenMaxLength?: number
}) =>
  fc.array(
    fc
      .string({
        minLength: options?.tokenMinLength ?? 1,
        maxLength: options?.tokenMaxLength ?? 20
      })
      .filter((s) => s.trim().length > 0 && !s.includes(" ")),
    {
      minLength: options?.minLength ?? 1,
      maxLength: options?.maxLength ?? 20
    }
  )

// =============================================================================
// Graph Arbitraries
// =============================================================================

/**
 * Arbitrary for graph node IDs
 * Uses UUID-like strings for node identification
 */
export const nodeId = () => fc.uuidV(4)

/**
 * Arbitrary for operation names
 * Common text processing operations
 */
export const operationName = () => fc.constantFrom("sentencize", "tokenize", "chunk", "parse", "extract")

// =============================================================================
// Composite Arbitraries
// =============================================================================

/**
 * Arbitrary for text transformation pairs
 * Useful for testing round-trip operations
 */
export const textTransformationPair = () => fc.tuple(nonEmptyText(), operationName())

/**
 * Arbitrary for hierarchical text structures
 * Represents text that can be decomposed into sentences and tokens
 */
export const hierarchicalText = () =>
  sentenceArray({ minLength: 1, maxLength: 5 }).map((sentences) =>
    sentences.join(". ") + (sentences.length > 0 ? "." : "")
  )

// =============================================================================
// Linguistic Structure Arbitraries
// =============================================================================

/**
 * Arbitrary for annotated tokens (with stop word annotation)
 */
export const annotatedToken = () =>
  fc.record({
    text: fc.string({ minLength: 1, maxLength: 20 }),
    index: fc.nat(100),
    isStopWord: fc.boolean()
  })

/**
 * Arbitrary for bag of words (word frequency maps)
 */
export const bagOfWords = () =>
  fc
    .array(fc.tuple(fc.string({ minLength: 1, maxLength: 15 }), fc.nat(50)), {
      maxLength: 30
    })
    .map((entries) => new Map(entries))

/**
 * Arbitrary for named entities
 */
export const namedEntity = () =>
  fc.record({
    text: fc.string({ minLength: 2, maxLength: 30 }),
    type: fc.constantFrom("PER", "ORG", "LOC", "MISC", "DATE", "MONEY"),
    startPos: fc.nat(200),
    endPos: fc.nat(200)
  })

/**
 * Arbitrary for dependency parse edges
 */
export const dependencyEdge = () =>
  fc.record({
    head: fc.nat(50),
    dependent: fc.nat(50),
    relation: fc.constantFrom(
      "nsubj",
      "dobj",
      "iobj",
      "det",
      "amod",
      "advmod",
      "prep",
      "pobj",
      "aux",
      "cop"
    )
  })

/**
 * Arbitrary for document statistics
 */
export const documentStats = () =>
  fc.record({
    wordCount: fc.nat(10000),
    sentenceCount: fc.nat(500),
    charCount: fc.nat(50000)
  })

/**
 * Arbitrary for text analysis results
 */
export const textAnalysis = () =>
  fc.record({
    bow: bagOfWords(),
    entities: fc.array(namedEntity(), { maxLength: 20 }),
    sentenceCount: fc.nat(100),
    vocabulary: fc
      .array(fc.string({ minLength: 1, maxLength: 15 }), { maxLength: 100 })
      .map((arr) => new Set(arr))
  })

/**
 * Arbitrary for weighted tokens (for TF-IDF, importance scores)
 */
export const weightedTokens = () =>
  fc
    .array(
      fc.tuple(fc.string({ minLength: 1, maxLength: 15 }), fc.double({ min: 0, max: 1 })),
      { maxLength: 30 }
    )
    .map((entries) => new Map(entries))

/**
 * Arbitrary for n-grams (as strings)
 */
export const ngram = (n: number) =>
  fc
    .array(fc.string({ minLength: 1, maxLength: 10 }), {
      minLength: n,
      maxLength: n
    })
    .map((tokens) => tokens.join(" "))

/**
 * Arbitrary for n-gram frequency maps
 */
export const ngramFrequency = (n: number) =>
  fc
    .array(fc.tuple(ngram(n), fc.nat(20)), { maxLength: 50 })
    .map((entries) => new Map(entries))

/**
 * Arbitrary for POS tags
 */
export const posTag = () =>
  fc.constantFrom(
    "NOUN",
    "VERB",
    "ADJ",
    "ADV",
    "PRON",
    "DET",
    "ADP",
    "NUM",
    "CONJ",
    "PRT",
    ".",
    "X"
  )

/**
 * Arbitrary for POS-tagged tokens
 */
export const posTaggedToken = () =>
  fc.tuple(fc.string({ minLength: 1, maxLength: 15 }), posTag())

/**
 * Arbitrary for POS-tagged sentences
 */
export const posTaggedSentence = () =>
  fc.array(posTaggedToken(), { minLength: 3, maxLength: 20 })

// =============================================================================
// Real-World NLP Data Arbitraries
// =============================================================================

/**
 * Arbitrary for realistic English words
 * Generates words with typical English phonotactics
 */
export const englishWord = () =>
  fc.stringMatching(/^[a-z]{2,12}$/).filter((s) => {
    // Simple heuristic: avoid too many consecutive consonants or vowels
    const vowels = (s.match(/[aeiou]/g) || []).length
    const consonants = s.length - vowels
    return vowels >= 1 && consonants >= 1
  })

/**
 * Arbitrary for realistic English sentences
 * Generates sentences with proper capitalization and punctuation
 */
export const englishSentence = () =>
  fc
    .array(englishWord(), { minLength: 3, maxLength: 15 })
    .map((words) => {
      if (words.length === 0) return ""
      const capitalized = words[0]!.charAt(0).toUpperCase() + words[0]!.slice(1)
      return [capitalized, ...words.slice(1)].join(" ") + "."
    })

/**
 * Arbitrary for realistic English documents
 */
export const englishDocument = () =>
  fc
    .array(englishSentence(), { minLength: 1, maxLength: 10 })
    .map((sentences) => sentences.join(" "))
