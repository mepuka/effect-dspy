/**
 * Pipeline - Composable NLP pipeline builders using Effect
 *
 * This module demonstrates how to build complex, type-safe NLP pipelines
 * using Effect's monadic operations and our NLP algebra.
 *
 * Pipelines are:
 * - Composable: Chain operations using functorial and monadic combinators
 * - Type-safe: The compiler enforces correct data flow
 * - Pure: All effects are explicit in the type system
 * - Testable: Easy to mock services and test components independently
 *
 * Mathematical foundation:
 * - Pipelines form a Category with composition as morphisms
 * - Operations form Monoids allowing parallel and sequential composition
 * - Effect provides the monadic structure for chaining transformations
 */

import * as Effect from "effect/Effect"
import * as Array from "effect/Array"
import { NLPService, type BagOfWords } from "./NLPService.js"
import * as M from "./Algebra/Monoid.js"
import * as NLPMonoid from "./Algebra/NLPMonoid.js"

// =============================================================================
// Pipeline Result Types
// =============================================================================

/**
 * Result of a basic text processing pipeline
 */
export interface BasicPipelineResult {
  readonly normalized: string
  readonly sentences: ReadonlyArray<string>
  readonly tokens: ReadonlyArray<string>
}

/**
 * Result of an advanced NLP pipeline
 */
export interface AdvancedPipelineResult {
  readonly normalized: string
  readonly cleaned: string
  readonly tokens: ReadonlyArray<string>
  readonly stemmed: ReadonlyArray<string>
  readonly filtered: ReadonlyArray<string>
  readonly bow: BagOfWords
  readonly stats: NLPMonoid.DocumentStatistics
}

/**
 * Result of a corpus-level analysis pipeline
 */
export interface CorpusAnalysisResult {
  readonly documentCount: number
  readonly totalWordCount: number
  readonly vocabulary: Set<string>
  readonly termFrequency: BagOfWords
  readonly documentFrequency: Map<string, number>
  readonly topTerms: ReadonlyArray<[string, number]>
}

// =============================================================================
// Basic Pipeline Builders
// =============================================================================

/**
 * Basic text processing pipeline
 *
 * Flow: text → normalize → sentencize → tokenize
 *
 * This pipeline demonstrates sequential Effect composition.
 *
 * Example:
 *   const result = await Effect.runPromise(
 *     basicPipeline("Hello world. How are you?").pipe(
 *       Effect.provide(NLPServiceLive)
 *     )
 *   )
 */
export const basicPipeline = (
  text: string
): Effect.Effect<BasicPipelineResult, never, NLPService> =>
  Effect.gen(function*() {
    const nlp = yield* NLPService

    // Step 1: Normalize whitespace (idempotent operation)
    const normalized = yield* nlp.normalizeWhitespace(text)

    // Step 2: Sentencize (Free functor - expansion)
    const sentences = yield* nlp.sentencize(normalized)

    // Step 3: Tokenize (Free functor - expansion)
    const tokens = yield* nlp.tokenize(normalized)

    return {
      normalized,
      sentences,
      tokens
    }
  })

/**
 * Advanced NLP pipeline with preprocessing and feature extraction
 *
 * Flow:
 *   text
 *   → normalize
 *   → remove punctuation
 *   → tokenize
 *   → remove stop words
 *   → stem
 *   → bag of words
 *   → compute statistics
 *
 * This demonstrates a full preprocessing pipeline for ML/NLP tasks.
 */
