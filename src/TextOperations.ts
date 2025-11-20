/**
 * TextOperations - Concrete text processing operations as graph transformations
 *
 * This module provides ready-to-use text operations that transform graphs:
 * - Sentencization: text → sentences (one-to-many)
 * - Tokenization: text → tokens (one-to-many)
 * - Paragraphization: text → paragraphs (one-to-many)
 * - Aggregation: children → parent (many-to-one)
 *
 * Each operation is:
 * 1. Pure (referentially transparent)
 * 2. Composable (can be chained)
 * 3. Type-safe (compile-time guarantees)
 * 4. Effectful (explicit error handling and dependencies)
 */

import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as EG from "./EffectGraph.js"
import type { TextOperation, ForgetfulOperation } from "./TypeClass.js"
import * as TC from "./TypeClass.js"
import { NLPService } from "./NLPService.js"

// =============================================================================
// Core Text Operations
// =============================================================================

/**
 * Sentencization Operation
 *
 * Transforms a text node into multiple sentence nodes.
 * This is a "free" operation in the adjunction sense - it expands structure.
 *
 * Example:
 *   Input: "Hello world. How are you?"
 *   Output: ["Hello world.", "How are you?"]
 *
 * Category theory: This is a left adjoint functor (free construction)
 * It freely generates sentence nodes from a text node.
 */
export const sentencizeOperation: TextOperation<
  string,
  string,
  NLPService,
  never
> = TC.makeOperation("sentencize", (node) =>
  Effect.gen(function* () {
    const nlp = yield* NLPService
    const sentences = yield* nlp.sentencize(node.data)

    // Create a child node for each sentence
    return sentences.map(sentence =>
      EG.makeNode(sentence, Option.some(node.id), Option.some("sentencize"))
    )
  })
)

/**
 * Tokenization Operation
 *
 * Transforms a text node into multiple token (word) nodes.
 * Another free operation expanding structure.
 *
 * Example:
 *   Input: "Hello world!"
 *   Output: ["Hello", "world", "!"]
 *
 * This can be applied after sentencization to create a two-level hierarchy:
 *   text → sentences → tokens
 */
export const tokenizeOperation: TextOperation<
  string,
  string,
  NLPService,
  never
> = TC.makeOperation("tokenize", (node) =>
  Effect.gen(function* () {
    const nlp = yield* NLPService
    const tokens = yield* nlp.tokenize(node.data)

    // Create a child node for each token
    return tokens.map(token =>
      EG.makeNode(token, Option.some(node.id), Option.some("tokenize"))
    )
  })
)

/**
 * Paragraphization Operation
 *
 * Transforms a text node into multiple paragraph nodes.
 * Useful for document-level processing.
 *
 * Example:
 *   Input: "Para 1.\n\nPara 2."
 *   Output: ["Para 1.", "Para 2."]
 */
export const paragraphizeOperation: TextOperation<
  string,
  string,
  NLPService,
  never
> = TC.makeOperation("paragraphize", (node) =>
  Effect.gen(function* () {
    const nlp = yield* NLPService
    const paragraphs = yield* nlp.paragraphize(node.data)

    return paragraphs.map(paragraph =>
      EG.makeNode(paragraph, Option.some(node.id), Option.some("paragraphize"))
    )
  })
)

/**
 * Normalize Operation
 *
 * Transforms a text node by normalizing whitespace.
 * This is a 1-to-1 operation (endomorphism).
 *
 * Example:
 *   Input: "Hello    world"
 *   Output: "Hello world"
 */
export const normalizeOperation: TextOperation<
  string,
  string,
  NLPService,
  never
> = TC.makeOperation("normalize", (node) =>
  Effect.gen(function* () {
    const nlp = yield* NLPService
    const normalized = yield* nlp.normalizeWhitespace(node.data)

    return [
      EG.makeNode(normalized, Option.some(node.id), Option.some("normalize"))
    ]
  })
)

// =============================================================================
// Forgetful Operations (Aggregation - Many to One)
// =============================================================================

/**
 * Join Operation
 *
 * Aggregates multiple text nodes into a single node by joining with a separator.
 * This is a "forgetful" operation - it collapses structure.
 *
 * Category theory: This is a right adjoint functor (forgetful functor)
 * It forgets the individual structure and creates a single merged node.
 *
 * Example:
 *   Input: ["Hello", "world"]
 *   Output: "Hello world"
 */
export const joinOperation = (
  separator: string = " "
): ForgetfulOperation<string, string, never, never> => ({
  name: `join(${separator})`,
  apply: (nodes) =>
    Effect.succeed(
      EG.makeNode(
        nodes.map(n => n.data).join(separator),
        nodes.length > 0 ? Option.some(nodes[0]!.id) : Option.none(),
        Option.some(`join(${separator})`)
      )
    )
})

/**
 * Concatenate Operation
 *
 * Aggregates multiple text nodes by concatenating without separator.
 * Special case of join with empty separator.
 */
export const concatenateOperation: ForgetfulOperation<
  string,
  string,
  never,
  never
> = joinOperation("")

/**
 * Summary Operation (stub for future enhancement)
 *
 * Aggregates multiple nodes by summarizing their content.
 * In a real system, this would use an LLM or extractive summarization.
 *
 * For now, this takes the first N characters from each node.
 */
