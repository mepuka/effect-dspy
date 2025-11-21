/**
 * NLPService - Wink NLP wrapper with Effect patterns
 *
 * This module provides a service layer wrapping the Wink NLP library.
 * All operations are wrapped in Effect for composability and error handling.
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import model from "wink-eng-lite-web-model"
import winkNLP from "wink-nlp"
import nlpUtils from "wink-nlp-utils"
// @ts-ignore - wink-distance doesn't have type definitions
import distance from "wink-distance"

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
  out(): Array<string>
  length(): number
  each(fn: (item: any) => void): void
  itemAt(index: number): any
}

interface WinkNLPInstance {
  readDoc(text: string): WinkDocument
}

/**
 * Token with linguistic annotations
 */
export interface AnnotatedToken {
  readonly text: string
  readonly index: number
  readonly isStopWord: boolean
}

/**
 * Bag of words representation (word frequency map)
 */
export type BagOfWords = Map<string, number>

/**
 * NLPService provides text processing operations using Wink NLP.
 * This wraps the Wink library in Effect's service pattern for dependency injection.
 *
 * Operations are designed to be:
 * - Pure (referentially transparent)
 * - Composable (can be chained via Effect)
 * - Type-safe (compile-time guarantees)
 * - Mathematically sound (satisfy algebraic laws)
 */
export interface NLPService {
  /**
   * Split text into sentences using Wink's sentence boundary detection
   * Forms a Free functor in the text → sentences adjunction
   */
  readonly sentencize: (text: string) => Effect.Effect<ReadonlyArray<string>>

  /**
   * Split text into tokens (words) using Wink's tokenizer
   * Forms a Free functor in the text → tokens adjunction
   */
  readonly tokenize: (text: string) => Effect.Effect<ReadonlyArray<string>>

  /**
   * Tokenize with annotations (stop words, index, etc.)
   * Returns structured token information for downstream analysis
   */
  readonly tokenizeAnnotated: (
    text: string
  ) => Effect.Effect<ReadonlyArray<AnnotatedToken>>

  /**
   * Split text into paragraphs
   */
  readonly paragraphize: (text: string) => Effect.Effect<ReadonlyArray<string>>

  /**
   * Normalize whitespace using Wink's utilities
   * This is an idempotent operation: normalize ∘ normalize = normalize
   */
  readonly normalizeWhitespace: (text: string) => Effect.Effect<string>

  /**
   * Remove punctuation from text
   * Idempotent operation
   */
  readonly removePunctuation: (text: string) => Effect.Effect<string>

  /**
   * Remove extra spaces (normalize to single spaces)
   * Idempotent operation
   */
  readonly removeExtraSpaces: (text: string) => Effect.Effect<string>

