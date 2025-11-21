/**
 * NLPBackend - Abstract interface for pluggable NLP backends
 *
 * This module defines the abstract interface that all NLP backends must implement,
 * enabling the system to work with different NLP libraries (Wink, CoreNLP, spaCy, etc.)
 * while maintaining a consistent API.
 *
 * Category theory: This forms a category where:
 * - Objects are NLP backends (Wink, CoreNLP, spaCy)
 * - Morphisms are backend transformations (wrappers, adapters)
 * - Composition allows fallback strategies
 */

import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Context from "effect/Context"
import * as S from "./Schema.js"

// =============================================================================
// Backend Errors
// =============================================================================

/**
 * Error indicating that a backend doesn't support a requested operation
 *
 * Example: Wink lite doesn't support dependency parsing
 */
export class BackendNotSupported extends Data.TaggedError("BackendNotSupported")<{
  readonly backend: string
  readonly operation: string
  readonly message?: string
}> {}

/**
 * Error indicating that a backend failed to initialize
 */
export class BackendInitError extends Data.TaggedError("BackendInitError")<{
  readonly backend: string
  readonly cause: unknown
}> {}

/**
 * Error indicating that a backend operation failed
 */
export class BackendOperationError extends Data.TaggedError("BackendOperationError")<{
  readonly backend: string
  readonly operation: string
  readonly cause: unknown
}> {}

/**
 * Union of all backend errors
 */
export type NLPBackendError = BackendNotSupported | BackendInitError | BackendOperationError

// =============================================================================
// Backend Capabilities
// =============================================================================

/**
 * Capabilities that a backend may or may not support
 *
 * This allows runtime capability detection and graceful degradation.
 */
export interface BackendCapabilities {
  /**
   * Basic tokenization (word segmentation)
   */
  readonly tokenization: boolean

  /**
   * Sentence boundary detection
   */
  readonly sentencization: boolean

  /**
   * Part-of-speech tagging
   */
  readonly posTagging: boolean

  /**
   * Lemmatization (morphological normalization)
   */
  readonly lemmatization: boolean

  /**
   * Named entity recognition (PERSON, ORG, LOC, etc.)
   */
  readonly ner: boolean

  /**
   * Dependency parsing (syntactic structure)
   */
  readonly dependencyParsing: boolean

  /**
   * Semantic relation extraction
   */
  readonly relationExtraction: boolean

  /**
   * Coreference resolution (entity mention linking)
   */
  readonly coreferenceResolution: boolean

  /**
   * Constituency parsing (phrase structure)
   */
  readonly constituencyParsing: boolean
}

// =============================================================================
// Backend Interface
// =============================================================================

/**
 * Abstract NLP backend interface
 *
 * All NLP backends must implement this interface. Operations that a backend
 * doesn't support should return Effect.fail(new BackendNotSupported(...)).
 *
 * Backends should be:
 * - Pure: No side effects except those captured in Effect
 * - Type-safe: Use Effect Schema for validation
 * - Composable: Can be combined with other backends
 */
export interface NLPBackend {
  /**
   * Backend name (e.g., "wink-nlp", "stanford-corenlp", "spacy")
   */
  readonly name: string

  /**
   * Capabilities this backend supports
   */
  readonly capabilities: BackendCapabilities

  // =========================================================================
  // Core Operations
  // =========================================================================

  /**
   * Split text into tokens (words)
   *
   * Category theory: Free functor Text -> [Token]
   */
  readonly tokenize: (text: string) => Effect.Effect<ReadonlyArray<string>, NLPBackendError>

  /**
   * Split text into sentences
   *
   * Category theory: Free functor Text -> [Sentence]
   */
  readonly sentencize: (text: string) => Effect.Effect<ReadonlyArray<string>, NLPBackendError>

  // =========================================================================
  // Linguistic Annotation Operations
  // =========================================================================

  /**
   * Tag tokens with part-of-speech labels
   *
   * Category theory: Functor [Token] -> [POSNode]
   * Algebraic property: Preserves token count
   */
  readonly posTag: (text: string) => Effect.Effect<ReadonlyArray<S.POSNode>, NLPBackendError>

  /**
   * Lemmatize tokens to canonical forms
   *
   * Category theory: Forgetful functor [Token] -> [Lemma]
   * Algebraic property: Idempotent
   */
  readonly lemmatize: (text: string) => Effect.Effect<ReadonlyArray<S.LemmaNode>, NLPBackendError>

  /**
   * Extract named entities from text
   *
   * Category theory: Functor Text -> [Entity]
   */
  readonly extractEntities: (
    text: string
  ) => Effect.Effect<ReadonlyArray<S.EntityNode>, NLPBackendError>

  // =========================================================================
  // Advanced Operations (Optional - may not be supported by all backends)
  // =========================================================================

  /**
   * Parse syntactic dependencies between tokens
   *
   * Category theory: Functor Sentence -> Graph<Token, Dependency>
   *
   * NOTE: Not all backends support this. Wink lite does not.
   */
  readonly parseDependencies: (
    sentence: string
  ) => Effect.Effect<ReadonlyArray<S.DependencyNode>, NLPBackendError>

  /**
   * Extract semantic relations between entities
   *
   * NOTE: Not all backends support this.
   */
  readonly extractRelations: (
    text: string
  ) => Effect.Effect<ReadonlyArray<S.RelationNode>, NLPBackendError>
}

/**
 * Context tag for NLPBackend
 */
export const NLPBackend = Context.GenericTag<NLPBackend>("NLPBackend")

// =============================================================================
// Backend Utilities
// =============================================================================

/**
 * Check if a backend supports a specific capability
 */
export const supportsCapability = (
  backend: NLPBackend,
  capability: keyof BackendCapabilities
): boolean => backend.capabilities[capability]

/**
 * Get all supported capabilities of a backend
 */
export const getSupportedCapabilities = (
  backend: NLPBackend
): ReadonlyArray<keyof BackendCapabilities> =>
  (Object.keys(backend.capabilities) as Array<keyof BackendCapabilities>).filter(
    (cap) => backend.capabilities[cap]
  )

/**
 * Create a BackendNotSupported error
 */
export const notSupported = (backend: string, operation: string, message?: string) =>
  new BackendNotSupported({ backend, operation, message })

/**
 * Create a BackendInitError
 */
export const initError = (backend: string, cause: unknown) =>
  new BackendInitError({ backend, cause })

/**
 * Create a BackendOperationError
 */
export const operationError = (backend: string, operation: string, cause: unknown) =>
  new BackendOperationError({ backend, operation, cause })
