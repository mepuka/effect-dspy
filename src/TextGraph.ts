/**
 * TextGraph - Text processing using Effect's Graph module
 *
 * This module provides utilities for building and manipulating graphs of text nodes
 * using Effect's native Graph data structure. It integrates with NLPService for
 * text processing operations.
 */

import * as Effect from "effect/Effect"
import * as Graph from "effect/Graph"
import * as NLP from "./NLPService.js"
import * as S from "./Schema.js"

// =============================================================================
// Type Aliases
// =============================================================================

/**
 * A text processing graph with TextNode data and TextEdge relationships
 */
export type TextGraph = Graph.DirectedGraph<S.TextNode, S.TextEdge>

/**
 * Mutable text graph for construction
 */
export type MutableTextGraph = Graph.MutableDirectedGraph<S.TextNode, S.TextEdge>

// =============================================================================
// Constructors
// =============================================================================

/**
 * Create an empty text graph
 */
export const empty = (): TextGraph =>
  Graph.directed<S.TextNode, S.TextEdge>()

/**
 * Create a text graph with a single root node
 */
export const singleton = (text: string, type: S.TextNode["type"]): TextGraph =>
  Graph.directed<S.TextNode, S.TextEdge>((mutable) => {
    Graph.addNode(
      mutable,
      new S.TextNode({
        text,
        type,
        timestamp: Date.now()
      })
    )
  })

/**
 * Create a text graph from a document by splitting into sentences
 */
export const fromDocument = (
  text: string
): Effect.Effect<TextGraph, never, NLP.NLPService> =>
  Effect.gen(function*() {
    const sentences = yield* NLP.sentencize(text)

    return Graph.directed<S.TextNode, S.TextEdge>((mutable) => {
      // Create root document node
      const docNode = Graph.addNode(
        mutable,
        new S.TextNode({
          text,
          type: "document",
          operation: "root",
          timestamp: Date.now()
        })
      )

      // Add sentence nodes as children
      sentences.forEach((sentence) => {
        const sentenceNode = Graph.addNode(
          mutable,
          new S.TextNode({
            text: sentence,
            type: "sentence",
            operation: "sentencize",
            timestamp: Date.now()
          })
        )

        Graph.addEdge(
          mutable,
          docNode,
          sentenceNode,
          new S.TextEdge({ relation: "contains" })
        )
      })
    })
  })

// =============================================================================
// Graph Operations
// =============================================================================

/**
 * Add child nodes to a parent node in the graph
 */
export const addChildren = (
  graph: TextGraph,
  parentIndex: Graph.NodeIndex,
  children: ReadonlyArray<S.TextNode>,
  relation: S.TextEdge["relation"]
): TextGraph =>
  Graph.mutate(graph, (mutable) => {
    children.forEach((child) => {
      const childIndex = Graph.addNode(mutable, child)
      Graph.addEdge(
        mutable,
        parentIndex,
        childIndex,
        new S.TextEdge({ relation })
      )
    })
  })

/**
 * Tokenize all sentence nodes in the graph, adding token children
 */
export const tokenizeNodes = (
  graph: TextGraph
): Effect.Effect<TextGraph, never, NLP.NLPService> =>
  Effect.gen(function*() {
    let result = graph

    // Find all sentence nodes
    const sentenceNodes = Array.from(Graph.indices(Graph.nodes(graph)))
      .map((idx) => ({ idx, node: Graph.getNode(graph, idx) }))
      .filter((item) => item.node._tag === "Some" && item.node.value.type === "sentence")

    // Tokenize each sentence
    for (const { idx, node } of sentenceNodes) {
      if (node._tag === "None") continue

      const tokens = yield* NLP.tokenize(node.value.text)

      result = Graph.mutate(result, (mutable) => {
        tokens.forEach((token) => {
          const tokenNode = Graph.addNode(
            mutable,
            new S.TextNode({
              text: token,
              type: "token",
              operation: "tokenize",
              timestamp: Date.now()
            })
          )

          Graph.addEdge(
            mutable,
            idx,
            tokenNode,
            new S.TextEdge({ relation: "contains" })
          )
        })
      })
    }

    return result
  })

/**
 * Map over all nodes in the graph, transforming their data
 */
export const mapNodes = (
  graph: TextGraph,
  f: (node: S.TextNode) => S.TextNode
): TextGraph =>
  Graph.mutate(graph, (mutable) => {
    Graph.mapNodes(mutable, f)
  })

/**
 * Filter nodes by predicate
 */
export const filterNodes = (
  graph: TextGraph,
  predicate: (node: S.TextNode) => boolean
): TextGraph =>
  Graph.mutate(graph, (mutable) => {
    Graph.filterNodes(mutable, predicate)
  })