export const advancedPipeline = (
  text: string
): Effect.Effect<AdvancedPipelineResult, never, NLPService> =>
  Effect.gen(function*() {
    const nlp = yield* NLPService

    // Preprocessing phase
    const normalized = yield* nlp.normalizeWhitespace(text)
    const cleaned = yield* nlp.removePunctuation(normalized)

    // Tokenization phase
    const tokens = yield* nlp.tokenize(cleaned)

    // Filtering phase (removes stop words)
    const filtered = yield* nlp.removeStopWords(tokens)

    // Stemming phase (reduces tokens to roots)
    const stemmed = yield* nlp.stem(filtered)

    // Feature extraction phase
    const bow = yield* nlp.bagOfWords(stemmed)

    // Statistics computation
    const wordCount = stemmed.length
    const sentenceCount = (yield* nlp.sentencize(normalized)).length
    const charCount = normalized.length

    const stats: NLPMonoid.DocumentStatistics = {
      wordCount,
      sentenceCount,
      charCount
    }

    return {
      normalized,
      cleaned,
      tokens,
      stemmed,
      filtered,
      bow,
      stats
    }
  })

// =============================================================================
// Parallel Pipeline Builders (using Effect.all)
// =============================================================================

/**
 * Parallel feature extraction pipeline
 *
 * Executes multiple independent analyses in parallel using Effect.all.
 * This is more efficient than sequential execution when operations are independent.
 *
 * Demonstrates Effect's concurrent execution model.
 */
export const parallelFeaturePipeline = (
  text: string
): Effect.Effect<
  {
    readonly tokens: ReadonlyArray<string>
    readonly bigrams: ReadonlyArray<string>
    readonly trigrams: ReadonlyArray<string>
    readonly bow: BagOfWords
  },
  never,
  NLPService
> =>
  Effect.gen(function*() {
    const nlp = yield* NLPService

    // Normalize once
    const normalized = yield* nlp.normalizeWhitespace(text)

    // Execute all feature extractions in parallel
    const [tokens, bigrams, trigrams, bow] = yield* Effect.all([
      nlp.tokenize(normalized),
      nlp.ngrams(normalized, 2),
      nlp.ngrams(normalized, 3),
      Effect.flatMap(nlp.tokenize(normalized), (toks) => nlp.bagOfWords(toks))
    ])

    return {
      tokens,
      bigrams,
      trigrams,
      bow
    }
  })

// =============================================================================
// Corpus-Level Pipeline Builders
// =============================================================================

/**
 * Process multiple documents in a corpus
 *
 * This pipeline demonstrates:
 * 1. Parallel processing of documents
 * 2. Aggregation using monoids
 * 3. Corpus-level statistics (vocabulary, TF, DF)
 *
 * The use of monoids ensures mathematically sound aggregation.
 */
export const corpusPipeline = (
  documents: ReadonlyArray<string>
): Effect.Effect<CorpusAnalysisResult, never, NLPService> =>
  Effect.gen(function*() {
    const nlp = yield* NLPService

    // Process each document in parallel
    const docResults = yield* Effect.all(
      documents.map((doc) =>
        Effect.gen(function*() {
          // Preprocess
          const normalized = yield* nlp.normalizeWhitespace(doc)
          const cleaned = yield* nlp.removePunctuation(normalized)

          // Tokenize
          const tokens = yield* nlp.tokenize(cleaned)

          // Filter and stem
          const filtered = yield* nlp.removeStopWords(tokens)
          const stemmed = yield* nlp.stem(filtered)

          // Compute BOW
          const bow = yield* nlp.bagOfWords(stemmed)

          return {
            tokens: stemmed,
            bow,
            vocabulary: new Set(stemmed)
          }
        })
      )
    )

    // Aggregate results using monoids
    const vocabulary = M.fold(NLPMonoid.Vocabulary)(
      docResults.map((r) => r.vocabulary)
    )

    const termFrequency = M.fold(NLPMonoid.TermFrequency)(
      docResults.map((r) => r.bow)
    )

    // Compute document frequency (how many docs contain each term)
    const documentFrequency = new Map<string, number>()
    for (const result of docResults) {
      const uniqueTerms = new Set(result.tokens)
      uniqueTerms.forEach((term) => {
        documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1)
      })
    }

    // Get top terms by frequency
    const topTerms = Array.fromIterable(termFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)

    // Total word count across all documents
    const totalWordCount = docResults.reduce(
      (sum, r) => sum + r.tokens.length,
      0
    )

    return {
      documentCount: documents.length,
      totalWordCount,
      vocabulary,
      termFrequency,
      documentFrequency,
      topTerms
    }
  })

