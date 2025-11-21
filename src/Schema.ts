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
   * The type of relationship
   *
   * Structural relations:
   * - contains: Parent-child containment (Document contains Paragraph)
   * - follows: Sequential ordering (Sentence follows Sentence)
   * - derived-from: Transformation lineage (Token derived-from Sentence)
   * - parent-of: Explicit parent relationship
   *
   * Linguistic annotation relations:
   * - tagged-as: Token tagged as POS (Token -> POSNode)
   * - lemma-of: Lemma of token (Token -> LemmaNode)
   * - head-of: Head of dependency arc (Token -> DependencyNode)
   * - dependent-of: Dependent of dependency arc (Token -> DependencyNode)
   * - entity-mention: Entity mention in text (Sentence -> EntityNode)
   * - relates-to: Semantic relation (EntityNode -> RelationNode)
   */
  relation: Schema.Literal(
    "contains",
    "follows",
    "derived-from",
    "parent-of",
    "tagged-as",
    "lemma-of",
    "head-of",
    "dependent-of",
    "entity-mention",
    "relates-to"
  ),
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

// =============================================================================
// Linguistic Annotation Nodes
// =============================================================================

/**
 * Part-of-speech annotation for a token
 *
 * Category theory: Forms a functor Token -> POS that preserves token identity
 * while adding grammatical category information.
 *
 * Example:
 *   { text: "runs", tag: "VBZ", description: "verb, 3rd person singular present" }
 */
export class POSNode extends Schema.Class<POSNode>("POSNode")({
  /**
   * The token text
   */
  text: Schema.String,

  /**
   * POS tag (Penn Treebank tagset: NN, VB, JJ, etc.)
   */
  tag: Schema.String,

  /**
   * Optional detailed POS description
   */
  description: Schema.optional(Schema.String),

  /**
   * Position in sentence (0-indexed)
   */
  position: Schema.Number,

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
 * Named entity extracted from text
 *
 * Category theory: Forms a functor Text -> Entity that extracts
 * semantically meaningful spans with type labels.
 *
 * Example:
 *   { text: "Apple Inc.", entityType: "ORG", span: { start: 0, end: 10 } }
 */
export class EntityNode extends Schema.Class<EntityNode>("EntityNode")({
  /**
   * Entity text span
   */
  text: Schema.String,

  /**
   * Entity type (PERSON, ORG, LOC, GPE, DATE, MONEY, etc.)
   */
  entityType: Schema.String,

  /**
   * Confidence score [0, 1] (optional)
   */
  confidence: Schema.optional(Schema.Number),

  /**
   * Start/end character offsets in source text
   */
  span: Schema.Struct({
    start: Schema.Number,
    end: Schema.Number
  }),

  /**
   * Optional normalized form (e.g., "Apple Inc." -> "Apple")
   */
  normalizedForm: Schema.optional(Schema.String),

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
 * Lemmatized form of a token (canonical/dictionary form)
 *
 * Category theory: Forms a forgetful functor Token -> Lemma
 * that discards inflectional morphology.
 *
 * Algebraic property: Idempotent
 *   lemmatize(lemmatize(x)) = lemmatize(x)
 *
 * Examples:
 *   running -> run
 *   better -> good
 *   was -> be
 */
export class LemmaNode extends Schema.Class<LemmaNode>("LemmaNode")({
  /**
   * Original token text
   */
  token: Schema.String,

  /**
   * Lemmatized (canonical) form
   */
  lemma: Schema.String,

  /**
   * Optional POS tag (lemmatization can be POS-dependent)
   */
  pos: Schema.optional(Schema.String),

  /**
   * Position in sentence (0-indexed)
   */
  position: Schema.Number,

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
 * Syntactic dependency relation between tokens
 *
 * Category theory: Forms a directed graph where nodes are tokens
 * and edges are labeled with grammatical relations.
 *
 * Example:
 *   { relation: "nsubj", head: { text: "runs", position: 2 },
 *     dependent: { text: "dog", position: 1 } }
 */
export class DependencyNode extends Schema.Class<DependencyNode>("DependencyNode")({
  /**
   * Dependency relation type (nsubj, dobj, amod, etc.)
   * Uses Universal Dependencies tagset
   */
  relation: Schema.String,

  /**
   * Head token (governor)
   */
  head: Schema.Struct({
    text: Schema.String,
    position: Schema.Number
  }),

  /**
   * Dependent token
   */
  dependent: Schema.Struct({
    text: Schema.String,
    position: Schema.Number
  }),

  /**
   * Dependency distance (head.position - dependent.position)
   */
  distance: Schema.Number,

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
 * Semantic relation between entities
 *
 * Category theory: Forms a labeled directed graph over entities
 * capturing domain-specific semantic relations.
 *
 * Example:
 *   { relationType: "FOUNDED_BY",
 *     subject: { text: "Apple Inc.", entityType: "ORG" },
 *     object: { text: "Steve Jobs", entityType: "PERSON" } }
 */
export class RelationNode extends Schema.Class<RelationNode>("RelationNode")({
  /**
   * Relation type (FOUNDED_BY, LOCATED_IN, WORKS_FOR, etc.)
   */
  relationType: Schema.String,

  /**
   * Subject entity
   */
  subject: Schema.Struct({
    text: Schema.String,
    entityType: Schema.String,
    span: Schema.Struct({ start: Schema.Number, end: Schema.Number })
  }),

  /**
   * Object entity
   */
  object: Schema.Struct({
    text: Schema.String,
    entityType: Schema.String,
    span: Schema.Struct({ start: Schema.Number, end: Schema.Number })
  }),

  /**
   * Optional trigger/predicate text (the word expressing the relation)
   */
  trigger: Schema.optional(Schema.String),

  /**
   * Confidence score [0, 1] (optional)
   */
  confidence: Schema.optional(Schema.Number),

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
