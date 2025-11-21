/**
 * Effect-DSPy: Text Processing as Graph Transformations
 *
 * A functional approach to text processing using Effect-TS and category theory.
 *
 * @module effect-dspy
 */

// Core graph module
export * as EffectGraph from "./EffectGraph.js"
export type {
  EffectGraph as EffectGraphType,
  GraphAlgebra,
  GraphCoalgebra,
  GraphNode,
  NodeId,
  NodeMetadata
} from "./EffectGraph.js"

// Type class abstractions
export * as TypeClass from "./TypeClass.js"
export type { Composable, Foldable, ForgetfulOperation, FreeOperation, TextOperation } from "./TypeClass.js"

// NLP service
export * as NLPService from "./NLPService.js"
export { NLPService as NLPServiceTag, NLPServiceLive } from "./NLPService.js"
export type { NLPService as NLPServiceInterface } from "./NLPService.js"

// Graph operations (production-grade)
export * as GraphOps from "./GraphOps.js"
export type { DirectedGraph, NodeIndex, NodeWalker, SearchIndex, TraversalOrder } from "./GraphOps.js"

// Corpus operations (large-scale processing)
export * as CorpusOps from "./CorpusOps.js"
export type {
  CorpusConfig,
  CorpusStatistics,
  Document,
  ProcessedDocument,
  Progress
} from "./CorpusOps.js"

// Text operations
export * as TextOperations from "./TextOperations.js"

// NLP Backend abstraction
export * as NLPBackend from "./NLPBackend.js"
export type {
  BackendCapabilities,
  BackendInitError,
  BackendNotSupported,
  BackendOperationError,
  NLPBackend as NLPBackendInterface,
  NLPBackendError
} from "./NLPBackend.js"

// NLP Backend implementations
export * as Backends from "./Backends/index.js"

// Annotated Text Graphs
export * as AnnotatedTextGraph from "./AnnotatedTextGraph.js"
export type {
  AnnotatedNode,
  AnnotatedTextGraph as AnnotatedTextGraphType,
  MutableAnnotatedTextGraph
} from "./AnnotatedTextGraph.js"
