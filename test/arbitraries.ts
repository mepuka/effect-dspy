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
