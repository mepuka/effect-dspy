/**
 * NLPService - Wink NLP wrapper with Effect patterns
 *
 * This module provides a service layer wrapping the Wink NLP library.
 * All operations are wrapped in Effect for composability and error handling.
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import winkNLP from "wink-nlp"
import model from "wink-eng-lite-web-model"

// =============================================================================
// Service Definition
// =============================================================================

/**
 * Wink NLP Document type (simplified)
 */
interface WinkDocument {
  sentences(): WinkCollection
  tokens(): WinkCollection
  out(): string
}

interface WinkCollection {
  out(): string[]
  length(): number
  each(fn: (item: any) => void): void
  itemAt(index: number): any
}

interface WinkNLPInstance {
  readDoc(text: string): WinkDocument
}

/**
 * NLPService provides text processing operations using Wink NLP.
 * This wraps the Wink library in Effect's service pattern for dependency injection.
 */
export interface NLPService {
  /**
   * Split text into sentences using Wink's sentence boundary detection
   */
  readonly sentencize: (text: string) => Effect.Effect<ReadonlyArray<string>>

  /**
   * Split text into tokens (words) using Wink's tokenizer
   */
  readonly tokenize: (text: string) => Effect.Effect<ReadonlyArray<string>>

  /**
   * Split text into paragraphs
   */
  readonly paragraphize: (text: string) => Effect.Effect<ReadonlyArray<string>>

  /**
   * Normalize whitespace
   */
  readonly normalizeWhitespace: (text: string) => Effect.Effect<string>

  /**
   * Count words in text using Wink's token detection
   */
  readonly wordCount: (text: string) => Effect.Effect<number>

  /**
   * Extract n-grams from text
   */
  readonly ngrams: (
    text: string,
    n: number
  ) => Effect.Effect<ReadonlyArray<string>>

  /**
   * Get the underlying Wink NLP instance for advanced operations
   */
  readonly getWink: () => Effect.Effect<WinkNLPInstance>
}

/**
 * Context tag for NLPService
 */
export const NLPService = Context.GenericTag<NLPService>("NLPService")

// =============================================================================
// Implementation using Wink NLP
// =============================================================================

const makeNLPService = Effect.sync(() => {
  // Initialize Wink NLP with the language model
  const nlp = winkNLP(model) as WinkNLPInstance

  const sentencizeImpl = (text: string): ReadonlyArray<string> => {
    if (text.trim() === "") return []
    const doc = nlp.readDoc(text)
    return doc.sentences().out()
  }

  const tokenizeImpl = (text: string): ReadonlyArray<string> => {
    if (text.trim() === "") return []
    const doc = nlp.readDoc(text)
    return doc.tokens().out()
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
    if (text.trim() === "") return 0
    const doc = nlp.readDoc(text)
    return doc.tokens().length()
  }

  const ngramsImpl = (text: string, n: number): ReadonlyArray<string> => {
    if (n < 1) {
      throw new Error("n must be at least 1")
    }

    const tokens = tokenizeImpl(text)
    if (tokens.length < n) return []

    const grams: Array<string> = []
    for (let i = 0; i <= tokens.length - n; i++) {
      const gram = tokens.slice(i, i + n).join(" ")
      grams.push(gram)
    }

    return grams
  }

  return {
    sentencize: (text: string) => Effect.sync(() => sentencizeImpl(text)),
    tokenize: (text: string) => Effect.sync(() => tokenizeImpl(text)),
    paragraphize: (text: string) => Effect.sync(() => paragraphizeImpl(text)),
    normalizeWhitespace: (text: string) => Effect.sync(() => normalizeWhitespaceImpl(text)),
    wordCount: (text: string) => Effect.sync(() => wordCountImpl(text)),
    ngrams: (text: string, n: number) => Effect.sync(() => ngramsImpl(text, n)),
    getWink: () => Effect.succeed(nlp)
  } satisfies NLPService
})

/**
 * Live layer for NLPService that initializes Wink NLP
 */
export const NLPServiceLive: Layer.Layer<NLPService, never, never> = Layer.effect(
  NLPService,
  makeNLPService
)

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sentencize with the live service
 */
export const sentencize = (
  text: string
): Effect.Effect<ReadonlyArray<string>, never, NLPService> =>
  Effect.flatMap(NLPService, (svc) => svc.sentencize(text))

/**
 * Tokenize with the live service
 */
export const tokenize = (
  text: string
): Effect.Effect<ReadonlyArray<string>, never, NLPService> =>
  Effect.flatMap(NLPService, (svc) => svc.tokenize(text))

/**
 * Paragraphize with the live service
 */
export const paragraphize = (
  text: string
): Effect.Effect<ReadonlyArray<string>, never, NLPService> =>
  Effect.flatMap(NLPService, (svc) => svc.paragraphize(text))

/**
 * Normalize whitespace with the live service
 */
export const normalizeWhitespace = (
  text: string
): Effect.Effect<string, never, NLPService> =>
  Effect.flatMap(NLPService, (svc) => svc.normalizeWhitespace(text))

/**
 * Count words with the live service
 */
export const wordCount = (text: string): Effect.Effect<number, never, NLPService> =>
  Effect.flatMap(NLPService, (svc) => svc.wordCount(text))

/**
 * Extract n-grams with the live service
 */
export const ngrams = (
  text: string,
  n: number
): Effect.Effect<ReadonlyArray<string>, never, NLPService> =>
  Effect.flatMap(NLPService, (svc) => svc.ngrams(text, n))

// =============================================================================
// Testing Support
// =============================================================================

/**
 * Mock NLP service for testing
 */
export const makeMockNLPService = (
  overrides: Partial<NLPService>
): Layer.Layer<NLPService> => {
  const defaults: NLPService = {
    sentencize: (text) => Effect.succeed([text]),
    tokenize: (text) => Effect.succeed(text.split(" ")),
    paragraphize: (text) => Effect.succeed([text]),
    normalizeWhitespace: (text) => Effect.succeed(text.trim()),
    wordCount: (text) => Effect.succeed(text.split(" ").length),
    ngrams: (text, n) => Effect.succeed(text.split(" ").slice(0, Math.max(0, n))),
    getWink: () => Effect.succeed({} as WinkNLPInstance)
  }

  return Layer.succeed(NLPService, { ...defaults, ...overrides })
}
