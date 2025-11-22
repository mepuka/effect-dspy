/**
 * MCP NLP Tools
 *
 * Tool definitions using @effect/ai Tool.make for MCP exposure.
 * Tools are defined with Effect Schema for type-safe validation.
 */

import { Tool, Toolkit } from "@effect/ai"
import * as Schema from "effect/Schema"
import * as Schemas from "./Schemas.js"

// =============================================================================
// NLP Tools - Text Segmentation
// =============================================================================

/**
 * Split text into sentences using linguistic boundary detection
 */
export const Sentencize = Tool.make("nlp_sentencize", {
  description: "Split text into sentences using linguistic boundary detection. Returns an array of sentence strings.",
  parameters: {
    text: Schema.String.pipe(Schema.minLength(1))
  },
  success: Schemas.TextArrayOutput
})

/**
 * Split text into tokens (words)
 */
export const Tokenize = Tool.make("nlp_tokenize", {
  description: "Split text into tokens (words). Returns an array of token strings including punctuation.",
  parameters: {
    text: Schema.String.pipe(Schema.minLength(1))
  },
  success: Schemas.TextArrayOutput
})

/**
 * Split text into paragraphs
 */
export const Paragraphize = Tool.make("nlp_paragraphize", {
  description: "Split text into paragraphs based on double-newline boundaries.",
  parameters: {
    text: Schema.String.pipe(Schema.minLength(1))
  },
  success: Schemas.TextArrayOutput
})

// =============================================================================
// NLP Tools - Linguistic Annotation
// =============================================================================

/**
 * Part-of-speech tagging
 */
export const PosTag = Tool.make("nlp_pos_tag", {
  description: "Part-of-speech tagging using Penn Treebank tagset. Returns tokens annotated with grammatical categories (NN=noun, VB=verb, JJ=adjective, etc.).",
  parameters: {
    text: Schema.String.pipe(Schema.minLength(1))
  },
  success: Schemas.POSOutput
})

/**
 * Lemmatization - reduce to dictionary forms
 */
export const Lemmatize = Tool.make("nlp_lemmatize", {
  description: "Lemmatization - reduce tokens to their dictionary/canonical forms. Example: 'running' -> 'run', 'better' -> 'good'.",
  parameters: {
    text: Schema.String.pipe(Schema.minLength(1))
  },
  success: Schemas.LemmaOutput
})

/**
 * Named entity extraction
 */
export const ExtractEntities = Tool.make("nlp_entities", {
  description: "Extract named entities from text (PERSON, ORG, LOC, etc.). Returns entity spans with character offsets.",
  parameters: {
    text: Schema.String.pipe(Schema.minLength(1))
  },
  success: Schemas.EntityOutput
})

// =============================================================================
// NLP Tools - Text Features
// =============================================================================

/**
 * N-gram extraction
 */
export const Ngrams = Tool.make("nlp_ngrams", {
  description: "Extract n-grams (contiguous sequences of n tokens) from text. Useful for phrase detection and text features.",
  parameters: {
    text: Schema.String.pipe(Schema.minLength(1)),
    n: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0), Schema.lessThanOrEqualTo(10))
  },
  success: Schemas.TextArrayOutput
})

/**
 * Bag of words representation
 */
export const BagOfWords = Tool.make("nlp_bag_of_words", {
  description: "Create bag-of-words representation - a map of terms to their frequencies. Useful for text similarity and classification.",
  parameters: {
    tokens: Schema.Array(Schema.String)
  },
  success: Schemas.BagOfWordsOutput
})

/**
 * Porter stemmer
 */
export const Stem = Tool.make("nlp_stem", {
  description: "Apply Porter stemmer to tokens - reduces words to their stem form. Example: 'running' -> 'run'. Idempotent operation.",
  parameters: {
    tokens: Schema.Array(Schema.String)
  },
  success: Schemas.TextArrayOutput
})

/**
 * Remove stop words
 */
export const RemoveStopWords = Tool.make("nlp_remove_stop_words", {
  description: "Remove common stop words (the, a, is, etc.) from token list. Useful for content extraction.",
  parameters: {
    tokens: Schema.Array(Schema.String)
  },
  success: Schemas.TextArrayOutput
})

// =============================================================================
// NLP Tools - Utilities
// =============================================================================

/**
 * Word count
 */
export const WordCount = Tool.make("nlp_word_count", {
  description: "Count the number of words/tokens in text.",
  parameters: {
    text: Schema.String.pipe(Schema.minLength(1))
  },
  success: Schemas.NumberOutput
})

/**
 * String similarity using Jaro-Winkler
 */
export const Similarity = Tool.make("nlp_similarity", {
  description: "Compute Jaro-Winkler string similarity between two texts. Returns a value between 0 (no similarity) and 1 (identical).",
  parameters: {
    text1: Schema.String,
    text2: Schema.String
  },
  success: Schemas.NumberOutput
})

/**
 * Text normalization
 */
export const Normalize = Tool.make("nlp_normalize", {
  description: "Normalize text by removing extra whitespace, punctuation, and optionally converting to lowercase.",
  parameters: {
    text: Schema.String,
    options: Schema.optional(
      Schema.Struct({
        removeWhitespace: Schema.optional(Schema.Boolean),
        removePunctuation: Schema.optional(Schema.Boolean),
        lowercase: Schema.optional(Schema.Boolean)
      })
    )
  },
  success: Schemas.TextOutput
})

// =============================================================================
// NLP Tools - Combined Analysis
// =============================================================================

/**
 * Comprehensive NLP analysis
 */
export const Analyze = Tool.make("nlp_analyze", {
  description: "Perform comprehensive NLP analysis on text. Optionally include sentences, tokens, POS tags, lemmas, entities, and n-grams.",
  parameters: {
    text: Schema.String.pipe(Schema.minLength(1)),
    options: Schema.optional(
      Schema.Struct({
        sentences: Schema.optional(Schema.Boolean),
        tokens: Schema.optional(Schema.Boolean),
        pos: Schema.optional(Schema.Boolean),
        lemmas: Schema.optional(Schema.Boolean),
        entities: Schema.optional(Schema.Boolean),
        ngrams: Schema.optional(Schema.Number)
      })
    )
  },
  success: Schemas.AnalysisOutput
})

// =============================================================================
// NLP Toolkit
// =============================================================================

/**
 * The complete NLP toolkit containing all available tools
 */
export const NlpToolkit = Toolkit.make(
  Sentencize,
  Tokenize,
  Paragraphize,
  PosTag,
  Lemmatize,
  ExtractEntities,
  Ngrams,
  BagOfWords,
  Stem,
  RemoveStopWords,
  WordCount,
  Similarity,
  Normalize,
  Analyze
)

/**
 * Type for the NLP toolkit
 */
export type NlpToolkit = typeof NlpToolkit

/**
 * Get all tool names from the toolkit
 */
export const getToolNames = (): string[] =>
  Object.keys(NlpToolkit.tools)

/**
 * Get a specific tool by name
 */
export const getTool = (name: string): Tool.Any | undefined =>
  NlpToolkit.tools[name as keyof typeof NlpToolkit.tools]
