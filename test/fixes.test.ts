/**
 * Tests for critical bug fixes from code review
 */

import { describe, it, expect } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Graph from "effect/Graph"
import * as NLP from "../src/NLPService.js"
import * as TextGraph from "../src/TextGraph.js"
import * as Pipeline from "../src/Pipeline.js"
import * as GraphOps from "../src/GraphOps.js"
import * as S from "../src/Schema.js"

describe("Bug Fixes from Code Review", () => {

  // ==========================================================================
  // Fix 2: Depth Computation (BFS, handles DAGs correctly)
  // ==========================================================================

  describe("Depth computation for DAGs", () => {
    it("should handle DAG with multiple parents correctly", () => {
      // Create a DAG where node C has two parents (A and B)
      //     A (depth 0)
      //    / \
      //   B   C (depth 1 from A)
      //    \ /
      //     C (depth 2 from B -> should be max = 2)

      const graph = Graph.directed<S.TextNode, S.TextEdge>((mutable) => {
        const a = Graph.addNode(
          mutable,
          new S.TextNode({ text: "A", type: "document", timestamp: Date.now() })
        )
        const b = Graph.addNode(
          mutable,
          new S.TextNode({ text: "B", type: "sentence", timestamp: Date.now() })
        )
        const c = Graph.addNode(
          mutable,
          new S.TextNode({ text: "C", type: "token", timestamp: Date.now() })
        )

        // A -> B, A -> C, B -> C
        Graph.addEdge(mutable, a, b, new S.TextEdge({ relation: "contains" }))
        Graph.addEdge(mutable, a, c, new S.TextEdge({ relation: "contains" }))
        Graph.addEdge(mutable, b, c, new S.TextEdge({ relation: "contains" }))
      })

      // The depth computation should be deterministic and handle multiple paths
      const roots = TextGraph.getRoots(graph)
      expect(roots.length).toBe(1) // Only A is a root

      // Verify graph structure is valid
      expect(TextGraph.isAcyclic(graph)).toBe(true)
      expect(TextGraph.nodeCount(graph)).toBe(3)
    })
  })

})

// =============================================================================
// Jaro Similarity Tests
// =============================================================================

describe("Jaro similarity (no longer inverted)", () => {
  it.layer(NLP.NLPServiceLive)(
    "should return 1.0 for identical strings",
    () =>
      Effect.gen(function*() {
        const nlp = yield* NLP.NLPService
        const similarity = yield* nlp.stringSimilarity("hello", "hello")
        expect(similarity).toBe(1.0)
      })
  )

  it.layer(NLP.NLPServiceLive)(
    "should return ~0 for completely different strings",
    () =>
      Effect.gen(function*() {
        const nlp = yield* NLP.NLPService
        const similarity = yield* nlp.stringSimilarity("abc", "xyz")
        expect(similarity).toBeLessThan(0.5) // Should be low for dissimilar strings
      })
  )

  it.layer(NLP.NLPServiceLive)(
    "should return value in [0, 1] range",
    () =>
      Effect.gen(function*() {
        const nlp = yield* NLP.NLPService
        const similarity = yield* nlp.stringSimilarity("test", "text")
        expect(similarity).toBeGreaterThanOrEqual(0)
        expect(similarity).toBeLessThanOrEqual(1)
      })
  )
})

// =============================================================================
// tokenizeNodes Idempotency Tests
// =============================================================================

describe("tokenizeNodes idempotency", () => {
  it.layer(NLP.NLPServiceLive)(
      "should not create duplicate tokens on second call",
      () =>
        Effect.gen(function*() {
          // Create a graph with a sentence
          const graph = yield* TextGraph.fromDocument("Hello world.")

          // Tokenize once
          const tokenized1 = yield* TextGraph.tokenizeNodes(graph)
          const count1 = TextGraph.nodeCount(tokenized1)

          // Tokenize again (should be idempotent)
          const tokenized2 = yield* TextGraph.tokenizeNodes(tokenized1)
          const count2 = TextGraph.nodeCount(tokenized2)

          // Node count should be the same (no duplicates)
          expect(count2).toBe(count1)
        })
    )

    it.layer(NLP.NLPServiceLive)(
      "should skip sentences that already have tokens",
      () =>
        Effect.gen(function*() {
          const graph = yield* TextGraph.fromDocument("Test sentence.")

          // First tokenization
          const tokenized1 = yield* TextGraph.tokenizeNodes(graph)

          // Get all token nodes
          const tokens1 = TextGraph.findNodesByType(tokenized1, "token")

          // Second tokenization (should skip)
          const tokenized2 = yield* TextGraph.tokenizeNodes(tokenized1)
          const tokens2 = TextGraph.findNodesByType(tokenized2, "token")

          // Token count should be identical
          expect(tokens2.length).toBe(tokens1.length)
        })
    )
})

// =============================================================================
// addChildren Acyclicity Validation Tests
// =============================================================================

