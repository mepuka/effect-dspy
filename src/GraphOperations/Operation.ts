/**
 * GraphOperation - Core abstraction for graph operations
 *
 * A GraphOperation represents a morphism in the category of graphs.
 * It transforms nodes of type A into arrays of nodes of type B.
 *
 * This is the foundation of the entire graph operations system.
 */

import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type { GraphNode } from "../EffectGraph.js"
import * as EG from "../EffectGraph.js"
import type {
  ExecutionMetrics,
  OperationCategory,
  OperationCost,
  ValidationResult
} from "./Types.js"
import * as Types from "./Types.js"

// =============================================================================
// Core Operation Interface
// =============================================================================

/**
 * GraphOperation<A, B, R, E>
 *
 * A categorical morphism in the category of graphs:
 * - A: Input node data type
 * - B: Output node data type
 * - R: Required context/environment
 * - E: Possible error type
 *
 * Mathematical properties:
 * - Composable: Operations can be composed sequentially
 * - Functorial: Operations preserve structure
 * - Monadic: Operations can be chained with flatMap
 */
export interface GraphOperation<A, B, R = never, E = never> {
  /**
   * Unique name for this operation
   */
  readonly name: string

  /**
   * Human-readable description
   */
  readonly description: string

  /**
   * Category of operation
   */
  readonly category: OperationCategory

  /**
   * Apply operation to a single node
   * Returns: Array of child nodes
   *
   * This is the fundamental morphism: Node<A> → Effect<[Node<B>], E, R>
   */
  readonly apply: (
    node: GraphNode<A>
  ) => Effect.Effect<ReadonlyArray<GraphNode<B>>, E, R>

  /**
   * Validate that operation can be applied to this node
   * Returns: Validation result with errors/warnings
   */
  readonly validate: (
    node: GraphNode<A>
  ) => Effect.Effect<ValidationResult, never, never>

  /**
   * Estimate cost of applying operation to this node
   * Returns: Expected time, tokens, memory usage
   */
  readonly estimateCost: (
    node: GraphNode<A>
  ) => Effect.Effect<OperationCost, never, never>
}

// =============================================================================
// Operation Constructors
// =============================================================================

/**
 * Create a GraphOperation from a function
 */
export const make = <A, B, R = never, E = never>(config: {
  readonly name: string
  readonly description: string
  readonly category: OperationCategory
  readonly apply: (
    node: GraphNode<A>
  ) => Effect.Effect<ReadonlyArray<GraphNode<B>>, E, R>
  readonly validate?: (
    node: GraphNode<A>
  ) => Effect.Effect<ValidationResult, never, never>
  readonly estimateCost?: (
    node: GraphNode<A>
  ) => Effect.Effect<OperationCost, never, never>
}): GraphOperation<A, B, R, E> => ({
  name: config.name,
  description: config.description,
  category: config.category,
  apply: config.apply,
  validate:
    config.validate ??
    ((_node) => Effect.succeed(Types.ValidationResult.valid())),
  estimateCost:
    config.estimateCost ?? ((_node) => Effect.succeed(Types.OperationCost.zero()))
})

/**
 * Create a pure operation (no context, no errors)
 */
export const pure = <A, B>(config: {
  readonly name: string
  readonly description: string
  readonly category: OperationCategory
  readonly f: (data: A) => ReadonlyArray<B>
}): GraphOperation<A, B, never, never> =>
  make({
    name: config.name,
    description: config.description,
    category: config.category,
    apply: (node) =>
      Effect.sync(() =>
        config.f(node.data).map((b) =>
          EG.makeNode(b, Option.some(node.id), Option.some(config.name))
        )
      )
  })

/**
 * Create a transformation operation (A → B)
 */
export const transform = <A, B>(config: {
  readonly name: string
  readonly description: string
  readonly f: (data: A) => B
}): GraphOperation<A, B, never, never> =>
  pure({
    ...config,
    category: "transformation",
    f: (data) => [config.f(data)]
  })

/**
 * Create an expansion operation (A → [B])
 */
export const expand = <A, B>(config: {
  readonly name: string
  readonly description: string
  readonly f: (data: A) => ReadonlyArray<B>
}): GraphOperation<A, B, never, never> =>
  pure({
    ...config,
    category: "expansion",
    f: config.f
  })

/**
 * Create a filter operation (A → Option<A>)
 */
export const filter = <A>(config: {
  readonly name: string
  readonly description: string
  readonly predicate: (data: A) => boolean
}): GraphOperation<A, A, never, never> =>
  pure({
    ...config,
    category: "filtering",
    f: (data) => (config.predicate(data) ? [data] : [])
  })

// =============================================================================
// Identity Operation
// =============================================================================

/**
 * Identity operation - returns the same node unchanged
 *
 * Law: id ∘ f = f = f ∘ id
 */
export const identity = <A>(): GraphOperation<A, A, never, never> =>
  make({
    name: "identity",
    description: "Identity operation (no transformation)",
    category: "transformation",
    apply: (node) =>
      Effect.succeed([
        {
          ...node,
          id: EG.NodeId.generate(),
          parentId: Option.some(node.id),
          metadata: {
            ...node.metadata,
            operation: Option.some("identity")
          }
        }
      ])
  })

// =============================================================================
// Basic Combinators
// =============================================================================

/**
 * Map operation - transform data without changing structure
 *
 * Law: map(f ∘ g) = map(f) ∘ map(g)
 */
export const map = <A, B>(
  f: (a: A) => B
): GraphOperation<A, B, never, never> =>
  transform({
    name: "map",
    description: `Map with function`,
    f
  })

/**
 * FlatMap operation - map and flatten
 */
export const flatMap = <A, B>(
  f: (a: A) => ReadonlyArray<B>
): GraphOperation<A, B, never, never> =>
  expand({
    name: "flatMap",
    description: `FlatMap with function`,
    f
  })

// =============================================================================
// Operation Metadata Helpers
// =============================================================================

/**
 * Get operation category
 */
export const getCategory = <A, B, R, E>(
  operation: GraphOperation<A, B, R, E>
): OperationCategory => operation.category

/**
 * Check if operation is pure (no context, no errors)
 */
export const isPure = <A, B, R, E>(
  _operation: GraphOperation<A, B, R, E>
): boolean => {
  // Type-level check - if R = never and E = never, it's pure
  // This is a simplified runtime check
  return true // In practice, check if R and E are never types
}

/**
 * Check if operation is effectful
 */
export const isEffectful = <A, B, R, E>(
  operation: GraphOperation<A, B, R, E>
): boolean => !isPure(operation)
