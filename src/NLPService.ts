/**
 * NLPService - Pure Effect-based text processing operations
 *
 * This module provides a service layer for natural language processing operations.
 * All operations are wrapped in Effect for:
 * - Referential transparency
 * - Error handling
 * - Composability
 * - Dependency injection
 *
 * The service forms a monad, allowing operations to be chained while
 * maintaining purity and explicit effect tracking.
 */

import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"

// =============================================================================
// Service Definition
// =============================================================================

/**
 * NLPService provides pure text processing operations
 * This is a service in the Effect sense - it can be injected and mocked for testing
 */
export interface NLPService {
  /**
   * Split text into sentences
   * Handles common sentence boundaries: . ! ?
   * Preserves sentence terminators
   */
  readonly sentencize: (text: string) => Effect.Effect<ReadonlyArray<string>>

  /**
   * Split text into tokens (words)
   * Handles common word boundaries and punctuation
   */
  readonly tokenize: (text: string) => Effect.Effect<ReadonlyArray<string>>

  /**
   * Split text into paragraphs
   * Uses double newline as paragraph boundary
   */
  readonly paragraphize: (
    text: string
  ) => Effect.Effect<ReadonlyArray<string>>

  /**
   * Normalize whitespace
   * Collapses multiple spaces, trims, removes zero-width characters
   */
  readonly normalizeWhitespace: (text: string) => Effect.Effect<string>

  /**
   * Count words in text
   */
  readonly wordCount: (text: string) => Effect.Effect<number>

  /**
   * Extract n-grams from text
   */
  readonly ngrams: (
    text: string,
    n: number
  ) => Effect.Effect<ReadonlyArray<string>>
}

/**
 * Context tag for NLPService
 * This allows the service to be provided via Effect's dependency injection
 */
export const NLPService = Context.GenericTag<NLPService>("NLPService")

// =============================================================================
// Implementation
// =============================================================================

/**
 * Live implementation of NLPService
 * Uses pure functions and regex-based processing
 *
 * Note: In production, this could wrap sophisticated NLP libraries
 * like compromise, natural, or wink-nlp while maintaining the pure interface
 */

const sentencizeImpl = (text: string): ReadonlyArray<string> => {
  if (text.trim() === "") return []

  // Split on sentence boundaries while preserving the delimiter
  // Handles: . ! ? with optional quotes/parens
  const sentenceRegex =
    /(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?]["')\]])\s+(?=[A-Z])|(?<=[.!?])\s*$/g

  const sentences = text
    .split(sentenceRegex)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  // If no sentence boundaries found, return the whole text
  return sentences.length > 0 ? sentences : [text.trim()]
}

const tokenizeImpl = (text: string): ReadonlyArray<string> => {
  if (text.trim() === "") return []

  // Split on whitespace and punctuation boundaries
  // Keeps words, numbers, and common contractions together
  const tokens = text
    .trim()
    // Add spaces around punctuation
    .replace(/([^\w\s']|_)/g, " $1 ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    // Split on spaces
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  return tokens
}

const paragraphizeImpl = (text: string): ReadonlyArray<string> => {
  if (text.trim() === "") return []

  // Split on double newline (paragraph boundary)
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  return paragraphs.length > 0 ? paragraphs : [text.trim()]
}

const normalizeWhitespaceImpl = (text: string): string =>
  text
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Collapse multiple spaces
    .replace(/\s+/g, " ")
    // Trim
    .trim()

const wordCountImpl = (text: string): number => {
  const tokens = tokenizeImpl(text)
  return tokens.filter((t) => /\w/.test(t)).length
}

const ngramsImpl = (text: string, n: number): ReadonlyArray<string> => {
  if (n < 1) {
    throw new Error("n must be at least 1")
  }

  const tokens = tokenizeImpl(text)

  if (tokens.length < n) return []

  const grams: string[] = []
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n).join(" ")
    grams.push(gram)
  }

  return grams
}

export const NLPServiceLive: Layer.Layer<NLPService, never, never> = Layer.succeed(
  NLPService,
  NLPService.of({
    sentencize: (text: string) => Effect.sync(() => sentencizeImpl(text)),
    tokenize: (text: string) => Effect.sync(() => tokenizeImpl(text)),
    paragraphize: (text: string) => Effect.sync(() => paragraphizeImpl(text)),
    normalizeWhitespace: (text: string) =>
      Effect.sync(() => normalizeWhitespaceImpl(text)),
    wordCount: (text: string) => Effect.sync(() => wordCountImpl(text)),
    ngrams: (text: string, n: number) => Effect.sync(() => ngramsImpl(text, n))
  })
)

// =============================================================================
// Helper Functions for Service Operations
// =============================================================================

/**
 * Execute a service operation with the live implementation
 * Convenience wrapper for common use case
 */
export const runNLP = <A, E>(
  operation: Effect.Effect<A, E, NLPService>
): Effect.Effect<A, E, never> =>
  Effect.provide(operation, NLPServiceLive)

/**
 * Sentencize with the live service
 */
export const sentencize = (text: string): Effect.Effect<ReadonlyArray<string>> =>
  runNLP(Effect.flatMap(NLPService, svc => svc.sentencize(text)))

/**
 * Tokenize with the live service
 */
export const tokenize = (text: string): Effect.Effect<ReadonlyArray<string>> =>
  runNLP(Effect.flatMap(NLPService, svc => svc.tokenize(text)))

/**
 * Paragraphize with the live service
 */
export const paragraphize = (
  text: string
): Effect.Effect<ReadonlyArray<string>> =>
  runNLP(Effect.flatMap(NLPService, svc => svc.paragraphize(text)))

/**
 * Normalize whitespace with the live service
 */
export const normalizeWhitespace = (text: string): Effect.Effect<string> =>
  runNLP(Effect.flatMap(NLPService, svc => svc.normalizeWhitespace(text)))

/**
 * Count words with the live service
 */
export const wordCount = (text: string): Effect.Effect<number> =>
  runNLP(Effect.flatMap(NLPService, svc => svc.wordCount(text)))

/**
 * Extract n-grams with the live service
 */
export const ngrams = (
  text: string,
  n: number
): Effect.Effect<ReadonlyArray<string>> =>
  runNLP(Effect.flatMap(NLPService, svc => svc.ngrams(text, n)))

// =============================================================================
// Testing Support
// =============================================================================

/**
 * Mock NLP service for testing
 * Allows tests to inject deterministic behavior
 */
export const makeMockNLPService = (
  overrides: Partial<NLPService>
): Layer.Layer<NLPService> => {
  const defaults: NLPService = {
    sentencize: text => Effect.succeed([text]),
    tokenize: text => Effect.succeed(text.split(" ")),
    paragraphize: text => Effect.succeed([text]),
    normalizeWhitespace: text => Effect.succeed(text.trim()),
    wordCount: text => Effect.succeed(text.split(" ").length),
    ngrams: (text, n) =>
      Effect.succeed(text.split(" ").slice(0, Math.max(0, n)))
  }

  return Layer.succeed(NLPService, NLPService.of({ ...defaults, ...overrides }))
}