  /**
   * Stem tokens using Porter stemmer
   * Note: Stemming is NOT reversible (forgetful functor)
   */
  readonly stem: (
    tokens: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<string>>

  /**
   * Remove stop words from tokens
   * This is a filtering operation (subset functor)
   */
  readonly removeStopWords: (
    tokens: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<string>>

  /**
   * Count words in text using Wink's token detection
   */
  readonly wordCount: (text: string) => Effect.Effect<number>

  /**
   * Extract n-grams from text
   * Forms a Free functor generating n-grams
   */
  readonly ngrams: (
    text: string,
    n: number
  ) => Effect.Effect<ReadonlyArray<string>>

  /**
   * Create bag-of-words representation
   * This is a Monoid homomorphism from [String] to Map<String, Number>
   */
  readonly bagOfWords: (
    tokens: ReadonlyArray<string>
  ) => Effect.Effect<BagOfWords>

  /**
   * Compute string similarity (Jaro-Winkler distance)
   * Returns value in [0, 1] where 1 is identical
   * Forms a metric space
   */
  readonly stringSimilarity: (s1: string, s2: string) => Effect.Effect<number>

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

  // New implementations using wink-nlp-utils and wink-distance

  /**
   * Helper to check if a token is a stop word
   * Uses removeWords to check - if the token is filtered out, it's a stop word
   */
  const isStopWord = (token: string): boolean => {
    const filtered = nlpUtils.tokens.removeWords([token])
    return filtered.length === 0
  }

  const tokenizeAnnotatedImpl = (text: string): ReadonlyArray<AnnotatedToken> => {
    const tokens = tokenizeImpl(text)
    return tokens.map((token, index) => ({
      text: token,
      index,
      isStopWord: isStopWord(token.toLowerCase())
    }))
  }

  const removePunctuationImpl = (text: string): string =>
    nlpUtils.string.removePunctuations(text)

  const removeExtraSpacesImpl = (text: string): string =>
    nlpUtils.string.removeExtraSpaces(text)

  const stemImpl = (tokens: ReadonlyArray<string>): ReadonlyArray<string> =>
    tokens.map((token) => nlpUtils.string.stem(token))

  const removeStopWordsImpl = (
    tokens: ReadonlyArray<string>
  ): ReadonlyArray<string> =>
    nlpUtils.tokens.removeWords(tokens as any) as ReadonlyArray<string>

  const bagOfWordsImpl = (
    tokens: ReadonlyArray<string>
  ): BagOfWords => {
    const bow = nlpUtils.tokens.bagOfWords(tokens as any)
    // Convert plain object to Map
    return new Map(Object.entries(bow))
  }

  const stringSimilarityImpl = (s1: string, s2: string): number => {
    // wink-distance returns distance (0 = identical, higher = more different)
    // Convert to similarity (1 = identical, 0 = completely different)
    const dist = distance.string.jaro(s1, s2)
    return 1 - dist
  }

  return {
    sentencize: (text: string) => Effect.sync(() => sentencizeImpl(text)),
    tokenize: (text: string) => Effect.sync(() => tokenizeImpl(text)),
    tokenizeAnnotated: (text: string) =>
      Effect.sync(() => tokenizeAnnotatedImpl(text)),
    paragraphize: (text: string) => Effect.sync(() => paragraphizeImpl(text)),
    normalizeWhitespace: (text: string) =>
      Effect.sync(() => normalizeWhitespaceImpl(text)),
    removePunctuation: (text: string) =>
      Effect.sync(() => removePunctuationImpl(text)),
    removeExtraSpaces: (text: string) =>
      Effect.sync(() => removeExtraSpacesImpl(text)),
    stem: (tokens: ReadonlyArray<string>) => Effect.sync(() => stemImpl(tokens)),
    removeStopWords: (tokens: ReadonlyArray<string>) =>
      Effect.sync(() => removeStopWordsImpl(tokens)),
    wordCount: (text: string) => Effect.sync(() => wordCountImpl(text)),
    ngrams: (text: string, n: number) => Effect.sync(() => ngramsImpl(text, n)),
    bagOfWords: (tokens: ReadonlyArray<string>) =>
      Effect.sync(() => bagOfWordsImpl(tokens)),
    stringSimilarity: (s1: string, s2: string) =>
      Effect.sync(() => stringSimilarityImpl(s1, s2)),
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
): Effect.Effect<ReadonlyArray<string>, never, NLPService> => Effect.flatMap(NLPService, (svc) => svc.sentencize(text))

/**
 * Tokenize with the live service
 */
export const tokenize = (
  text: string
): Effect.Effect<ReadonlyArray<string>, never, NLPService> => Effect.flatMap(NLPService, (svc) => svc.tokenize(text))

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
): Effect.Effect<string, never, NLPService> => Effect.flatMap(NLPService, (svc) => svc.normalizeWhitespace(text))

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
): Effect.Effect<ReadonlyArray<string>, never, NLPService> => Effect.flatMap(NLPService, (svc) => svc.ngrams(text, n))

/**
 * Tokenize with annotations
 */
export const tokenizeAnnotated = (
  text: string
): Effect.Effect<ReadonlyArray<AnnotatedToken>, never, NLPService> =>
  Effect.flatMap(NLPService, (svc) => svc.tokenizeAnnotated(text))

/**
 * Remove punctuation
 */
export const removePunctuation = (text: string): Effect.Effect<string, never, NLPService> =>
  Effect.flatMap(NLPService, (svc) => svc.removePunctuation(text))

/**
 * Remove extra spaces
 */
export const removeExtraSpaces = (text: string): Effect.Effect<string, never, NLPService> =>
  Effect.flatMap(NLPService, (svc) => svc.removeExtraSpaces(text))

/**
 * Stem tokens
 */
export const stem = (
  tokens: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<string>, never, NLPService> => Effect.flatMap(NLPService, (svc) => svc.stem(tokens))

/**
 * Remove stop words
 */
export const removeStopWords = (
  tokens: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<string>, never, NLPService> =>
  Effect.flatMap(NLPService, (svc) => svc.removeStopWords(tokens))

/**
 * Create bag of words
 */
export const bagOfWords = (
  tokens: ReadonlyArray<string>
): Effect.Effect<BagOfWords, never, NLPService> => Effect.flatMap(NLPService, (svc) => svc.bagOfWords(tokens))

/**
 * Compute string similarity
 */
export const stringSimilarity = (
  s1: string,
  s2: string
): Effect.Effect<number, never, NLPService> => Effect.flatMap(NLPService, (svc) => svc.stringSimilarity(s1, s2))

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
    tokenizeAnnotated: (text) =>
      Effect.succeed(
        text.split(" ").map((token, index) => ({
          text: token,
          index,
          isStopWord: false
        }))
      ),
    paragraphize: (text) => Effect.succeed([text]),
    normalizeWhitespace: (text) => Effect.succeed(text.trim()),
    removePunctuation: (text) => Effect.succeed(text.replace(/[^\w\s]/g, "")),
    removeExtraSpaces: (text) => Effect.succeed(text.replace(/\s+/g, " ").trim()),
    stem: (tokens) => Effect.succeed(tokens),
    removeStopWords: (tokens) => Effect.succeed(tokens),
    wordCount: (text) => Effect.succeed(text.split(" ").length),
    ngrams: (text, n) => Effect.succeed(text.split(" ").slice(0, Math.max(0, n))),
    bagOfWords: (tokens) => {
      const bow = new Map<string, number>()
      tokens.forEach((token) => {
        bow.set(token, (bow.get(token) || 0) + 1)
      })
      return Effect.succeed(bow)
    },
    stringSimilarity: (s1, s2) => Effect.succeed(s1 === s2 ? 1.0 : 0.0),
    getWink: () => Effect.succeed({} as WinkNLPInstance)
  }

  return Layer.succeed(NLPService, { ...defaults, ...overrides })
}
