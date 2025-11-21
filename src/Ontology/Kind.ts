/**
 * Ontology/Kind - Type-level ontology for text processing categories
 *
 * This module makes the categorical structure explicit by defining:
 * - TextKind: The objects in our category of discourse
 * - TypedText<K>: Payloads tagged with their ontological kind
 * - Smart constructors: Safe ways to create typed text
 * - Kind relations: The partial order structure (what contains what)
 *
 * Category theory: This defines the object universe of our category, where:
 * - Objects are textual strata (Document, Paragraph, Sentence, Token, etc.)
 * - Morphisms (defined elsewhere) are operations between these strata
 * - The kind system enforces valid transformations at compile time
 *
 * Theoretical foundation:
 * - Kinds form a poset under the "contains" relation
 * - Free operations increase granularity (move down the poset)
 * - Forgetful operations decrease granularity (move up the poset)
 */

import { Schema } from "effect"

// =============================================================================
// Core Kind System
// =============================================================================

/**
 * Textual strata in the NLP category
 *
 * This represents the object layer in our category, forming a poset under
 * the "contains" relation:
 *
 *   Document > Paragraph > Sentence > Token > Character
 *
 * Additionally, we have orthogonal kinds for semantic extractions:
 * - Entity: Named entities (from NER)
 * - Relation: Semantic relations between entities
 * - Embedding: Vector space representations
 * - Dependency: Syntactic dependency arcs
 */
export type TextKind =
  // Structural hierarchy (poset under containment)
  | "Document"
  | "Paragraph"
  | "Sentence"
  | "Token"
  | "Character"
  // Linguistic annotations (orthogonal to structural hierarchy)
  | "POS" // Part-of-speech tagged token
  | "Lemma" // Lemmatized (canonical) form of token
  | "Entity" // Named entities (PERSON, ORG, LOC, etc.)
  | "Relation" // Semantic relations (subject-verb-object, etc.)
  | "Dependency" // Syntactic dependency arc (head-relation-dependent)
  | "Chunk" // Shallow parsing chunks (NP, VP, etc.)
  | "Embedding" // Vector representation in semantic space

/**
 * Schema for TextKind (for validation and serialization)
 * Uses Schema.Union for better type safety and extensibility
 */
export const TextKindSchema = Schema.Union(
  Schema.Literal("Document"),
  Schema.Literal("Paragraph"),
  Schema.Literal("Sentence"),
  Schema.Literal("Token"),
  Schema.Literal("Character"),
  Schema.Literal("POS"),
  Schema.Literal("Lemma"),
  Schema.Literal("Entity"),
  Schema.Literal("Relation"),
  Schema.Literal("Dependency"),
  Schema.Literal("Chunk"),
  Schema.Literal("Embedding")
)

// =============================================================================
// Typed Text Payload
// =============================================================================

/**
 * TypedText<K> - Text content tagged with its ontological kind
 *
 * This pairs raw content with its position in the categorical hierarchy,
 * enabling type-level enforcement of valid operations.
 *
 * Category theory interpretation:
 * - The kind K marks which object in the category this data belongs to
 * - Operations must respect kind transitions (enforced by types)
 *
 * @typeParam K - The ontological kind (position in the category)
 */
