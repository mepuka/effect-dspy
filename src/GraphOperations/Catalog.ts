/**
 * Operation Catalog - Standard NLP operations as GraphOperations
 *
 * This module provides a library of ready-to-use operations
 * that integrate with NLPService.
 *
 * All operations follow the GraphOperation interface and can be
 * executed by the GraphExecutor.
 */

import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Duration from "effect/Duration"
import type { GraphNode } from "../EffectGraph.js"
import * as EG from "../EffectGraph.js"
import { NLPService } from "../NLPService.js"
import * as Op from "./Operation.js"
import * as Types from "./Types.js"

// =============================================================================
// Text Operations
// =============================================================================

/**
 * Sentencize - Split text into sentences
 *
 * Category: Expansion (one-to-many)
 * Input: string
 * Output: ReadonlyArray<string>
 */
export const sentencize: Op.GraphOperation<
  string,
  string,
  NLPService,
  never
> = Op.make({
  name: "sentencize",
  description: "Split text into sentences using sentence boundary detection",
  category: "expansion",
  apply: (node) =>
    Effect.gen(function* () {
      const nlp = yield* NLPService
      const sentences = yield* nlp.sentencize(node.data)

      return sentences.map((sentence) =>
        EG.makeNode(sentence, Option.some(node.id), Option.some("sentencize"))
      )
    }),
  validate: (node) =>
    Effect.succeed(
      node.data.trim().length > 0
        ? Types.ValidationResult.valid()
        : Types.ValidationResult.invalid(["Text is empty"])
    ),
  estimateCost: (node) =>
    Effect.succeed({
      estimatedTime: Duration.millis(10), // Fast, local operation
      tokenCost: 0,
      memoryCost: node.data.length * 2, // Rough estimate
      complexity: "O(n)"
    })
})

/**
 * Tokenize - Split text into tokens/words
 *
 * Category: Expansion (one-to-many)
 * Input: string
 * Output: ReadonlyArray<string>
 */
export const tokenize: Op.GraphOperation<string, string, NLPService, never> =
  Op.make({
    name: "tokenize",
    description: "Split text into tokens/words using tokenization",
    category: "expansion",
    apply: (node) =>
      Effect.gen(function* () {
        const nlp = yield* NLPService
        const tokens = yield* nlp.tokenize(node.data)

        return tokens.map((token) =>
          EG.makeNode(token, Option.some(node.id), Option.some("tokenize"))
        )
      }),
    validate: (node) =>
      Effect.succeed(
        node.data.trim().length > 0
          ? Types.ValidationResult.valid()
          : Types.ValidationResult.invalid(["Text is empty"])
      ),
    estimateCost: (node) =>
      Effect.succeed({
        estimatedTime: Duration.millis(5),
        tokenCost: 0,
        memoryCost: node.data.length,
        complexity: "O(n)"
      })
  })

/**
 * Paragraphize - Split text into paragraphs
 *
 * Category: Expansion (one-to-many)
 * Input: string
 * Output: ReadonlyArray<string>
 */
export const paragraphize: Op.GraphOperation<
  string,
  string,
  NLPService,
  never
> = Op.make({
  name: "paragraphize",
  description: "Split text into paragraphs on double newlines",
  category: "expansion",
  apply: (node) =>
    Effect.gen(function* () {
      const nlp = yield* NLPService
      const paragraphs = yield* nlp.paragraphize(node.data)

      return paragraphs.map((para) =>
        EG.makeNode(para, Option.some(node.id), Option.some("paragraphize"))
      )
    }),
  validate: (node) =>
    Effect.succeed(
      node.data.trim().length > 0
        ? Types.ValidationResult.valid()
        : Types.ValidationResult.invalid(["Text is empty"])
    ),
  estimateCost: (node) =>
    Effect.succeed({
      estimatedTime: Duration.millis(5),
      tokenCost: 0,
      memoryCost: node.data.length,
      complexity: "O(n)"
    })
})

/**
 * Normalize Whitespace - Clean up whitespace
 *
 * Category: Transformation (one-to-one)
 * Input: string
 * Output: string
 */
export const normalizeWhitespace: Op.GraphOperation<
  string,
  string,
  NLPService,
  never
> = Op.make({
  name: "normalizeWhitespace",
  description: "Normalize whitespace (collapse multiple spaces, trim)",
  category: "transformation",
  apply: (node) =>
    Effect.gen(function* () {
      const nlp = yield* NLPService
      const normalized = yield* nlp.normalizeWhitespace(node.data)

      return [
        EG.makeNode(
          normalized,
          Option.some(node.id),
          Option.some("normalizeWhitespace")
        )
      ]
    }),
  estimateCost: (node) =>
    Effect.succeed({
      estimatedTime: Duration.millis(1),
      tokenCost: 0,
      memoryCost: node.data.length,
      complexity: "O(n)"
    })
})

/**
 * Remove Punctuation
 *
 * Category: Transformation
 * Input: string
 * Output: string
 */
export const removePunctuation: Op.GraphOperation<
  string,
  string,
  NLPService,
  never
