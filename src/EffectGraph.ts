/**
 * EffectGraph - A categorical approach to text processing as graph transformations
 *
 * This module models text processing operations as morphisms in a category where:
 * - Objects are nodes in a directed acyclic graph (DAG)
 * - Morphisms are operations that transform nodes, potentially creating children
 * - Composition is guaranteed to preserve the DAG property
 *
 * Key theoretical foundations:
 * - Catamorphism: Bottom-up fold over the graph structure
 * - F-Algebra: (F a → a) for defining operations
 * - Adjunction: Operations form adjoint functors between categories of nodes
 */

import * as Effect from "effect/Effect"
import * as Array from "effect/Array"
import * as HashMap from "effect/HashMap"
import * as HashSet from "effect/HashSet"
import * as Option from "effect/Option"

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * Unique identifier for graph nodes
 */
export type NodeId = string & { readonly _brand: "NodeId" }

export const NodeId = {
  make: (id: string): NodeId => id as NodeId,
  generate: (): NodeId => NodeId.make(crypto.randomUUID())
}

/**
 * A node in the directed acyclic graph containing:
 * - Unique identifier
 * - Data payload of type A
 * - Optional parent reference (for DAG structure)
 * - Metadata for tracking operations
 */
export interface GraphNode<A> {
  readonly id: NodeId
  readonly data: A
  readonly parentId: Option.Option<NodeId>
  readonly metadata: NodeMetadata
}

export interface NodeMetadata {
  readonly operation: Option.Option<string>
  readonly timestamp: number
  readonly depth: number
}

/**
 * The EffectGraph represents a directed acyclic graph where:
 * - nodes: HashMap mapping NodeId to GraphNode
 * - roots: Set of root node IDs (nodes with no parents)
 * - children: Adjacency map for efficient traversal
 */
export interface EffectGraph<A> {
  readonly nodes: HashMap.HashMap<NodeId, GraphNode<A>>
  readonly roots: HashSet.HashSet<NodeId>
  readonly children: HashMap.HashMap<NodeId, HashSet.HashSet<NodeId>>
}

// =============================================================================
// Constructors
// =============================================================================

/**
 * Create a new GraphNode with the given data
 */
export const makeNode = <A>(
  data: A,
  parentId: Option.Option<NodeId> = Option.none(),
  operation: Option.Option<string> = Option.none()
): GraphNode<A> => ({
  id: NodeId.generate(),
  data,
  parentId,
  metadata: {
    operation,
    timestamp: Date.now(),
    depth: Option.match(parentId, {
      onNone: () => 0,
      onSome: () => 1 // Will be recalculated when added to graph
    })
  }
})

/**
 * Create an empty EffectGraph
 */
export const empty = <A>(): EffectGraph<A> => ({
  nodes: HashMap.empty(),
  roots: HashSet.empty(),
  children: HashMap.empty()
})

/**
 * Create an EffectGraph with a single root node
 */
export const singleton = <A>(data: A): EffectGraph<A> => {
  const node = makeNode(data)
  return {
    nodes: HashMap.make([node.id, node]),
    roots: HashSet.make(node.id),
    children: HashMap.empty()
  }
}

// =============================================================================
// Graph Operations
// =============================================================================

/**
 * Add a node to the graph
 * Maintains DAG invariants:
 * - Updates roots if node has no parent
 * - Updates children adjacency map
 * - Recalculates depth based on parent
 */
export const addNode = <A>(
  graph: EffectGraph<A>,
  node: GraphNode<A>
): EffectGraph<A> => {
  const updatedNode = Option.match(node.parentId, {
    onNone: () => node,
    onSome: (parentId) => {
      const parentNode = HashMap.get(graph.nodes, parentId)
      const parentDepth = Option.match(parentNode, {
        onNone: () => 0,
        onSome: (p) => p.metadata.depth
      })
      return {
        ...node,
        metadata: {
          ...node.metadata,
          depth: parentDepth + 1
        }
      }
    }
  })

  const newNodes = HashMap.set(graph.nodes, updatedNode.id, updatedNode)

  const newRoots = Option.match(updatedNode.parentId, {
    onNone: () => HashSet.add(graph.roots, updatedNode.id),
    onSome: (parentId) => {
      // Remove parent from roots if it was there
      const rootsWithoutParent = HashSet.remove(graph.roots, parentId)
      return rootsWithoutParent
    }
  })

  const newChildren = Option.match(updatedNode.parentId, {
    onNone: () => graph.children,
    onSome: (parentId) => {
      const existingChildren = Option.getOrElse(
        HashMap.get(graph.children, parentId),
        () => HashSet.empty<NodeId>()
      )
      return HashMap.set(
        graph.children,
        parentId,
        HashSet.add(existingChildren, updatedNode.id)
      )
    }
  })

  return {
    nodes: newNodes,
    roots: newRoots,
    children: newChildren
  }
}

/**
 * Get a node by ID
 */
export const getNode = <A>(
  graph: EffectGraph<A>,
  nodeId: NodeId
): Option.Option<GraphNode<A>> => HashMap.get(graph.nodes, nodeId)

/**
 * Get all children of a node
 */
export const getChildren = <A>(
  graph: EffectGraph<A>,
  nodeId: NodeId
): ReadonlyArray<GraphNode<A>> => {
  const childIds = Option.getOrElse(
    HashMap.get(graph.children, nodeId),
    () => HashSet.empty<NodeId>()
  )

  return Array.fromIterable(childIds).flatMap((childId: NodeId) =>
    Option.match(getNode(graph, childId), {
      onNone: () => [],
      onSome: (node) => [node]
    })
  )
}