export interface TypedText<K extends TextKind> {
  readonly kind: K
  readonly content: string
  readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * Schema for TypedText (runtime validation)
 */
export const TypedTextSchema = <K extends TextKind>(kind: Schema.Schema<K>) =>
  Schema.Struct({
    kind,
    content: Schema.String,
    metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
  })

// =============================================================================
// Smart Constructors
// =============================================================================

/**
 * Create a Document-level typed text
 * Documents are the top level of the structural hierarchy.
 *
 * Example:
 *   const doc = Document("This is a document. It has sentences.")
 */
export const Document = (
  content: string,
  metadata?: Record<string, unknown>
): TypedText<"Document"> => ({
  kind: "Document",
  content,
  ...(metadata !== undefined ? { metadata } : {})
})

/**
 * Create a Paragraph-level typed text
 * Paragraphs are logical groupings within documents.
 */
export const Paragraph = (
  content: string,
  metadata?: Record<string, unknown>
): TypedText<"Paragraph"> => ({
  kind: "Paragraph",
  content,
  ...(metadata !== undefined ? { metadata } : {})
})

/**
 * Create a Sentence-level typed text
 * Sentences are the fundamental units of meaning in most NLP tasks.
 */
export const Sentence = (
  content: string,
  metadata?: Record<string, unknown>
): TypedText<"Sentence"> => ({
  kind: "Sentence",
  content,
  ...(metadata !== undefined ? { metadata } : {})
})

/**
 * Create a Token-level typed text
 * Tokens are individual words or punctuation marks.
 */
export const Token = (
  content: string,
  metadata?: Record<string, unknown>
): TypedText<"Token"> => ({
  kind: "Token",
  content,
  ...(metadata !== undefined ? { metadata } : {})
})

/**
 * Create a Character-level typed text
 * Characters are the atomic elements of text.
 */
export const Character = (
  content: string,
  metadata?: Record<string, unknown>
): TypedText<"Character"> => ({
  kind: "Character",
  content,
  ...(metadata !== undefined ? { metadata } : {})
})

/**
 * Create an Entity-level typed text
 * Entities are named entities extracted via NER.
 *
 * Example:
 *   const entity = Entity("Apple Inc.", { type: "ORG", confidence: 0.95 })
 */
export const Entity = (
  content: string,
  metadata?: Record<string, unknown>
): TypedText<"Entity"> => ({
  kind: "Entity",
  content,
  ...(metadata !== undefined ? { metadata } : {})
})

/**
 * Create a Relation-level typed text
 * Relations are semantic connections between entities.
 *
 * Example:
 *   const rel = Relation("founded", {
 *     subject: "Steve Jobs",
 *     object: "Apple Inc.",
 *     type: "FOUNDER_OF"
 *   })
 */
export const Relation = (
  content: string,
  metadata?: Record<string, unknown>
): TypedText<"Relation"> => ({
  kind: "Relation",
  content,
  ...(metadata !== undefined ? { metadata } : {})
})

/**
 * Create an Embedding-level typed text
 * Embeddings are vector space representations.
 *
 * Example:
 *   const emb = Embedding("apple", {
 *     vector: [0.1, 0.2, ...],
 *     model: "word2vec"
 *   })
 */
export const Embedding = (
  content: string,
  metadata?: Record<string, unknown>
): TypedText<"Embedding"> => ({
  kind: "Embedding",
  content,
  ...(metadata !== undefined ? { metadata } : {})
})

/**
 * Create a Dependency-level typed text
 * Dependencies represent syntactic arcs in dependency grammar.
 *
 * Example:
 *   const dep = Dependency("nsubj", {
 *     head: "runs",
 *     dependent: "dog",
 *     relation: "nsubj"
 *   })
 */
export const Dependency = (
  content: string,
  metadata?: Record<string, unknown>
): TypedText<"Dependency"> => ({
  kind: "Dependency",
  content,
  ...(metadata !== undefined ? { metadata } : {})
})

/**
 * Create a Chunk-level typed text
 * Chunks are shallow parsing constituents (NP, VP, etc.).
 */
export const Chunk = (
  content: string,
  metadata?: Record<string, unknown>
): TypedText<"Chunk"> => ({
  kind: "Chunk",
  content,
  ...(metadata !== undefined ? { metadata } : {})
})

/**
 * Create a POS-level typed text
 * POS tags are part-of-speech annotations.
 *
 * Example:
 *   const pos = POS("dog", { tag: "NN", description: "noun, singular" })
 */
export const POS = (
  content: string,
  metadata?: Record<string, unknown>
): TypedText<"POS"> => ({
  kind: "POS",
  content,
  ...(metadata !== undefined ? { metadata } : {})
})

/**
 * Create a Lemma-level typed text
 * Lemmas are canonical (dictionary) forms of tokens.
 *
 * Example:
 *   const lemma = Lemma("run", { original: "running" })
 */
export const Lemma = (
  content: string,
  metadata?: Record<string, unknown>
): TypedText<"Lemma"> => ({
  kind: "Lemma",
  content,
  ...(metadata !== undefined ? { metadata } : {})
})

// =============================================================================
// Kind Relations (Partial Order Structure)
// =============================================================================

/**
 * Structural containment hierarchy
 * Defines which kinds can contain which other kinds.
 *
 * This forms a poset (partially ordered set) where A > B means "A contains B".
 */
export type KindContainment = {
  readonly Document: ["Paragraph", "Sentence"]
  readonly Paragraph: ["Sentence"]
  readonly Sentence: ["Token", "Chunk", "Dependency", "Entity", "Relation"]
  readonly Token: ["Character", "POS", "Lemma"]
  readonly Character: []
  readonly POS: []
  readonly Lemma: []
  readonly Entity: []
  readonly Relation: []
  readonly Dependency: []
  readonly Chunk: ["Token"]
  readonly Embedding: []
}

/**
 * Check if kind K1 can contain kind K2
 * Used for validation of graph structures.
 */
export const canContain = <K1 extends TextKind, K2 extends TextKind>(
  parent: K1,
  child: K2
): boolean => {
  const containment: KindContainment = {
    Document: ["Paragraph", "Sentence"],
    Paragraph: ["Sentence"],
    Sentence: ["Token", "Chunk", "Dependency", "Entity", "Relation"],
    Token: ["Character", "POS", "Lemma"],
    Character: [],
    POS: [],
    Lemma: [],
    Entity: [],
    Relation: [],
    Dependency: [],
    Chunk: ["Token"],
    Embedding: []
  }

  return (containment[parent] as ReadonlyArray<TextKind>).includes(child)
}

/**
 * Get all valid child kinds for a given parent kind
 */
export const getValidChildren = <K extends TextKind>(
  kind: K
): ReadonlyArray<TextKind> => {
  const containment: KindContainment = {
    Document: ["Paragraph", "Sentence"],
    Paragraph: ["Sentence"],
    Sentence: ["Token", "Chunk", "Dependency", "Entity", "Relation"],
    Token: ["Character", "POS", "Lemma"],
    Character: [],
    POS: [],
    Lemma: [],
    Entity: [],
    Relation: [],
    Dependency: [],
    Chunk: ["Token"],
    Embedding: []
  }

  return containment[kind]
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Extract raw content from typed text
 */
export const content = <K extends TextKind>(text: TypedText<K>): string => text.content

/**
 * Get the kind of a typed text
 */
export const kindOf = <K extends TextKind>(text: TypedText<K>): K => text.kind

/**
 * Map over the content of typed text, preserving kind
 */
export const mapContent = <K extends TextKind>(
  text: TypedText<K>,
  f: (content: string) => string
): TypedText<K> => ({
  ...text,
  content: f(text.content)
})

/**
 * Update metadata of typed text
 */
export const withMetadata = <K extends TextKind>(
  text: TypedText<K>,
  metadata: Record<string, unknown>
): TypedText<K> => ({
  ...text,
  metadata: { ...text.metadata, ...metadata }
})

/**
 * Type guard: Check if a value is a TypedText of a specific kind
 */
export const isKind = <K extends TextKind>(
  kind: K
): (value: TypedText<TextKind>) => value is TypedText<K> => {
  return (value): value is TypedText<K> => value.kind === kind
}

/**
 * Unsafe cast between kinds (use with caution!)
 * Only use when you know the kind transition is semantically valid.
 */
export const unsafeCast = <K extends TextKind>(
  text: TypedText<any>,
  newKind: K
): TypedText<K> => ({
  ...text,
  kind: newKind
})
