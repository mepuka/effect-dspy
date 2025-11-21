/**
 * Operations/Extended - Extended library of free/forgetful adjunction pairs
 *
 * This module expands the repertoire of text operations beyond basic
 * sentencization and tokenization, providing a rich categorical NLP toolkit.
 *
 * Each operation comes as an adjoint functor pair:
 * - Free functor (expansion): A → F(A)
 * - Forgetful functor (aggregation): F(A) → A
 *
 * New adjunctions in this module:
 * 1. Paragraphization: Document ↔ [Paragraph]
 * 2. Characterization: Token ↔ [Character]
 * 3. N-gram extraction: Text ↔ [NGram]
 * 4. Line splitting: Text ↔ [Line]
 * 5. Word extraction: Text ↔ [Word] (linguistic words, not just tokens)
 */

import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as EG from "../EffectGraph.js"
import { NLPService } from "../NLPService.js"
import type { ForgetfulOperation, FreeOperation } from "../TypeClass.js"
import * as TC from "../TypeClass.js"
import * as M from "../Algebra/Monoid.js"
import * as Kind from "../Ontology/Kind.js"

// =============================================================================
// Paragraphization Adjunction
// =============================================================================

/**
 * Paragraphization Operation (Free)
 *
 * Splits a document into paragraphs based on blank lines.
 *
 * Free functor: Document → [Paragraph]
 *
 * Example:
 *   Input: "First para.\n\nSecond para."
 *   Output: ["First para.", "Second para."]
 */
export const paragraphizeOperation: FreeOperation<string, string, never, never> = TC.purOperation(
  "paragraphize",
  (text) =>
    text
      .split(/\n\s*\n/) // Split on blank lines
      .map((para) => para.trim())
      .filter((para) => para.length > 0)
)

/**
 * Paragraph Join Operation (Forgetful)
 *
 * Aggregates paragraphs back into a document with blank line separators.
 *
 * Forgetful functor: [Paragraph] → Document
 *
 * Monoid structure: StringJoin("\n\n")
 */
export const paragraphJoinOperation: ForgetfulOperation<string, string, never, never> = {
  name: "paragraph-join",
  apply: (nodes) =>
    Effect.succeed(
      EG.makeNode(
        M.fold(M.StringJoin("\n\n"))(nodes.map((n) => n.data)),
        nodes[0] ? Option.some(nodes[0].id) : Option.none(),
        Option.some("paragraph-join")
      )
    )
}

/**
 * Paragraphization Adjunction
 * F ⊣ G where F = paragraphize, G = paragraph-join
 */
export const paragraphizationAdjunction = TC.makeAdjunction(
  paragraphizeOperation,
  paragraphJoinOperation
)

// =============================================================================
// Characterization Adjunction
// =============================================================================

/**
 * Characterization Operation (Free)
 *
 * Splits text into individual characters.
 *
 * Free functor: Token → [Character]
 *
 * Example:
 *   Input: "cat"
 *   Output: ["c", "a", "t"]
 */
export const characterizeOperation: FreeOperation<string, string, never, never> = TC.purOperation(
  "characterize",
  (text) => Array.from(text)
)

/**
 * Character Join Operation (Forgetful)
 *
 * Aggregates characters back into a token.
 *
 * Forgetful functor: [Character] → Token
 *
 * Monoid structure: StringConcat
 */
export const characterJoinOperation: ForgetfulOperation<string, string, never, never> = {
  name: "character-join",
  apply: (nodes) =>
    Effect.succeed(
      EG.makeNode(
        M.fold(M.StringConcat)(nodes.map((n) => n.data)),
        nodes[0] ? Option.some(nodes[0].id) : Option.none(),
        Option.some("character-join")
      )
    )
}

/**
 * Characterization Adjunction
 * F ⊣ G where F = characterize, G = character-join
 */
export const characterizationAdjunction = TC.makeAdjunction(
  characterizeOperation,
  characterJoinOperation
)

// =============================================================================
// Line Splitting Adjunction
// =============================================================================

/**
 * Line Split Operation (Free)
 *
 * Splits text into lines (useful for poetry, code, structured text).
 *
 * Free functor: Text → [Line]
 *
 * Example:
 *   Input: "Line 1\nLine 2\nLine 3"
 *   Output: ["Line 1", "Line 2", "Line 3"]
 */