export const summaryOperation = (
  maxCharsPerNode: number = 50
): ForgetfulOperation<string, string, never, never> => ({
  name: "summary",
  apply: (nodes) => {
    const summaries = nodes
      .map(n => n.data.slice(0, maxCharsPerNode))
      .join("... ")

    return Effect.succeed(
      EG.makeNode(
        summaries,
        nodes.length > 0 ? Option.some(nodes[0]!.id) : Option.none(),
        Option.some("summary")
      )
    )
  }
})

// =============================================================================
// Composed Operations
// =============================================================================

/**
 * Sentencize then Tokenize
 *
 * A composed operation that first splits into sentences,
 * then splits each sentence into tokens.
 *
 * This demonstrates compositional processing:
 *   text → sentences → tokens
 *
 * Creates a 3-level DAG structure.
 */
export const sentencizeThenTokenize: TextOperation<
  string,
  string,
  NLPService,
  never
> = TC.composeOperations(sentencizeOperation, tokenizeOperation)

// =============================================================================
// Adjunctions (Free-Forgetful Pairs)
// =============================================================================

/**
 * Sentencization Adjunction
 *
 * Pairs the free operation (text → sentences) with the forgetful operation (sentences → text)
 * This captures the fundamental duality of expansion and aggregation.
 *
 * Category theory: This forms an adjunction where:
 * - Left adjoint (Free): Sentencize
 * - Right adjoint (Forgetful): Join
 * - Unit: text → Join(Sentencize(text))
 * - Counit: Sentencize(Join(sentences)) → sentences
 */
export const sentencizationAdjunction = TC.makeAdjunction(
  sentencizeOperation,
  joinOperation(" ")
)

/**
 * Tokenization Adjunction
 *
 * Pairs tokenization with joining.
 */
export const tokenizationAdjunction = TC.makeAdjunction(
  tokenizeOperation,
  joinOperation(" ")
)

// =============================================================================
// Statistics and Analysis Operations
// =============================================================================

/**
 * Word Count Operation
 *
 * Annotates a text node with its word count.
 * Returns a tuple of [text, count].
 */
export const wordCountOperation: TextOperation<
  string,
  { text: string; count: number },
  NLPService,
  never
> = TC.makeOperation("wordCount", (node) =>
  Effect.gen(function* () {
    const nlp = yield* NLPService
    const count = yield* nlp.wordCount(node.data)

    return [
      EG.makeNode(
        { text: node.data, count },
        Option.some(node.id),
        Option.some("wordCount")
      )
    ]
  })
)

/**
 * N-gram Operation
 *
 * Extracts n-grams from text.
 * Creates multiple nodes, one per n-gram.
 */
export const ngramOperation = (
  n: number
): TextOperation<string, string, NLPService, Error> =>
  TC.makeOperation(`${n}-gram`, (node) =>
    Effect.gen(function* () {
      const nlp = yield* NLPService
      const grams = yield* nlp.ngrams(node.data, n)

      return grams.map(gram =>
        EG.makeNode(gram, Option.some(node.id), Option.some(`${n}-gram`))
      )
    })
  )

// =============================================================================
// Filtering Operations
// =============================================================================

/**
 * Filter by Length
 *
 * Keeps only text nodes that satisfy a length predicate.
 * This is useful for removing empty sentences or very short tokens.
 */
export const filterByLength = (
  minLength: number = 1,
  maxLength: number = Infinity
): TextOperation<string, string, never, never> =>
  TC.filterOperation(
    `filter(${minLength}-${maxLength})`,
    text => text.length >= minLength && text.length <= maxLength
  )

/**
 * Filter by Pattern
 *
 * Keeps only text nodes that match a regex pattern.
 */
export const filterByPattern = (
  pattern: RegExp
): TextOperation<string, string, never, never> =>
  TC.filterOperation(`filter(${pattern})`, text => pattern.test(text))

// =============================================================================
// Transformation Operations
// =============================================================================

/**
 * Lowercase Operation
 */
export const lowercaseOperation: TextOperation<string, string, never, never> =
  TC.mapOperation("lowercase", text => text.toLowerCase())

/**
 * Uppercase Operation
 */
export const uppercaseOperation: TextOperation<string, string, never, never> =
  TC.mapOperation("uppercase", text => text.toUpperCase())

/**
 * Trim Operation
 */
export const trimOperation: TextOperation<string, string, never, never> =
  TC.mapOperation("trim", text => text.trim())

// =============================================================================
// Pipeline Builders
// =============================================================================

/**
 * Standard text processing pipeline:
 * 1. Normalize whitespace
 * 2. Split into sentences
 * 3. Filter out empty sentences
 *
 * Returns an array of operations to be executed sequentially.
 */
export const standardPipeline: ReadonlyArray<
  TextOperation<string, string, NLPService, never>
> = [normalizeOperation, sentencizeOperation, filterByLength(1)]

/**
 * Deep tokenization pipeline:
 * 1. Normalize
 * 2. Sentencize
 * 3. Tokenize
 * 4. Filter short tokens
 * 5. Lowercase
 *
 * Creates a 4-level DAG: text → sentences → tokens → normalized tokens
 */
export const deepTokenizationPipeline: ReadonlyArray<
  TextOperation<string, string, NLPService, never>
> = [
  normalizeOperation,
  sentencizeOperation,
  tokenizeOperation,
  filterByLength(1),
  lowercaseOperation
]
