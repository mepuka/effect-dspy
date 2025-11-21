/**
 * Algebra/NLPMonoid - NLP-specific monoid structures
 *
 * This module defines monoid instances specifically for NLP data structures,
 * building on the general monoid framework in Monoid.ts.
 *
 * These monoids provide mathematically sound aggregation operations for:
 * - Tokens (words and their features)
 * - Sentences (sequences of tokens)
 * - Documents (collections of sentences)
 * - Linguistic annotations (POS tags, named entities, etc.)
 *
 * Each monoid satisfies the monoid laws:
 * 1. Associativity: (x ⊕ y) ⊕ z = x ⊕ (y ⊕ z)
 * 2. Left identity: ∅ ⊕ x = x
 * 3. Right identity: x ⊕ ∅ = x
 */

import type { BagOfWords } from "../NLPService.js"
import * as M from "./Monoid.js"

// =============================================================================
// Token Monoids
// =============================================================================

/**
 * Token concatenation monoid
 *
 * Combines tokens with space separator, forming natural language text.
 * This is the forgetful functor from Token* → Text in the adjunction.
 *
 * - Empty: ""
 * - Combine: join with " "
 *
 * Example:
 *   combine("hello", "world") = "hello world"
 *
 * Laws verified via property tests in test/Algebra/NLPMonoid.test.ts
 */
export const TokenConcat: M.Monoid<string> = M.StringJoin(" ")

/**
 * Token bag-of-words monoid
 *
 * Combines token frequency maps by adding frequencies.
 * This is a monoid homomorphism from tokens to multisets.
 *
 * - Empty: new Map()
 * - Combine: union with frequency addition
 *
 * Example:
 *   bow1 = { "cat": 2, "dog": 1 }
 *   bow2 = { "cat": 1, "fish": 3 }
 *   combine(bow1, bow2) = { "cat": 3, "dog": 1, "fish": 3 }
 *
 * Category theory: This is a homomorphism from the free monoid (Token*)
 * to the multiset monoid over tokens.
 */
export const TokenBagOfWords: M.Monoid<BagOfWords> = {
  empty: new Map(),
  combine: (bow1, bow2) => {
    const result = new Map(bow1)
    bow2.forEach((count, token) => {
      result.set(token, (result.get(token) || 0) + count)
    })
    return result
  }
}

/**
 * Token set union monoid
 *
 * Combines token sets, collecting unique tokens.
 * Useful for vocabulary extraction.
 *
 * - Empty: new Set()
 * - Combine: set union
 *
 * Example:
 *   set1 = {"cat", "dog"}
 *   set2 = {"dog", "fish"}
 *   combine(set1, set2) = {"cat", "dog", "fish"}
 */
export const TokenSetUnion: M.Monoid<Set<string>> = M.SetUnion<string>()

// =============================================================================
// Sentence Monoids
// =============================================================================

/**
 * Sentence concatenation monoid
 *
 * Combines sentences with proper spacing and punctuation.
 * Preserves sentence boundaries in the output.
 *
 * - Empty: ""
 * - Combine: join with ". " and ensure final period
 *
 * Example:
 *   combine("Hello world", "How are you") = "Hello world. How are you."
 */
export const SentenceConcat: M.Monoid<string> = {
  empty: "",
  combine: (s1, s2) => {
    if (s1 === "") return s2
    if (s2 === "") return s1

    // Ensure first sentence ends with period
    const s1Normalized = s1.match(/[.!?]$/) ? s1 : s1 + "."
    // Second sentence will get its period added when combined further
    return `${s1Normalized} ${s2}`
  }
}

/**
 * Sentence array monoid
 *
 * Combines arrays of sentences by concatenation.
 * Preserves sentence order and boundaries.
 *
 * - Empty: []
 * - Combine: array concatenation
 */
export const SentenceArray: M.Monoid<ReadonlyArray<string>> = M.ArrayConcat<
  string
>()

// =============================================================================
// Document Monoids
// =============================================================================

/**
 * Document text monoid
 *
 * Combines documents by concatenating paragraphs.
 * Preserves paragraph boundaries with double newlines.
 *
 * - Empty: ""
 * - Combine: join with "\n\n"
 *
 * Example:
 *   doc1 = "First paragraph."
 *   doc2 = "Second paragraph."
 *   combine(doc1, doc2) = "First paragraph.\n\nSecond paragraph."
 */
export const DocumentText: M.Monoid<string> = M.StringJoin("\n\n")