// =============================================================================
// TF-IDF Pipeline
// =============================================================================

/**
 * TF-IDF vectorization pipeline
 *
 * Computes TF-IDF vectors for a corpus of documents.
 * This is a common preprocessing step for document classification and retrieval.
 *
 * Mathematical foundation:
 * - TF-IDF is a monoid homomorphism from documents to weighted vectors
 * - Preserves information about term importance across the corpus
 */
export const tfidfPipeline = (
  documents: ReadonlyArray<string>
): Effect.Effect<
  ReadonlyArray<Map<string, number>>,
  never,
  NLPService
> =>
  Effect.gen(function*() {
    const nlp = yield* NLPService

    // First pass: compute term and document frequencies
    const corpusAnalysis = yield* corpusPipeline(documents)

    // Second pass: compute TF-IDF for each document
    const tfidfVectors = yield* Effect.all(
      documents.map((doc) =>
        Effect.gen(function*() {
          // Preprocess document
          const normalized = yield* nlp.normalizeWhitespace(doc)
          const cleaned = yield* nlp.removePunctuation(normalized)
          const tokens = yield* nlp.tokenize(cleaned)
          const filtered = yield* nlp.removeStopWords(tokens)
          const stemmed = yield* nlp.stem(filtered)

          // Compute TF (term frequency in this document)
          const bow = yield* nlp.bagOfWords(stemmed)
          const tf = NLPMonoid.bagOfWordsToTF(bow)

          // Compute TF-IDF using corpus statistics
          const tfidf = NLPMonoid.computeTFIDF(
            tf,
            corpusAnalysis.documentFrequency,
            corpusAnalysis.documentCount
          )

          return tfidf
        })
      )
    )

    return tfidfVectors
  })

// =============================================================================
// Similarity Pipeline
// =============================================================================

/**
 * Document similarity pipeline
 *
 * Computes pairwise similarity between all documents in a corpus.
 * Uses string similarity on normalized text.
 *
 * Demonstrates:
 * - Nested Effect.all for Cartesian product
 * - Metric space properties of similarity measures
 */
export const similarityPipeline = (
  documents: ReadonlyArray<string>
): Effect.Effect<Map<[number, number], number>, never, NLPService> =>
  Effect.gen(function*() {
    const nlp = yield* NLPService

    // Normalize all documents
    const normalized = yield* Effect.all(
      documents.map((doc) => nlp.normalizeWhitespace(doc))
    )

    // Compute pairwise similarities (upper triangular matrix)
    const similarities = new Map<[number, number], number>()

    for (let i = 0; i < normalized.length; i++) {
      for (let j = i + 1; j < normalized.length; j++) {
        const sim = yield* nlp.stringSimilarity(normalized[i]!, normalized[j]!)
        similarities.set([i, j], sim)
      }
    }

    return similarities
  })

// =============================================================================
// Streaming Pipeline (for large corpora)
// =============================================================================

/**
 * Streaming corpus processing pipeline
 *
 * Processes documents one at a time, aggregating results incrementally.
 * This is memory-efficient for large corpora.
 *
 * Uses monoid fold to aggregate results without loading all documents in memory.
 */
export const streamingCorpusPipeline = (
  documents: ReadonlyArray<string>
): Effect.Effect<
  {
    readonly vocabulary: Set<string>
    readonly termFrequency: BagOfWords
    readonly docCount: number
  },
  never,
  NLPService