/**
 * Get all root nodes
 */
export const getRoots = <A>(
  graph: EffectGraph<A>
): ReadonlyArray<GraphNode<A>> =>
  Array.fromIterable(graph.roots).flatMap((rootId: NodeId) =>
    Option.match(getNode(graph, rootId), {
      onNone: () => [],
      onSome: (node) => [node]
    })
  )

// =============================================================================
// Catamorphism - The fundamental fold operation
// =============================================================================

/**
 * F-Algebra: A function that collapses a structure
 * For graphs: (GraphNode<A>, [B]) → B
 * Takes a node and its already-processed children, produces a result
 */
export type GraphAlgebra<A, B> = (
  node: GraphNode<A>,
  children: ReadonlyArray<B>
) => B

/**
 * Catamorphism: Bottom-up fold over the graph structure
 *
 * This is the fundamental operation for consuming graphs.
 * It processes nodes in topological order (children before parents)
 * and applies the algebra at each step.
 *
 * Category theory: This is a catamorphism from the initial algebra
 * of the graph functor to any other algebra.
 *
 * @param graph - The graph to fold
 * @param algebra - The F-algebra defining how to combine nodes
 * @returns An Effect producing the results for all root nodes
 */
export const cata = <A, B>(
  graph: EffectGraph<A>,
  algebra: GraphAlgebra<A, B>
): Effect.Effect<ReadonlyArray<B>, never, never> => {
  const memo = new Map<NodeId, B>()

  const go = (nodeId: NodeId): Effect.Effect<B, never, never> =>
    Effect.gen(function* () {
      // Check memoization
      if (memo.has(nodeId)) {
        return memo.get(nodeId)!
      }

      const nodeOption = getNode(graph, nodeId)
      if (Option.isNone(nodeOption)) {
        throw new Error(`Node not found: ${nodeId}`)
      }
      const node = Option.getOrThrow(nodeOption)

      // Process children first (bottom-up)
      const childNodes = getChildren(graph, nodeId)
      const processedChildren = yield* Effect.all(
        childNodes.map((child: GraphNode<A>) => go(child.id))
      )

      // Apply algebra
      const result = algebra(node, processedChildren)
      memo.set(nodeId, result)

      return result
    })

  // Process all roots
  const roots = getRoots(graph)
  return Effect.all(roots.map((root: GraphNode<A>) => go(root.id)))
}

/**
 * Anamorphism: Top-down unfold creating a graph
 *
 * Dual to catamorphism. Builds a graph from a seed value.
 *
 * @param seed - Initial value
 * @param coalgebra - Function producing (data, children seeds)
 * @returns An Effect producing the constructed graph
 */
export type GraphCoalgebra<A, B> = (
  seed: B
) => Effect.Effect<readonly [A, ReadonlyArray<B>]>

export const ana = <A, B>(
  seed: B,
  coalgebra: GraphCoalgebra<A, B>
): Effect.Effect<EffectGraph<A>, never, never> =>
  Effect.gen(function* () {
    let graph = empty<A>()

    const go = (
      currentSeed: B,
      parentId: Option.Option<NodeId>
    ): Effect.Effect<NodeId, never, never> =>
      Effect.gen(function* () {
        const [data, childSeeds] = yield* coalgebra(currentSeed)
        const node = makeNode(data, parentId)
        graph = addNode(graph, node)

        // Process children
        yield* Effect.all(
          childSeeds.map((childSeed: B) => go(childSeed, Option.some(node.id)))
        )

        return node.id
      })

    yield* go(seed, Option.none())
    return graph
  })

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Map over all nodes in the graph, preserving structure
 * This is the Functor instance for EffectGraph
 */
export const map = <A, B>(
  graph: EffectGraph<A>,
  f: (a: A) => B
): EffectGraph<B> => {
  const newNodes = HashMap.map(graph.nodes, (node) => ({
    ...node,
    data: f(node.data)
  }))

  return {
    nodes: newNodes,
    roots: graph.roots,
    children: graph.children
  }
}

/**
 * Convert graph to array of nodes (topologically sorted)
 */
export const toArray = <A>(
  graph: EffectGraph<A>
): ReadonlyArray<GraphNode<A>> => {
  const result: GraphNode<A>[] = []
  const visited = new Set<NodeId>()

  const visit = (nodeId: NodeId): void => {
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    const node = getNode(graph, nodeId)
    if (Option.isNone(node)) return

    const children = getChildren(graph, nodeId)
    children.forEach(child => visit(child.id))

    result.push(Option.getOrThrow(node))
  }

  getRoots(graph).forEach(root => visit(root.id))
  return result
}

/**
 * Get the size (number of nodes) in the graph
 */
export const size = <A>(graph: EffectGraph<A>): number =>
  HashMap.size(graph.nodes)

/**
 * Pretty print the graph structure
 */
export const show = <A>(
  graph: EffectGraph<A>,
  showData: (a: A) => string
): string => {
  const lines: string[] = []

  const visit = (nodeId: NodeId, indent: number): void => {
    const node = getNode(graph, nodeId)
    if (Option.isNone(node)) return

    const n = Option.getOrThrow(node)
    const prefix = "  ".repeat(indent)
    const op = Option.match(n.metadata.operation, {
      onNone: () => "root",
      onSome: (o: string) => o
    })

    lines.push(`${prefix}[${op}] ${showData(n.data)}`)

    const children = getChildren(graph, nodeId)
    children.forEach((child: GraphNode<A>) => visit(child.id, indent + 1))
  }

  getRoots(graph).forEach((root: GraphNode<A>) => visit(root.id, 0))
  return lines.join("\n")
}
