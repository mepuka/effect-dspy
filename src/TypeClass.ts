/**
 * TypeClass - Formal abstractions for text processing operations
 *
 * This module defines the type classes (in the functional programming sense)
 * that formalize the behavior of text operations on graphs.
 *
 * Key abstractions:
 * - TextOperation<A, B>: Operations that transform nodes of type A to nodes of type B
 * - Composable: Operations that can be composed (monoid structure)
 * - Foldable: Structures that can be folded (accumulated)
 * - Adjunction: Modeling operations as adjoint functors
 */

import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import type { EffectGraph, GraphNode } from "./EffectGraph.js"
import * as EG from "./EffectGraph.js"

// =============================================================================
// Text Operation Type Class
// =============================================================================

/**
 * TextOperation<A, B, R, E> represents a morphism in the category of graphs:
 *   - Takes a node containing data of type A
 *   - Produces an array of nodes containing data of type B
 *   - Requires context R (like NLP services)
 *   - May fail with error E
 *
 * The key property: Operations produce NEW nodes, creating the next layer of the DAG
 *
 * Categorical interpretation:
 * This is a morphism in the Kleisli category of Effect, where:
 *   - Objects are graph nodes
 *   - Morphisms are A → Effect<[B], E, R>
 */
export interface TextOperation<A, B, R = never, E = never> {
  readonly name: string
  readonly apply: (
    node: GraphNode<A>
  ) => Effect.Effect<ReadonlyArray<GraphNode<B>>, E, R>
}

/**
 * Create a TextOperation from a function
 */
export const makeOperation = <A, B, R = never, E = never>(
  name: string,
  apply: (node: GraphNode<A>) => Effect.Effect<ReadonlyArray<GraphNode<B>>, E, R>
): TextOperation<A, B, R, E> => ({
  name,
  apply
})

/**
 * Pure text operation (no context, no errors)
 */
export const purOperation = <A, B>(
  name: string,
  f: (data: A) => ReadonlyArray<B>
): TextOperation<A, B, never, never> =>
  makeOperation(name, (node) =>
    Effect.succeed(
      f(node.data).map((b) => EG.makeNode(b, Option.some(node.id), Option.some(name)))
    ))

// =============================================================================
// Composable Type Class (Monoid Structure)
// =============================================================================

/**
 * Operations can be composed sequentially
 * This forms a Monoid where:
 * - Binary operation: Sequential composition (f then g)
 * - Identity: The identity operation (no transformation)
 *
 * Laws:
 * 1. Associativity: (f • g) • h = f • (g • h)
 * 2. Identity: id • f = f = f • id
 */
export interface Composable<A, R = never, E = never> {
  readonly compose: <B>(
    first: TextOperation<A, B, R, E>,
    second: TextOperation<B, A, R, E>
  ) => TextOperation<A, A, R, E>
  readonly identity: TextOperation<A, A, never, never>
}

/**
 * Identity operation - returns the same node unchanged
 */
export const identityOperation = <A>(): TextOperation<A, A, never, never> =>
  makeOperation("identity", (node) =>
    Effect.succeed([
      {
        ...node,
        id: EG.NodeId.generate(),
        parentId: Option.some(node.id)
      }
    ]))

/**
 * Compose two operations sequentially
 * The output nodes of the first operation become inputs to the second
 */
export const composeOperations = <A, B, C, R, E>(
  first: TextOperation<A, B, R, E>,
  second: TextOperation<B, C, R, E>
): TextOperation<A, C, R, E> =>
  makeOperation(`${first.name} -> ${second.name}`, (node) =>
    Effect.gen(function*() {
      // Apply first operation
      const intermediateNodes = yield* first.apply(node)

      // Apply second operation to each result
      const results = yield* Effect.all(
        intermediateNodes.map((intermediate) => second.apply(intermediate))
      )

      // Flatten the results
      return results.flat()
    }))

// =============================================================================
// Foldable Type Class
// =============================================================================

/**
 * Foldable represents structures that can be reduced to a single value
 * This is crucial for accumulating results as we walk the graph
 *
 * Laws:
 * 1. fold(f, id, []) = id
 * 2. fold(f, id, [x]) = f(id, x)
 * 3. fold(f, id, xs ++ ys) = f(fold(f, id, xs), fold(f, id, ys))
 */
export interface Foldable<F> {
  readonly fold: <A, B>(
    fa: F,
    algebra: (b: B, a: A) => B,
    initial: B
  ) => B
}

/**
 * Fold over an EffectGraph
 */