/**
 * Document statistics monoid
 *
 * Combines document statistics by summing counts.
 * Tracks word count, sentence count, and character count.
 *
 * This is a product monoid over numeric statistics.
 *
 * Example:
 *   stats1 = { wordCount: 10, sentenceCount: 2, charCount: 50 }
 *   stats2 = { wordCount: 5, sentenceCount: 1, charCount: 25 }
 *   combine(stats1, stats2) = { wordCount: 15, sentenceCount: 3, charCount: 75 }
 */
export interface DocumentStatistics {
  readonly wordCount: number
  readonly sentenceCount: number
  readonly charCount: number
}

export const DocumentStats: M.Monoid<DocumentStatistics> = {
  empty: { wordCount: 0, sentenceCount: 0, charCount: 0 },
  combine: (s1, s2) => ({
    wordCount: s1.wordCount + s2.wordCount,
    sentenceCount: s1.sentenceCount + s2.sentenceCount,
    charCount: s1.charCount + s2.charCount
  })
}

// =============================================================================
// Linguistic Feature Monoids
// =============================================================================

/**
 * Linguistic annotation monoid (generic)
 *
 * Combines annotations by merging maps.
 * Useful for combining POS tags, NER labels, dependency parses, etc.
 *
 * When annotations conflict (same position), takes the first one (left-biased).
 *
 * - Empty: new Map()
 * - Combine: left-biased map merge
 *
 * Example (POS tags):
 *   tags1 = { 0: "DET", 1: "NOUN" }
 *   tags2 = { 1: "VERB", 2: "PUNCT" }  // conflict at position 1
 *   combine(tags1, tags2) = { 0: "DET", 1: "NOUN", 2: "PUNCT" }
 */
export const AnnotationMap = <K, V>(): M.Monoid<Map<K, V>> => ({
  empty: new Map(),
  combine: (m1, m2) => {
    const result = new Map(m1)
    m2.forEach((value, key) => {
      if (!result.has(key)) {
        result.set(key, value)
      }
    })
    return result
  }
})

/**
 * Named Entity monoid
 *
 * Combines lists of named entities by concatenation.
 * Preserves entity order and allows duplicates.
 *
 * - Empty: []
 * - Combine: array concatenation
 */
export interface NamedEntity {
  readonly text: string
  readonly type: string // PER, ORG, LOC, etc.
  readonly startPos: number
  readonly endPos: number
}

export const NamedEntityList: M.Monoid<ReadonlyArray<NamedEntity>> =
  M.ArrayConcat<NamedEntity>()

/**
 * Dependency parse monoid
 *
 * Combines dependency parse edges.
 * Each edge represents a syntactic dependency: (head, dependent, relation)
 *
 * - Empty: []
 * - Combine: array concatenation
 */
export interface DependencyEdge {
  readonly head: number // token index
  readonly dependent: number // token index
  readonly relation: string // "nsubj", "dobj", etc.
}

export const DependencyParse: M.Monoid<ReadonlyArray<DependencyEdge>> =
  M.ArrayConcat<DependencyEdge>()

// =============================================================================
// Corpus Monoids (for large-scale text collections)
// =============================================================================

/**
 * Term frequency monoid
 *
 * Same as TokenBagOfWords, but semantically represents term frequencies
 * in a corpus (for TF-IDF, etc.)
 */
export const TermFrequency: M.Monoid<BagOfWords> = TokenBagOfWords

/**
 * Document frequency monoid
 *
 * Tracks how many documents contain each term.
 * Different from term frequency - counts presence, not occurrences.
 *
 * - Empty: new Map()
 * - Combine: union with count addition
 *
 * Example:
 *   df1 = { "cat": 2, "dog": 3 }  // "cat" appears in 2 docs
 *   df2 = { "cat": 1, "fish": 1 } // "cat" appears in 1 more doc
 *   combine(df1, df2) = { "cat": 3, "dog": 3, "fish": 1 }
 */
export const DocumentFrequency: M.Monoid<Map<string, number>> = {
  empty: new Map(),
  combine: (df1, df2) => {
    const result = new Map(df1)
    df2.forEach((count, term) => {
      result.set(term, (result.get(term) || 0) + count)
    })
    return result
  }
}

/**
 * Vocabulary monoid
 *
 * Builds vocabulary (unique terms) from documents.
 * This is essentially TokenSetUnion but semantically distinct.
 */
export const Vocabulary: M.Monoid<Set<string>> = TokenSetUnion

// =============================================================================
// Specialized Aggregation Monoids
// =============================================================================