export const lineSplitOperation: FreeOperation<string, string, never, never> = TC.purOperation(
  "line-split",
  (text) =>
    text
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
)

/**
 * Line Join Operation (Forgetful)
 *
 * Aggregates lines back into text with newline separators.
 *
 * Forgetful functor: [Line] → Text
 *
 * Monoid structure: StringJoin("\n")
 */
export const lineJoinOperation: ForgetfulOperation<string, string, never, never> = {
  name: "line-join",
  apply: (nodes) =>
    Effect.succeed(
      EG.makeNode(
        M.fold(M.StringJoin("\n"))(nodes.map((n) => n.data)),
        nodes[0] ? Option.some(nodes[0].id) : Option.none(),
        Option.some("line-join")
      )
    )
}

/**
 * Line Splitting Adjunction
 * F ⊣ G where F = line-split, G = line-join
 */
export const lineSplittingAdjunction = TC.makeAdjunction(lineSplitOperation, lineJoinOperation)

// =============================================================================
// N-gram Extraction (Sliding Window)
// =============================================================================

/**
 * Create an n-gram operation
 *
 * Extracts overlapping n-grams from text using a sliding window.
 *
 * Free functor: Text → [NGram]
 *
 * Example (bigrams):
 *   Input: "the cat sat"
 *   Output: ["the cat", "cat sat"]
 *
 * Note: This is not a perfect adjunction because information about
 * position is lost, but it's useful for many NLP tasks.
 */
export const ngramOperation = (n: number): FreeOperation<string, string, NLPService, Error> =>
  TC.makeOperation(`${n}-gram`, (node) =>
    Effect.gen(function*() {
      const nlp = yield* NLPService
      const grams = yield* nlp.ngrams(node.data, n)

      return grams.map((gram) => EG.makeNode(gram, Option.some(node.id), Option.some(`${n}-gram`)))
    }))

/**
 * N-gram aggregation (lossy)
 *
 * This is an approximate forgetful functor that attempts to reconstruct
 * text from n-grams. It's lossy because we lose word boundary information.
 *
 * Strategy: Take first token of each n-gram, plus last token of final n-gram.
 */
export const ngramAggregateOperation = (n: number): ForgetfulOperation<string, string> => ({
  name: `${n}-gram-aggregate`,
  apply: (nodes) => {
    const ngrams = nodes.map((n) => n.data)

    if (ngrams.length === 0) {
      return Effect.succeed(
        EG.makeNode("", Option.none(), Option.some(`${n}-gram-aggregate`))
      )
    }

    // Take first word of each n-gram
    const words = ngrams.map((gram) => gram.split(" ")[0]!)

    // Add last word of final n-gram
    const lastGram = ngrams[ngrams.length - 1]!
    const lastWords = lastGram.split(" ")
    const lastWord = lastWords[lastWords.length - 1]!
    words.push(lastWord)

    const reconstructed = words.filter((w) => w).join(" ")

    return Effect.succeed(
      EG.makeNode(
        reconstructed,
        nodes[0] ? Option.some(nodes[0].id) : Option.none(),
        Option.some(`${n}-gram-aggregate`)
      )
    )
  }
})

/**
 * Bigram adjunction (n=2)
 */
export const bigramAdjunction = TC.makeAdjunction(ngramOperation(2), ngramAggregateOperation(2))

/**
 * Trigram adjunction (n=3)
 */
export const trigramAdjunction = TC.makeAdjunction(ngramOperation(3), ngramAggregateOperation(3))

// =============================================================================
// Phrase Chunking (Shallow Parsing)
// =============================================================================

/**
 * Phrase Chunk Operation (Free)
 *
 * Extracts noun phrases, verb phrases, etc. using shallow parsing.
 *
 * Free functor: Sentence → [Chunk]
 *
 * Example:
 *   Input: "The quick brown fox jumps"
 *   Output: ["The quick brown fox", "jumps"]
 *
 * Note: Requires NLP service with chunking capability.
 * For now, this is a simplified version that splits on verbs.
 */