export const foldableGraph: Foldable<EffectGraph<any>> = {
  fold: <A, B>(
    graph: EffectGraph<A>,
    algebra: (b: B, a: A) => B,
    initial: B
  ): B => {
    let accumulator = initial
    const nodes = EG.toArray(graph)

    for (const node of nodes) {
      accumulator = algebra(accumulator, node.data)
    }

    return accumulator
  }
}

// =============================================================================
// Graph Transformation Operations
// =============================================================================

/**
 * Execute an operation on a graph, producing a new graph with child nodes
 *
 * This is the fundamental way to apply operations:
 * 1. Find all leaf nodes in the current graph
 * 2. Apply the operation to each leaf
 * 3. Add resulting nodes as children
 * 4. Return the updated graph
 *
 * Category theory: This is a natural transformation between functors
 */
export const executeOperation = <A, B, R, E>(
  graph: EffectGraph<A>,
  operation: TextOperation<A, B, R, E>
): Effect.Effect<EffectGraph<A | B>, E, R> =>
  Effect.gen(function*() {
    // Cast the graph to handle both A and B types
    let resultGraph: EffectGraph<A | B> = graph as EffectGraph<A | B>

    // Get all current leaf nodes
    const leafNodes = getLeafNodes(graph)

    // Apply operation to each leaf node
    for (const leafNode of leafNodes) {
      const newNodes = yield* operation.apply(leafNode)

      // Add each new node to the graph
      for (const newNode of newNodes) {
        resultGraph = EG.addNode(resultGraph, newNode as GraphNode<A | B>)
      }
    }

    return resultGraph
  })

/**
 * Get all leaf nodes (nodes with no children) in the graph
 */
const getLeafNodes = <A>(graph: EffectGraph<A>): ReadonlyArray<GraphNode<A>> => {
  const allNodes = EG.toArray(graph)
  return allNodes.filter((node: GraphNode<A>) => EG.getChildren(graph, node.id).length === 0)
}

/**
 * Execute a sequence of operations on a graph
 * This creates multiple layers in the DAG, one per operation
 */
export const executeOperations = <A, R, E>(
  graph: EffectGraph<A>,
  operations: ReadonlyArray<TextOperation<any, any, R, E>>
): Effect.Effect<EffectGraph<any>, E, R> =>
  Effect.gen(function*() {
    let currentGraph: EffectGraph<any> = graph

    for (const operation of operations) {
      currentGraph = yield* executeOperation(currentGraph, operation)
    }

    return currentGraph
  })

// =============================================================================
// Adjunction Modeling
// =============================================================================

/**
 * Adjunction: A pair of functors (F, G) with natural transformations
 * - unit: A → G(F(A))
 * - counit: F(G(A)) → A
 *
 * For text operations, we model:
 * - F: "Free" functor - expands one node into many (e.g., text → sentences)
 * - G: "Forgetful" functor - combines many nodes into one (e.g., sentences → text)
 *
 * The adjunction models the fact that expansion and aggregation are dual operations
 */

/**
 * Free functor: Expands a single node into multiple nodes
 * This is the "expansion" direction (one-to-many)
 */
export type FreeOperation<A, B, R = never, E = never> = TextOperation<
  A,
  B,
  R,
  E
>

/**
 * Forgetful functor: Combines multiple nodes into a single node
 * This is the "aggregation" direction (many-to-one)
 */
export interface ForgetfulOperation<A, B, R = never, E = never> {
  readonly name: string
  readonly apply: (
    nodes: ReadonlyArray<GraphNode<A>>
  ) => Effect.Effect<GraphNode<B>, E, R>
}

/**
 * Create an adjunction pair for a text operation
 * Given an expansion operation (text → sentences), create the dual aggregation (sentences → text)
 */
export const makeAdjunction = <A, B, R, E>(
  free: FreeOperation<A, B, R, E>,
  forgetful: ForgetfulOperation<B, A, R, E>
): {
  readonly expand: FreeOperation<A, B, R, E>
  readonly aggregate: ForgetfulOperation<B, A, R, E>
} => ({
  expand: free,
  aggregate: forgetful
})

// =============================================================================
// Utility Operations
// =============================================================================

/**
 * Map operation: Transform the data in nodes without changing structure
 * This is a functor map lifted to operations
 */
export const mapOperation = <A, B>(
  name: string,
  f: (a: A) => B
): TextOperation<A, B, never, never> => purOperation(name, (a) => [f(a)])

/**
 * Filter operation: Keep only nodes that satisfy a predicate
 */
export const filterOperation = <A>(
  name: string,
  predicate: (a: A) => boolean
): TextOperation<A, A, never, never> => purOperation(name, (a) => (predicate(a) ? [a] : []))

/**
 * FlatMap operation: Map and flatten in one step
 */