> =>
  Effect.gen(function*() {
    const nlp = yield* NLPService

    // Process documents one at a time, accumulating results
    let vocabulary = NLPMonoid.Vocabulary.empty
    let termFrequency = NLPMonoid.TermFrequency.empty
    let docCount = 0

    for (const doc of documents) {
      // Process document
      const normalized = yield* nlp.normalizeWhitespace(doc)
      const cleaned = yield* nlp.removePunctuation(normalized)
      const tokens = yield* nlp.tokenize(cleaned)
      const filtered = yield* nlp.removeStopWords(tokens)
      const stemmed = yield* nlp.stem(filtered)
      const bow = yield* nlp.bagOfWords(stemmed)

      // Aggregate using monoids (incremental, memory-efficient)
      vocabulary = NLPMonoid.Vocabulary.combine(vocabulary, new Set(stemmed))
      termFrequency = NLPMonoid.TermFrequency.combine(termFrequency, bow)
      docCount++
    }

    return {
      vocabulary,
      termFrequency,
      docCount
    }
  })

// =============================================================================
// Custom Pipeline Builders
// =============================================================================

/**
 * Build a custom pipeline from a sequence of operations
 *
 * This is a higher-order function that takes a list of text processing
 * functions and composes them into a single pipeline.
 *
 * Demonstrates the compositional nature of Effect operations.
 */
export const buildCustomPipeline = (
  operations: ReadonlyArray<
    (text: string) => Effect.Effect<string, never, NLPService>
  >
) => (text: string): Effect.Effect<string, never, NLPService> => {
  let result: Effect.Effect<string, never, NLPService> = Effect.succeed(text)
  for (const operation of operations) {
    result = Effect.flatMap(result, operation)
  }
  return result
}

/**
 * Example: Text cleaning pipeline
 *
 * Composes normalization operations into a reusable pipeline.
 */
export const textCleaningPipeline = (
  text: string
): Effect.Effect<string, never, NLPService> =>
  Effect.gen(function*() {
    const nlp = yield* NLPService

    const pipeline = buildCustomPipeline([
      (t) => nlp.normalizeWhitespace(t),
      (t) => nlp.removePunctuation(t),
      (t) => nlp.removeExtraSpaces(t)
    ])

    return yield* pipeline(text)
  })

// =============================================================================
// Conditional Pipelines
// =============================================================================

/**
 * Adaptive pipeline that chooses operations based on text properties
 *
 * This demonstrates branching in Effect pipelines.
 */
export const adaptivePipeline = (
  text: string
): Effect.Effect<ReadonlyArray<string>, never, NLPService> =>
  Effect.gen(function*() {
    const nlp = yield* NLPService

    // Check text properties
    const wordCount = yield* nlp.wordCount(text)

    // Branch based on document size
    if (wordCount < 10) {
      // Short text: just tokenize
      return yield* nlp.tokenize(text)
    } else if (wordCount < 100) {
      // Medium text: normalize and tokenize
      const normalized = yield* nlp.normalizeWhitespace(text)
      return yield* nlp.tokenize(normalized)
    } else {
      // Long text: full preprocessing
      const normalized = yield* nlp.normalizeWhitespace(text)
      const cleaned = yield* nlp.removePunctuation(normalized)
      const tokens = yield* nlp.tokenize(cleaned)
      const filtered = yield* nlp.removeStopWords(tokens)
      return yield* nlp.stem(filtered)
    }
  })

// =============================================================================
// Error Handling Pipelines
// =============================================================================

/**
 * Robust pipeline with fallback operations
 *
 * Demonstrates Effect's error handling with Option and fallback values.
 */
export const robustPipeline = (
  text: string
): Effect.Effect<ReadonlyArray<string>, never, NLPService> =>
  Effect.gen(function*() {
    const nlp = yield* NLPService

    // Try advanced preprocessing
    const normalizedEffect = Effect.orElse(
      nlp.normalizeWhitespace(text),
      () => Effect.succeed(text) // Fallback to original
    )

    const normalized = yield* normalizedEffect

    // Tokenize (always succeeds)
    const tokens = yield* nlp.tokenize(normalized)

    // Return tokens (even if empty)
    return tokens.length > 0 ? tokens : [""]
  })