/**
 * Weighted token monoid
 *
 * Combines tokens with weights (for importance scoring, TF-IDF, etc.)
 * Weights are added when the same token appears multiple times.
 *
 * - Empty: new Map()
 * - Combine: union with weight addition
 *
 * Example:
 *   weighted1 = { "important": 0.8, "word": 0.5 }
 *   weighted2 = { "important": 0.3, "other": 0.2 }
 *   combine(weighted1, weighted2) = { "important": 1.1, "word": 0.5, "other": 0.2 }
 */
export const WeightedTokens: M.Monoid<Map<string, number>> = {
  empty: new Map(),
  combine: (wt1, wt2) => {
    const result = new Map(wt1)
    wt2.forEach((weight, token) => {
      result.set(token, (result.get(token) || 0) + weight)
    })
    return result
  }
}

/**
 * N-gram frequency monoid
 *
 * Similar to bag-of-words but for n-grams.
 * N-grams are represented as space-joined strings.
 *
 * Example (bigrams):
 *   ngrams1 = { "hello world": 2, "world peace": 1 }
 *   ngrams2 = { "hello world": 1, "peace now": 1 }
 *   combine(ngrams1, ngrams2) = { "hello world": 3, "world peace": 1, "peace now": 1 }
 */
export const NGramFrequency: M.Monoid<Map<string, number>> = {
  empty: new Map(),
  combine: (ng1, ng2) => {
    const result = new Map(ng1)
    ng2.forEach((count, ngram) => {
      result.set(ngram, (result.get(ngram) || 0) + count)
    })
    return result
  }
}

// =============================================================================
// Composite Monoids for Multi-Feature Analysis
// =============================================================================

/**
 * Text analysis result monoid
 *
 * Combines complete text analysis results including:
 * - Token statistics (bag of words)
 * - Named entities
 * - Sentence count
 * - Vocabulary
 *
 * This is a product monoid over multiple linguistic features.
 */
export interface TextAnalysis {
  readonly bow: BagOfWords
  readonly entities: ReadonlyArray<NamedEntity>
  readonly sentenceCount: number
  readonly vocabulary: Set<string>
}

export const TextAnalysisMonoid: M.Monoid<TextAnalysis> = {
  empty: {
    bow: new Map(),
    entities: [],
    sentenceCount: 0,
    vocabulary: new Set()
  },
  combine: (a1, a2) => ({
    bow: TokenBagOfWords.combine(a1.bow, a2.bow),
    entities: NamedEntityList.combine(a1.entities, a2.entities),
    sentenceCount: a1.sentenceCount + a2.sentenceCount,
    vocabulary: TokenSetUnion.combine(a1.vocabulary, a2.vocabulary)
  })
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert bag of words to term frequency (normalized by total count)
 *
 * This is a monoid homomorphism when composed with normalization.
 */
export const bagOfWordsToTF = (bow: BagOfWords): Map<string, number> => {
  const total = Array.from(bow.values()).reduce((sum, count) => sum + count, 0)
  if (total === 0) return new Map()

  const tf = new Map<string, number>()
  bow.forEach((count, term) => {
    tf.set(term, count / total)
  })
  return tf
}

/**
 * Compute TF-IDF scores from term frequency and document frequency
 *
 * TF-IDF(t, d) = TF(t, d) × IDF(t)
 * IDF(t) = log(N / DF(t))
 *
 * Where:
 * - TF(t, d) = frequency of term t in document d
 * - DF(t) = number of documents containing term t
 * - N = total number of documents
 */
export const computeTFIDF = (
  tf: Map<string, number>,
  df: Map<string, number>,
  totalDocs: number
): Map<string, number> => {
  const tfidf = new Map<string, number>()

  tf.forEach((tfScore, term) => {
    const docFreq = df.get(term) || 1
    const idf = Math.log(totalDocs / docFreq)
    tfidf.set(term, tfScore * idf)
  })

  return tfidf
}

// =============================================================================
// Export convenience aggregators
// =============================================================================

/**
 * Aggregate tokens into bag of words
 */
export const aggregateTokens = (tokens: ReadonlyArray<string>): BagOfWords =>
  M.fold(TokenBagOfWords)(
    tokens.map((token) => {
      const bow: BagOfWords = new Map()
      bow.set(token, 1)
      return bow
    })
  )

/**
 * Aggregate sentences into document
 */
export const aggregateSentences = (
  sentences: ReadonlyArray<string>
): string => M.fold(SentenceConcat)(sentences)

/**
 * Aggregate document statistics
 */
export const aggregateStats = (
  stats: ReadonlyArray<DocumentStatistics>
): DocumentStatistics => M.fold(DocumentStats)(stats)