export const flatMapOperation = <A, B>(
  name: string,
  f: (a: A) => ReadonlyArray<B>
): TextOperation<A, B, never, never> => purOperation(name, f)

/**
 * Traverse the graph and collect all data values
 */
export const collectData = <A>(graph: EffectGraph<A>): ReadonlyArray<A> =>
  EG.toArray(graph).map((node: GraphNode<A>) => node.data)

/**
 * Get the depth of the graph (longest path from root to leaf)
 */
export const depth = <A>(graph: EffectGraph<A>): number => {
  const nodes = EG.toArray(graph)
  return nodes.reduce((max: number, node: GraphNode<A>) => Math.max(max, node.metadata.depth), 0)
}

// =============================================================================
// Functor Instance for TextOperation
// =============================================================================

/**
 * Functor instance for TextOperation
 *
 * A Functor provides a `map` operation that transforms the output type
 * while preserving the structure.
 *
 * Laws:
 * 1. Identity: map(id) = id
 * 2. Composition: map(f ∘ g) = map(f) ∘ map(g)
 *
 * Category theory: TextOperation forms a functor from the category of types
 * to the Kleisli category of Effect.
 */
export interface Functor<F> {
  readonly map: <A, B>(fa: F, f: (a: A) => B) => F
}

/**
 * Map over the output of a TextOperation
 *
 * This transforms the data in the output nodes without changing the
 * graph structure or effects.
 *
 * Example:
 *   tokenizeOperation :: TextOperation<string, string>
 *   uppercaseOperation = map(tokenizeOperation, s => s.toUpperCase())
 *   // uppercaseOperation :: TextOperation<string, string>
 */
export const map = <A, B, C, R, E>(
  operation: TextOperation<A, B, R, E>,
  f: (b: B) => C
): TextOperation<A, C, R, E> =>
  makeOperation(`${operation.name} |> map`, (node) =>
    Effect.map(operation.apply(node), (nodes) =>
      nodes.map((n) => ({
        ...n,
        data: f(n.data)
      }))
    ))

/**
 * Map over TextOperation using Effect
 *
 * Allows mapping with effectful functions.
 *
 * Example:
 *   flatMap(tokenizeOperation, token => Effect.succeed(token.toUpperCase()))
 */
export const flatMap = <A, B, C, R1, E1, R2, E2>(
  operation: TextOperation<A, B, R1, E1>,
  f: (b: B) => Effect.Effect<C, E2, R2>
): TextOperation<A, C, R1 | R2, E1 | E2> =>
  makeOperation(`${operation.name} |> flatMap`, (node) =>
    Effect.flatMap(operation.apply(node), (nodes) =>
      Effect.all(
        nodes.map((n) =>
          Effect.map(f(n.data), (newData) => ({
            ...n,
            data: newData
          }))
        )
      )
    ))

// =============================================================================
// Applicative Instance for TextOperation
// =============================================================================

/**
 * Apply a TextOperation that produces functions to a TextOperation that produces values
 *
 * This enables parallel composition of operations.
 *
 * Category theory: TextOperation forms an applicative functor, allowing
 * independent effects to be composed.
 */
export const ap = <A, B, C, R1, E1, R2, E2>(
  opFn: TextOperation<A, (b: B) => C, R1, E1>,
  opVal: TextOperation<A, B, R2, E2>
): TextOperation<A, C, R1 | R2, E1 | E2> =>
  makeOperation(`ap(${opFn.name}, ${opVal.name})`, (node) =>
    Effect.gen(function*() {
      const fnNodes = yield* opFn.apply(node)
      const valNodes = yield* opVal.apply(node)

      // Apply each function to each value (Cartesian product)
      const results: Array<GraphNode<C>> = []

      for (const fnNode of fnNodes) {
        for (const valNode of valNodes) {
          results.push({
            ...valNode,
            data: fnNode.data(valNode.data)
          })
        }
      }

      return results
    }))

/**
 * Lift a pure value into a TextOperation
 *
 * Creates an operation that always produces the given value.
 */
export const pure = <A, B>(value: B): TextOperation<A, B, never, never> =>
  makeOperation("pure", (node) =>
    Effect.succeed([
      EG.makeNode(value, Option.some(node.id), Option.some("pure"))
    ]))

// =============================================================================
// Monad Instance for TextOperation
// =============================================================================

/**
 * Monad instance for TextOperation
 *
 * A Monad extends Functor and Applicative with `flatMap` (bind),
 * allowing sequencing of dependent operations.
 *
 * Laws:
 * 1. Left identity: flatMap(pure(a), f) = f(a)
 * 2. Right identity: flatMap(m, pure) = m
 * 3. Associativity: flatMap(flatMap(m, f), g) = flatMap(m, x => flatMap(f(x), g))
 *
 * Category theory: TextOperation is a monad in the category of Effect types.
 */