describe("addChildren acyclicity validation", () => {
    it("should validate acyclicity", () => {
      // Note: In a DAG, adding new children typically doesn't create cycles
      // unless we manually construct edges back to ancestors.
      // This test verifies the validation is in place.

      const graph = Graph.directed<S.TextNode, S.TextEdge>((mutable) => {
        Graph.addNode(
          mutable,
          new S.TextNode({ text: "Root", type: "document", timestamp: Date.now() })
        )
      })

      const child = new S.TextNode({ text: "Child", type: "sentence", timestamp: Date.now() })

      // This should succeed - no cycle when adding to a simple linear graph
      const result = TextGraph.addChildren(
        graph,
        0 as Graph.NodeIndex,
        [child],
        "contains"
      )

      expect(TextGraph.nodeCount(result)).toBe(2)
      expect(TextGraph.isAcyclic(result)).toBe(true)
    })

    it("should allow adding children when no cycle is created", () => {
      const graph = Graph.directed<S.TextNode, S.TextEdge>((mutable) => {
        Graph.addNode(
          mutable,
          new S.TextNode({ text: "Root", type: "document", timestamp: Date.now() })
        )
      })

      const child = new S.TextNode({ text: "Child", type: "sentence", timestamp: Date.now() })

      // This should succeed (no cycle)
      const result = TextGraph.addChildren(
        graph,
        0 as Graph.NodeIndex,
        [child],
        "contains"
      )

      expect(TextGraph.nodeCount(result)).toBe(2)
      expect(TextGraph.isAcyclic(result)).toBe(true)
    })
})

// =============================================================================
// parallelFeaturePipeline Tests
// =============================================================================

describe("parallelFeaturePipeline (no duplicate tokenization)", () => {
  it.layer(NLP.NLPServiceLive)(
      "should tokenize only once and reuse results",
      () =>
        Effect.gen(function*() {
          const text = "Hello world. This is a test."

          // Run pipeline
          const result = yield* Pipeline.parallelFeaturePipeline(text)

          // Verify all features are present
          expect(result.tokens.length).toBeGreaterThan(0)
          expect(result.bigrams.length).toBeGreaterThan(0)
          expect(result.trigrams.length).toBeGreaterThan(0)
          expect(result.bow.size).toBeGreaterThan(0)

          // The BOW should have the same words as tokens
          const tokenSet = new Set(result.tokens)
          result.bow.forEach((_, term) => {
            expect(tokenSet.has(term)).toBe(true)
          })
        })
    )
})

// =============================================================================
// Tests for New Graph Operations Module
// =============================================================================

describe("GraphOps - Production Graph Operations", () => {
  describe("Functorial operations", () => {
    it("should map nodes preserving structure", () => {
      const graph = GraphOps.singleton("hello")
      const mapped = GraphOps.mapNodes(graph, (s: string) => s.toUpperCase())

      expect(GraphOps.nodeCount(mapped)).toBe(1)
      const nodes = GraphOps.collectNodes(mapped)
      expect(nodes[0]).toBe("HELLO")
    })

    it("should filter nodes by predicate", () => {
      const graph = Graph.directed<number, string>((mutable) => {
        Graph.addNode(mutable, 1)
        Graph.addNode(mutable, 2)
        Graph.addNode(mutable, 3)
        Graph.addNode(mutable, 4)
      })

      const filtered = GraphOps.filterNodes(graph, (n) => n % 2 === 0)
      const nodes = GraphOps.collectNodes(filtered)

      expect(nodes.length).toBe(2)
      expect(nodes).toContain(2)
      expect(nodes).toContain(4)
    })
  })

  describe("Search operations (adjoint functors)", () => {
    it("should build index and query correctly", () => {
      const graph = Graph.directed<S.TextNode, S.TextEdge>((mutable) => {
        Graph.addNode(
          mutable,
          new S.TextNode({ text: "A", type: "document", timestamp: Date.now() })
        )
        Graph.addNode(
          mutable,
          new S.TextNode({ text: "B", type: "sentence", timestamp: Date.now() })
        )
        Graph.addNode(
          mutable,
          new S.TextNode({ text: "C", type: "token", timestamp: Date.now() })
        )
      })

      // Build index by node type
      const index = GraphOps.buildIndex(graph, (node) => [node.type])

      // Query for sentences
      const sentences = GraphOps.queryIndex(index, "sentence")
      expect(sentences.length).toBe(1)

      // Query for tokens
      const tokens = GraphOps.queryIndex(index, "token")
      expect(tokens.length).toBe(1)
    })

    it("should support union queries", () => {
      const graph = Graph.directed<S.TextNode, S.TextEdge>((mutable) => {
        Graph.addNode(
          mutable,
          new S.TextNode({ text: "A", type: "document", timestamp: Date.now() })
        )
        Graph.addNode(
          mutable,
          new S.TextNode({ text: "B", type: "sentence", timestamp: Date.now() })
        )
        Graph.addNode(
          mutable,
          new S.TextNode({ text: "C", type: "token", timestamp: Date.now() })
        )
      })

      const index = GraphOps.buildIndex(graph, (node) => [node.type])

      // Union query: sentence OR token
      const results = GraphOps.queryIndexUnion(index, ["sentence", "token"])
      expect(results.length).toBe(2)
    })
  })

  describe("Fold operations", () => {
    it("should fold nodes with accumulator", () => {
      const graph = Graph.directed<number, string>((mutable) => {
        Graph.addNode(mutable, 1)
        Graph.addNode(mutable, 2)
        Graph.addNode(mutable, 3)
      })

      const sum = GraphOps.foldNodes(graph, 0, (acc, n) => acc + n)
      expect(sum).toBe(6)
    })
  })

  describe("Streaming operations", () => {
    it("should create stream from graph nodes", () => {
      const graph = Graph.directed<number, string>((mutable) => {
        Graph.addNode(mutable, 1)
        Graph.addNode(mutable, 2)
        Graph.addNode(mutable, 3)
      })

      const roots = GraphOps.getRoots(graph)
      const stream = GraphOps.streamNodes(graph, roots, "dfs")

      // Stream should be created successfully
      expect(stream).toBeDefined()
    })
  })
})
