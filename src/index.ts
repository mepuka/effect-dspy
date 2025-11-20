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
  NodeId,
  GraphNode,
  NodeMetadata,
  EffectGraph as EffectGraphType,
  GraphAlgebra,
  GraphCoalgebra
} from "./EffectGraph.js"

// Type class abstractions
export * as TypeClass from "./TypeClass.js"
export type {
  TextOperation,
  Composable,
  Foldable,
  FreeOperation,
  ForgetfulOperation
} from "./TypeClass.js"

// NLP service
export * as NLPService from "./NLPService.js"
export { NLPService as NLPServiceTag, NLPServiceLive } from "./NLPService.js"
export type { NLPService as NLPServiceInterface } from "./NLPService.js"

// Text operations
export * as TextOperations from "./TextOperations.js"