// =============================================================================
// Traversal
// =============================================================================

/**
 * Traverse the graph in depth-first order
 */
export const dfs = (
  graph: TextGraph,
  start?: ReadonlyArray<Graph.NodeIndex>
): Graph.NodeWalker<S.TextNode> =>
  Graph.dfs(graph, start ? { start } : undefined)

/**
 * Traverse the graph in breadth-first order
 */
export const bfs = (
  graph: TextGraph,
  start?: ReadonlyArray<Graph.NodeIndex>
): Graph.NodeWalker<S.TextNode> =>
  Graph.bfs(graph, start ? { start } : undefined)

/**
 * Traverse the graph in topological order (parent before children)
 */
export const topo = (
  graph: TextGraph
): Graph.NodeWalker<S.TextNode> =>
  Graph.topo(graph)

/**
 * Get all text nodes as an array
 */
export const toArray = (graph: TextGraph): ReadonlyArray<S.TextNode> =>
  Array.from(Graph.values(Graph.nodes(graph)))

// =============================================================================
// Queries
// =============================================================================

/**
 * Count nodes in the graph
 */
export const nodeCount = (graph: TextGraph): number =>
  Graph.nodeCount(graph)

/**
 * Count edges in the graph
 */
export const edgeCount = (graph: TextGraph): number =>
  Graph.edgeCount(graph)

/**
 * Find nodes by type
 */
export const findNodesByType = (
  graph: TextGraph,
  type: S.TextNode["type"]
): ReadonlyArray<Graph.NodeIndex> =>
  Graph.findNodes(graph, (node) => node.type === type)

/**
 * Get the root nodes (nodes with no incoming edges)
 */
export const getRoots = (graph: TextGraph): ReadonlyArray<Graph.NodeIndex> =>
  Array.from(
    Graph.indices(Graph.externals(graph, { direction: "incoming" }))
  )

/**
 * Get the leaf nodes (nodes with no outgoing edges)
 */
export const getLeaves = (graph: TextGraph): ReadonlyArray<Graph.NodeIndex> =>
  Array.from(
    Graph.indices(Graph.externals(graph, { direction: "outgoing" }))
  )

/**
 * Get child nodes of a given node
 */
export const getChildren = (
  graph: TextGraph,
  nodeIndex: Graph.NodeIndex
): ReadonlyArray<Graph.NodeIndex> =>
  Graph.neighbors(graph, nodeIndex)

// =============================================================================
// Visualization
// =============================================================================

/**
 * Export graph to GraphViz DOT format for visualization
 */
export const toGraphViz = (graph: TextGraph): string =>
  Graph.toGraphViz(graph, {
    nodeLabel: (node) => `${node.type}: ${node.text.slice(0, 30)}...`,
    edgeLabel: (edge) => edge.relation,
    graphName: "TextProcessingGraph"
  })

/**
 * Export graph to Mermaid diagram format
 */
export const toMermaid = (graph: TextGraph): string =>
  Graph.toMermaid(graph, {
    nodeLabel: (node) => `${node.type}: ${node.text.slice(0, 20)}`,
    edgeLabel: (edge) => edge.relation,
    direction: "TB",
    nodeShape: (node) => {
      switch (node.type) {
        case "document":
          return "rounded"
        case "sentence":
          return "rectangle"
        case "token":
          return "circle"
        default:
          return "rectangle"
      }
    }
  })

/**
 * Pretty print the graph structure for debugging
 */
export const show = (graph: TextGraph): string => {
  const lines: string[] = []

  const visit = (nodeIndex: Graph.NodeIndex, indent: number, visited: Set<number>): void => {
    if (visited.has(nodeIndex)) return
    visited.add(nodeIndex)

    const nodeOption = Graph.getNode(graph, nodeIndex)
    if (nodeOption._tag === "None") return

    const node = nodeOption.value
    const prefix = "  ".repeat(indent)
    lines.push(`${prefix}[${node.type}] ${node.text.slice(0, 50)}`)

    const children = getChildren(graph, nodeIndex)
    children.forEach((child) => visit(child, indent + 1, visited))
  }

  const roots = getRoots(graph)
  const visited = new Set<number>()
  roots.forEach((root) => visit(root, 0, visited))

  return lines.join("\n")
}

// =============================================================================
// Algorithms
// =============================================================================

/**
 * Check if the graph is acyclic (DAG)
 */
export const isAcyclic = (graph: TextGraph): boolean =>
  Graph.isAcyclic(graph)

/**
 * Get strongly connected components
 */
export const stronglyConnectedComponents = (
  graph: TextGraph
): ReadonlyArray<ReadonlyArray<Graph.NodeIndex>> =>
  Graph.stronglyConnectedComponents(graph)