> = Op.make({
  name: "removePunctuation",
  description: "Remove all punctuation from text",
  category: "transformation",
  apply: (node) =>
    Effect.gen(function* () {
      const nlp = yield* NLPService
      const cleaned = yield* nlp.removePunctuation(node.data)

      return [
        EG.makeNode(
          cleaned,
          Option.some(node.id),
          Option.some("removePunctuation")
        )
      ]
    }),
  estimateCost: (node) =>
    Effect.succeed({
      estimatedTime: Duration.millis(2),
      tokenCost: 0,
      memoryCost: node.data.length,
      complexity: "O(n)"
    })
})

/**
 * Remove Stop Words
 *
 * Category: Filtering
 * Input: string (token)
 * Output: string (filtered token)
 */
export const removeStopWords: Op.GraphOperation<
  string,
  string,
  NLPService,
  never
> = Op.make({
  name: "removeStopWords",
  description: "Remove common stop words (the, is, at, etc.)",
  category: "filtering",
  apply: (node) =>
    Effect.gen(function* () {
      const nlp = yield* NLPService
      const tokens = [node.data]
      const filtered = yield* nlp.removeStopWords(tokens)

      // If token was filtered out, return empty array
      if (filtered.length === 0) {
        return []
      }

      return [
        EG.makeNode(
          filtered[0]!,
          Option.some(node.id),
          Option.some("removeStopWords")
        )
      ]
    }),
  estimateCost: (node) =>
    Effect.succeed({
      estimatedTime: Duration.millis(1),
      tokenCost: 0,
      memoryCost: node.data.length,
      complexity: "O(1)"
    })
})

/**
 * Stem - Reduce tokens to stems
 *
 * Category: Transformation
 * Input: string (token)
 * Output: string (stemmed token)
 */
export const stem: Op.GraphOperation<string, string, NLPService, never> =
  Op.make({
    name: "stem",
    description: "Apply Porter stemming to reduce words to roots",
    category: "transformation",
    apply: (node) =>
      Effect.gen(function* () {
        const nlp = yield* NLPService
        const tokens = [node.data]
        const stemmed = yield* nlp.stem(tokens)

        return [
          EG.makeNode(stemmed[0]!, Option.some(node.id), Option.some("stem"))
        ]
      }),
    estimateCost: (node) =>
      Effect.succeed({
        estimatedTime: Duration.millis(2),
        tokenCost: 0,
        memoryCost: node.data.length,
        complexity: "O(n)"
      })
  })

/**
 * N-Grams - Generate n-grams from text
 *
 * Category: Expansion
 * Input: string
 * Output: ReadonlyArray<string>
 */
export const ngrams = (n: number): Op.GraphOperation<string, string, NLPService, never> =>
  Op.make({
    name: `ngrams(${n})`,
    description: `Generate ${n}-grams from text`,
    category: "expansion",
    apply: (node) =>
      Effect.gen(function* () {
        const nlp = yield* NLPService
        const grams = yield* nlp.ngrams(node.data, n)

        return grams.map((gram) =>
          EG.makeNode(gram, Option.some(node.id), Option.some(`ngrams(${n})`))
        )
      }),
    validate: (node) =>
      Effect.succeed(
        n >= 1
          ? Types.ValidationResult.valid()
          : Types.ValidationResult.invalid(["n must be at least 1"])
      ),
    estimateCost: (node) =>
      Effect.succeed({
        estimatedTime: Duration.millis(10),
        tokenCost: 0,
        memoryCost: node.data.length * n,
        complexity: "O(n)"
      })
  })

// =============================================================================
// Pure String Operations
// =============================================================================

/**
 * To Lowercase
 */
export const toLowerCase: Op.GraphOperation<string, string, never, never> =
  Op.transform({
    name: "toLowerCase",
    description: "Convert text to lowercase",
    f: (data) => data.toLowerCase()
  })

/**
 * To Uppercase
 */
export const toUpperCase: Op.GraphOperation<string, string, never, never> =
  Op.transform({
    name: "toUpperCase",
    description: "Convert text to uppercase",
    f: (data) => data.toUpperCase()
  })

/**
 * Trim
 */
export const trim: Op.GraphOperation<string, string, never, never> =
  Op.transform({
    name: "trim",
    description: "Remove leading/trailing whitespace",
    f: (data) => data.trim()
  })

/**
 * Length - Get text length
 */
export const length: Op.GraphOperation<string, number, never, never> =
  Op.transform({
    name: "length",
    description: "Get character count",
    f: (data) => data.length
  })

// =============================================================================
// Operation Catalog
// =============================================================================

/**
 * Standard operation catalog
 */
export const StandardOperations = {
  // Text splitting
  sentencize,
  tokenize,
  paragraphize,

  // Text cleaning
  normalizeWhitespace,
  removePunctuation,
  removeStopWords,
  stem,

  // N-grams
  ngrams,

  // String transforms
  toLowerCase,
  toUpperCase,
  trim,
  length
} as const

/**
 * Get all operation names
 */
export const getOperationNames = (): ReadonlyArray<string> =>
  Object.keys(StandardOperations)

/**
 * Get operation by name
 */
export const getOperation = (
  name: string
): Op.GraphOperation<any, any, any, any> | undefined => {
  return (StandardOperations as any)[name]
}