export const chain = <A, B, C, R1, E1, R2, E2>(
  operation: TextOperation<A, B, R1, E1>,
  f: (b: B) => TextOperation<B, C, R2, E2>
): TextOperation<A, C, R1 | R2, E1 | E2> =>
  makeOperation(`${operation.name} >>= chain`, (node) =>
    Effect.gen(function*() {
      // Apply first operation
      const intermediateNodes = yield* operation.apply(node)

      // Apply second operation to each intermediate node
      const results: Array<GraphNode<C>> = []

      for (const intermediate of intermediateNodes) {
        const secondOp = f(intermediate.data)
        const outputNodes = yield* secondOp.apply(intermediate)
        results.push(...outputNodes)
      }

      return results
    }))

/**
 * Flatten nested TextOperations
 *
 * Note: This is a simplified version that works when you have nested operations.
 * For full monad behavior, use chain directly.
 */
export const flatten = <A, B, C, R1, E1, R2, E2>(
  operation: TextOperation<A, B, R1, E1>,
  getInnerOp: (b: B) => TextOperation<B, C, R2, E2>
): TextOperation<A, C, R1 | R2, E1 | E2> =>
  chain(operation, getInnerOp)

// =============================================================================
// Alternative Instance (for combining operations)
// =============================================================================

/**
 * Combine two TextOperations, producing results from both
 *
 * This is useful for parallel branching: apply both operations
 * and collect all results.
 *
 * Example:
 *   alt(tokenizeOperation, ngramOperation(2))
 *   // Produces both tokens and bigrams
 */
export const alt = <A, B, R1, E1, R2, E2>(
  op1: TextOperation<A, B, R1, E1>,
  op2: TextOperation<A, B, R2, E2>
): TextOperation<A, B, R1 | R2, E1 | E2> =>
  makeOperation(`alt(${op1.name}, ${op2.name})`, (node) =>
    Effect.gen(function*() {
      const results1 = yield* op1.apply(node)
      const results2 = yield* op2.apply(node)

      return [...results1, ...results2]
    }))

/**
 * Empty operation (produces no nodes)
 *
 * This is the identity for `alt`.
 */
export const empty = <A, B>(): TextOperation<A, B, never, never> =>
  makeOperation("empty", () => Effect.succeed([]))

// =============================================================================
// Traversable Instance
// =============================================================================

/**
 * Traverse a TextOperation with an effectful function
 *
 * This allows you to apply an effect to each output node.
 *
 * Category theory: This witnesses that TextOperation is a traversable functor.
 */
export const traverse = <A, B, C, R1, E1, R2, E2>(
  operation: TextOperation<A, B, R1, E1>,
  f: (b: B) => Effect.Effect<C, E2, R2>
): TextOperation<A, C, R1 | R2, E1 | E2> =>
  makeOperation(`${operation.name} |> traverse`, (node) =>
    Effect.flatMap(operation.apply(node), (nodes) =>
      Effect.all(
        nodes.map((n) =>
          Effect.map(f(n.data), (newData) => ({
            ...n,
            data: newData
          }))
        )
      )
    ))

// =============================================================================
// Utility Combinators
// =============================================================================

/**
 * Replicate an operation n times and collect results
 *
 * Example:
 *   replicate(tokenizeOperation, 3)
 *   // Apply tokenization 3 times and collect all tokens
 */
export const replicate = <A, B, R, E>(
  operation: TextOperation<A, B, R, E>,
  n: number
): TextOperation<A, B, R, E> =>
  makeOperation(`replicate(${operation.name}, ${n})`, (node) =>
    Effect.gen(function*() {
      const results: Array<GraphNode<B>> = []

      for (let i = 0; i < n; i++) {
        const nodes = yield* operation.apply(node)
        results.push(...nodes)
      }

      return results
    }))

/**
 * Apply operation only if predicate holds
 *
 * Otherwise, return empty.
 */
export const when = <A, B, R, E>(
  predicate: (a: A) => boolean,
  operation: TextOperation<A, B, R, E>
): TextOperation<A, B, R, E> =>
  makeOperation(`when(${operation.name})`, (node) =>
    predicate(node.data) ? operation.apply(node) : Effect.succeed([]))

/**
 * Apply operation unless predicate holds
 */
export const unless = <A, B, R, E>(
  predicate: (a: A) => boolean,
  operation: TextOperation<A, B, R, E>
): TextOperation<A, B, R, E> => when((a) => !predicate(a), operation)