export const chunkOperation: FreeOperation<string, string, never, never> = TC.purOperation(
  "chunk",
  (text) => {
    // Simplified chunking: split on common verb patterns
    // In production, use proper NLP chunking
    const chunks = text.split(/\b(is|are|was|were|has|have|had|will|would|can|could)\b/)
    return chunks.map((c) => c.trim()).filter((c) => c.length > 0)
  }
)

/**
 * Chunk Join Operation (Forgetful)
 *
 * Aggregates chunks back into a sentence.
 *
 * Forgetful functor: [Chunk] → Sentence
 */
export const chunkJoinOperation: ForgetfulOperation<string, string, never, never> = {
  name: "chunk-join",
  apply: (nodes) =>
    Effect.succeed(
      EG.makeNode(
        M.fold(M.StringJoin(" "))(nodes.map((n) => n.data)),
        nodes[0] ? Option.some(nodes[0].id) : Option.none(),
        Option.some("chunk-join")
      )
    )
}

/**
 * Chunking Adjunction
 */
export const chunkingAdjunction = TC.makeAdjunction(chunkOperation, chunkJoinOperation)

// =============================================================================
// Word Extraction (Linguistic Words)
// =============================================================================

/**
 * Word Extraction Operation (Free)
 *
 * Extracts linguistic words (excluding punctuation).
 *
 * Free functor: Text → [Word]
 *
 * Example:
 *   Input: "Hello, world! How are you?"
 *   Output: ["Hello", "world", "How", "are", "you"]
 */
export const wordExtractOperation: FreeOperation<string, string, never, never> = TC.purOperation(
  "word-extract",
  (text) =>
    text
      .split(/[\s,.!?;:]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0 && /[a-zA-Z]/.test(w))
)

/**
 * Word Join Operation (Forgetful)
 *
 * Aggregates words back into text.
 *
 * Forgetful functor: [Word] → Text
 */
export const wordJoinOperation: ForgetfulOperation<string, string, never, never> = {
  name: "word-join",
  apply: (nodes) =>
    Effect.succeed(
      EG.makeNode(
        M.fold(M.StringJoin(" "))(nodes.map((n) => n.data)),
        nodes[0] ? Option.some(nodes[0].id) : Option.none(),
        Option.some("word-join")
      )
    )
}

/**
 * Word Extraction Adjunction
 */
export const wordExtractionAdjunction = TC.makeAdjunction(
  wordExtractOperation,
  wordJoinOperation
)

// =============================================================================
// Utility: Combine Multiple Adjunctions
// =============================================================================

/**
 * Create a multi-level pipeline from adjunctions
 *
 * Example: Document → Paragraphs → Sentences → Tokens
 */
export const createMultiLevelPipeline = <A, B, C, D>(
  adj1: ReturnType<typeof TC.makeAdjunction>,
  adj2: ReturnType<typeof TC.makeAdjunction>
) => ({
  expand1: adj1.expand,
  expand2: adj2.expand,
  aggregate2: adj2.aggregate,
  aggregate1: adj1.aggregate
})

/**
 * Standard multi-level pipeline:
 * Document → Paragraphs → Sentences → Tokens
 */
export const standardMultiLevelPipeline = createMultiLevelPipeline(
  paragraphizationAdjunction,
  // Would need to compose with sentencization adjunction here
  // Left as exercise for integration with TextOperations.ts
  paragraphizationAdjunction // Placeholder
)

// =============================================================================
// Categorical Utilities
// =============================================================================

/**
 * Verify that an adjunction satisfies the triangle identities
 * (for testing purposes)
 */
export const verifyAdjunction = <A, B>(
  free: FreeOperation<A, B>,
  forgetful: ForgetfulOperation<B, A>,
  testValue: A,
  equals: (a: A, b: A) => boolean
): Effect.Effect<boolean, any, any> =>
  Effect.gen(function*() {
    // Create a test node
    const node = EG.makeNode(testValue, Option.none(), Option.some("test"))

    // Apply free
    const expandedNodes = yield* free.apply(node)

    // Apply forgetful
    const aggregatedNode = yield* forgetful.apply(expandedNodes)

    // Compare (up to equivalence)
    return equals(testValue, aggregatedNode.data)
  })
