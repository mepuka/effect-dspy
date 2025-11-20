/**
 * Domain Types using Effect Schema
 *
 * This module defines the core domain types for text processing using Effect Schema.
 * Schema provides validation, parsing, and type-safe serialization.
 */

import * as Schema from "effect/Schema"

/**
 * Text node data stored in the graph.
 * Represents a piece of text with metadata about its processing.
 */
export class TextNode extends Schema.Class<TextNode>("TextNode")({
  /**
   * The actual text content
   */
  text: Schema.String,
  /**
   * The type of text node (e.g., "sentence", "token", "paragraph")
   */
  type: Schema.Literal("sentence", "token", "paragraph", "document"),
  /**
   * Optional metadata about the processing operation
   */
  operation: Schema.optional(Schema.String),
  /**
   * Timestamp when the node was created
   */
  timestamp: Schema.Number,
  /**
   * Additional metadata
   */
  metadata: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown })
  )
}) {}

/**
 * Edge data representing relationships between text nodes.
 */
export class TextEdge extends Schema.Class<TextEdge>("TextEdge")({
  /**
   * The type of relationship (e.g., "contains", "follows", "derived-from")
   */
  relation: Schema.Literal("contains", "follows", "derived-from", "parent-of"),
  /**
   * Optional label for the edge
   */
  label: Schema.optional(Schema.String),
  /**
   * Weight or importance of the relationship
   */
  weight: Schema.optional(Schema.Number)
}) {}

/**
 * NLP analysis result
 */
export class NLPAnalysis extends Schema.Class<NLPAnalysis>("NLPAnalysis")({
  /**
   * Original text
   */
  text: Schema.String,
  /**
   * Sentences detected
   */
  sentences: Schema.Array(Schema.String),
  /**
   * Tokens extracted
   */
  tokens: Schema.Array(Schema.String),
  /**
   * Word count
   */
  wordCount: Schema.Number,
  /**
   * Additional stats
   */
  stats: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Number })
  )
}) {}
