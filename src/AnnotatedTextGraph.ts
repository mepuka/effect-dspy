/**
 * AnnotatedTextGraph - Text graphs with linguistic annotations
 *
 * This module extends TextGraph to support linguistic annotation nodes:
 * - POSNode: Part-of-speech tags
 * - EntityNode: Named entities
 * - LemmaNode: Lemmatized forms
 * - DependencyNode: Syntactic dependencies
 * - RelationNode: Semantic relations
 *
 * Category theory: This forms a richer category where objects include both
 * structural text nodes and linguistic annotation nodes.
 */

import * as Effect from "effect/Effect"
import * as Graph from "effect/Graph"
import * as Backend from "./NLPBackend.js"
import * as S from "./Schema.js"

// =============================================================================
// Annotated Node Types
// =============================================================================

/**
 * Union of all node types (structural + linguistic annotations)
 */
export type AnnotatedNode =
  | S.TextNode
  | S.POSNode
  | S.EntityNode
  | S.LemmaNode
  | S.DependencyNode
  | S.RelationNode

/**
 * Type guard to check if a node is a TextNode
 */
export const isTextNode = (node: AnnotatedNode): node is S.TextNode =>
  node instanceof S.TextNode

/**
 * Type guard to check if a node is a POSNode
 */
export const isPOSNode = (node: AnnotatedNode): node is S.POSNode =>
  node instanceof S.POSNode

/**
 * Type guard to check if a node is an EntityNode
 */
export const isEntityNode = (node: AnnotatedNode): node is S.EntityNode =>
  node instanceof S.EntityNode

/**
 * Type guard to check if a node is a LemmaNode
 */
export const isLemmaNode = (node: AnnotatedNode): node is S.LemmaNode =>
  node instanceof S.LemmaNode

/**
 * Type guard to check if a node is a DependencyNode
 */
export const isDependencyNode = (node: AnnotatedNode): node is S.DependencyNode =>
  node instanceof S.DependencyNode

/**
 * Type guard to check if a node is a RelationNode
 */
export const isRelationNode = (node: AnnotatedNode): node is S.RelationNode =>
  node instanceof S.RelationNode

// =============================================================================
// Annotated Graph Types
// =============================================================================

/**
 * An annotated text graph with linguistic annotation nodes
 */
export type AnnotatedTextGraph = Graph.DirectedGraph<AnnotatedNode, S.TextEdge>

/**
 * Mutable annotated text graph for construction
 */
export type MutableAnnotatedTextGraph = Graph.MutableDirectedGraph<AnnotatedNode, S.TextEdge>

// =============================================================================
// Constructors
// =============================================================================

/**
 * Create an empty annotated text graph
 */
export const empty = (): AnnotatedTextGraph => Graph.directed<AnnotatedNode, S.TextEdge>()

/**
 * Build a fully annotated text graph from a document
 *
 * This creates a rich graph structure:
 * - Document root node
 * - Sentence nodes (children of document)
 * - Token nodes (children of sentences)
 * - POS nodes (annotations of tokens)
 * - Lemma nodes (annotations of tokens)
 * - Entity nodes (annotations of sentences)
 *
 * @param text - The document text to analyze
 * @param options - Options for annotation (what to include)
 */
export const fromDocumentAnnotated = (
  text: string,
  options: {
    readonly includePOS?: boolean
    readonly includeLemmas?: boolean
    readonly includeEntities?: boolean
    readonly includeDependencies?: boolean
  } = {
    includePOS: true,
    includeLemmas: true,
    includeEntities: true,
    includeDependencies: false // Expensive, off by default
  }
): Effect.Effect<AnnotatedTextGraph, Backend.NLPBackendError, Backend.NLPBackend> =>
  Effect.gen(function* () {
    const backend = yield* Backend.NLPBackend

    // Get sentences
    const sentences = yield* backend.sentencize(text)

    // Create base graph with document and sentences
    let graph = Graph.directed<AnnotatedNode, S.TextEdge>((mutable) => {
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

      // Process each sentence
      sentences.forEach((sentence) => {
        // Create sentence node
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

    // Add annotations based on options
    if (options.includePOS) {
      graph = yield* addPOSAnnotations(graph)
    }

    if (options.includeLemmas) {
      graph = yield* addLemmaAnnotations(graph)
    }

    if (options.includeEntities) {
      graph = yield* addEntityAnnotations(graph)
    }

    // TODO: Add dependency parsing when option is enabled
    // if (options.includeDependencies) {
    //   graph = yield* addDependencyAnnotations(graph)
    // }

    return graph
  })

/**
 * Add POS tag annotations to a graph
 *
 * For each sentence node, this adds POS tag nodes for each token.
 */
export const addPOSAnnotations = (
  graph: AnnotatedTextGraph
): Effect.Effect<AnnotatedTextGraph, Backend.NLPBackendError, Backend.NLPBackend> =>
  Effect.gen(function* () {
    const backend = yield* Backend.NLPBackend
    let result = graph

    // Find all sentence nodes
    const sentenceNodes = Graph.findNodes(graph, (node) =>
      isTextNode(node) && node.type === "sentence"
    )

    // Annotate each sentence with POS tags
    for (const sentIdx of sentenceNodes) {
      const sentNode = Graph.getNode(graph, sentIdx)
      if (sentNode._tag === "None" || !isTextNode(sentNode.value)) continue

      // Get POS tags for this sentence
      const posNodes = yield* backend.posTag(sentNode.value.text)

      // Add POS nodes and link them to the sentence
      result = Graph.mutate(result, (mutable) => {
        posNodes.forEach((posNode) => {
          const posIdx = Graph.addNode(mutable, posNode)
          Graph.addEdge(
            mutable,
            sentIdx,
            posIdx,
            new S.TextEdge({ relation: "contains" })
          )
        })
      })
    }

    return result
  })

/**
 * Add lemma annotations to a graph
 */
export const addLemmaAnnotations = (
  graph: AnnotatedTextGraph
): Effect.Effect<AnnotatedTextGraph, Backend.NLPBackendError, Backend.NLPBackend> =>
  Effect.gen(function* () {
    const backend = yield* Backend.NLPBackend
    let result = graph

    // Find all sentence nodes
    const sentenceNodes = Graph.findNodes(graph, (node) =>
      isTextNode(node) && node.type === "sentence"
    )

    // Annotate each sentence with lemmas
    for (const sentIdx of sentenceNodes) {
      const sentNode = Graph.getNode(graph, sentIdx)
      if (sentNode._tag === "None" || !isTextNode(sentNode.value)) continue

      // Get lemmas for this sentence
      const lemmaNodes = yield* backend.lemmatize(sentNode.value.text)

      // Add lemma nodes and link them to the sentence
      result = Graph.mutate(result, (mutable) => {
        lemmaNodes.forEach((lemmaNode) => {
          const lemmaIdx = Graph.addNode(mutable, lemmaNode)
          Graph.addEdge(
            mutable,
            sentIdx,
            lemmaIdx,
            new S.TextEdge({ relation: "contains" })
          )
        })
      })
    }

    return result
  })

/**
 * Add entity annotations to a graph
 */
export const addEntityAnnotations = (
  graph: AnnotatedTextGraph
): Effect.Effect<AnnotatedTextGraph, Backend.NLPBackendError, Backend.NLPBackend> =>
  Effect.gen(function* () {
    const backend = yield* Backend.NLPBackend
    let result = graph

    // Find all sentence nodes
    const sentenceNodes = Graph.findNodes(graph, (node) =>
      isTextNode(node) && node.type === "sentence"
    )

    // Extract entities from each sentence
    for (const sentIdx of sentenceNodes) {
      const sentNode = Graph.getNode(graph, sentIdx)
      if (sentNode._tag === "None" || !isTextNode(sentNode.value)) continue

      // Get entities for this sentence
      const entityNodes = yield* backend.extractEntities(sentNode.value.text)

      // Add entity nodes and link them to the sentence
      result = Graph.mutate(result, (mutable) => {
        entityNodes.forEach((entityNode) => {
          const entityIdx = Graph.addNode(mutable, entityNode)
          Graph.addEdge(
            mutable,
            sentIdx,
            entityIdx,
            new S.TextEdge({ relation: "entity-mention" })
          )
        })
      })
    }

    return result
  })

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Filter nodes to only POSNodes
 */
export const getPOSNodes = (graph: AnnotatedTextGraph): ReadonlyArray<{
  index: Graph.NodeIndex
  node: S.POSNode
}> => {
  const result: Array<{ index: Graph.NodeIndex; node: S.POSNode }> = []

  for (const [idx, node] of Graph.entries(Graph.nodes(graph))) {
    if (isPOSNode(node)) {
      result.push({ index: idx, node })
    }
  }

  return result
}

/**
 * Filter nodes to only EntityNodes
 */
export const getEntityNodes = (graph: AnnotatedTextGraph): ReadonlyArray<{
  index: Graph.NodeIndex
  node: S.EntityNode
}> => {
  const result: Array<{ index: Graph.NodeIndex; node: S.EntityNode }> = []

  for (const [idx, node] of Graph.entries(Graph.nodes(graph))) {
    if (isEntityNode(node)) {
      result.push({ index: idx, node })
    }
  }

  return result
}

/**
 * Filter entities by type
 */
export const filterEntitiesByType = (
  graph: AnnotatedTextGraph,
  entityType: string
): ReadonlyArray<S.EntityNode> => {
  return getEntityNodes(graph)
    .filter((item) => item.node.entityType === entityType)
    .map((item) => item.node)
}

/**
 * Filter POS nodes by tag
 */
export const filterByPOSTag = (
  graph: AnnotatedTextGraph,
  tag: string
): ReadonlyArray<S.POSNode> => {
  return getPOSNodes(graph)
    .filter((item) => item.node.tag === tag)
    .map((item) => item.node)
}

/**
 * Get all lemmas from the graph
 */
export const getLemmaNodes = (graph: AnnotatedTextGraph): ReadonlyArray<{
  index: Graph.NodeIndex
  node: S.LemmaNode
}> => {
  const result: Array<{ index: Graph.NodeIndex; node: S.LemmaNode }> = []

  for (const [idx, node] of Graph.entries(Graph.nodes(graph))) {
    if (isLemmaNode(node)) {
      result.push({ index: idx, node })
    }
  }

  return result
}

/**
 * Get all text nodes (structural nodes only)
 */
export const getTextNodes = (graph: AnnotatedTextGraph): ReadonlyArray<{
  index: Graph.NodeIndex
  node: S.TextNode
}> => {
  const result: Array<{ index: Graph.NodeIndex; node: S.TextNode }> = []

  for (const [idx, node] of Graph.entries(Graph.nodes(graph))) {
    if (isTextNode(node)) {
      result.push({ index: idx, node })
    }
  }

  return result
}

/**
 * Count nodes by type
 */
export const countNodesByType = (graph: AnnotatedTextGraph): Record<string, number> => {
  const counts: Record<string, number> = {
    text: 0,
    pos: 0,
    entity: 0,
    lemma: 0,
    dependency: 0,
    relation: 0
  }

  for (const node of Graph.values(Graph.nodes(graph))) {
    if (isTextNode(node)) counts.text++
    else if (isPOSNode(node)) counts.pos++
    else if (isEntityNode(node)) counts.entity++
    else if (isLemmaNode(node)) counts.lemma++
    else if (isDependencyNode(node)) counts.dependency++
    else if (isRelationNode(node)) counts.relation++
  }

  return counts
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get all nodes as an array
 */
export const toArray = (graph: AnnotatedTextGraph): ReadonlyArray<AnnotatedNode> =>
  Array.from(Graph.values(Graph.nodes(graph)))

/**
 * Count total nodes in graph
 */
export const nodeCount = (graph: AnnotatedTextGraph): number =>
  Graph.nodeCount(graph)

/**
 * Get the root nodes (nodes with no incoming edges)
 */
export const getRoots = (graph: AnnotatedTextGraph): ReadonlyArray<Graph.NodeIndex> =>
  Array.from(Graph.indices(Graph.externals(graph, { direction: "incoming" })))
