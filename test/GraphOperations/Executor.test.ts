/**
 * Tests for GraphExecutor
 *
 * Tests the core execution engine with various strategies and operations.
 */

import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Duration from "effect/Duration"
import * as EG from "../../src/EffectGraph.js"
import * as GraphOp from "../../src/GraphOperations/index.js"
import * as Catalog from "../../src/GraphOperations/Catalog.js"
import { NLPServiceLive } from "../../src/NLPService.js"

// Test layer with all dependencies
const TestLayer = Layer.mergeAll(GraphOp.GraphExecutorTest, NLPServiceLive)

describe("GraphExecutor", () => {
  describe("Basic Execution", () => {
    it.effect("should execute sentencize operation", () =>
      Effect.gen(function* () {
        const executor = yield* GraphOp.GraphExecutor

        // Create a simple graph
        const graph = EG.singleton(
          "Hello world. This is a test. How are you?"
        )

        // Execute sentencize operation
        const result = yield* executor.execute(graph, Catalog.sentencize)

        // Should create 3 sentence nodes
        expect(result.newNodes.length).toBe(3)
        expect(result.errors.length).toBe(0)

        // Check metrics
        expect(result.metrics.nodesProcessed).toBe(1) // 1 leaf node
        expect(result.metrics.nodesCreated).toBe(3) // 3 sentences
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect("should execute tokenize operation", () =>
      Effect.gen(function* () {
        const executor = yield* GraphOp.GraphExecutor

        const graph = EG.singleton("Hello world")

        const result = yield* executor.execute(graph, Catalog.tokenize)

        // Should create 2 token nodes
        expect(result.newNodes.length).toBe(2)
        expect(result.newNodes[0]?.data).toBe("Hello")
        expect(result.newNodes[1]?.data).toBe("world")
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect("should execute pure operations", () =>
      Effect.gen(function* () {
        const executor = yield* GraphOp.GraphExecutor

        const graph = EG.singleton("Hello World")

        const result = yield* executor.execute(graph, Catalog.toLowerCase)

        expect(result.newNodes.length).toBe(1)
        expect(result.newNodes[0]?.data).toBe("hello world")
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("Sequential Execution", () => {
    it.effect("should execute sequentially", () =>
      Effect.gen(function* () {
        const executor = yield* GraphOp.GraphExecutor

        const graph = EG.singleton("First. Second.")

        const result = yield* executor.execute(
          graph,
          Catalog.sentencize,
          GraphOp.ExecutionOptions.sequential()
        )

        expect(result.newNodes.length).toBe(2)
        expect(result.metrics.nodesProcessed).toBe(1)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect("should handle multiple leaf nodes", () =>
      Effect.gen(function* () {
        const executor = yield* GraphOp.GraphExecutor

        // Create graph with multiple leaf nodes
        const graph = EG.singleton("Root")
        const child1 = EG.makeNode(
          "Child 1",
          EG.Option.some(EG.toArray(graph)[0]!.id)
        )
        const child2 = EG.makeNode(
          "Child 2",
          EG.Option.some(EG.toArray(graph)[0]!.id)
        )

        let graphWithChildren = EG.addNode(graph, child1)
        graphWithChildren = EG.addNode(graphWithChildren, child2)

        // Execute on leaf nodes
        const result = yield* executor.execute(
          graphWithChildren,
          Catalog.toUpperCase
        )

        expect(result.newNodes.length).toBe(2) // 2 leaf nodes transformed
        expect(result.newNodes.every((n) => n.data === n.data.toUpperCase()))
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("Parallel Execution", () => {
    it.effect("should execute in parallel", () =>
      Effect.gen(function* () {
        const executor = yield* GraphOp.GraphExecutor

        const graph = EG.singleton("One. Two. Three. Four. Five.")

        const start = Date.now()

        const result = yield* executor.execute(
          graph,
          Catalog.sentencize,
          GraphOp.ExecutionOptions.parallel(4)
        )

        const end = Date.now()

        expect(result.newNodes.length).toBe(5)

        // Parallel should be reasonably fast
        expect(end - start).toBeLessThan(1000)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("Caching", () => {
    it.effect("should cache results", () =>
      Effect.gen(function* () {
        const executor = yield* GraphOp.GraphExecutor

        const graph = EG.singleton("Hello world")

        // First execution - cache miss
        const result1 = yield* executor.execute(graph, Catalog.tokenize, {
          cache: true
        })

        expect(result1.metrics.cacheMisses).toBe(1)
        expect(result1.metrics.cacheHits).toBe(0)

        // Second execution - cache hit
        const result2 = yield* executor.execute(graph, Catalog.tokenize, {
          cache: true
        })

        expect(result2.metrics.cacheHits).toBe(1)
        expect(result2.metrics.cacheMisses).toBe(0)

        // Results should be identical
        expect(result2.newNodes.length).toBe(result1.newNodes.length)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect("should bypass cache when disabled", () =>
      Effect.gen(function* () {
        const executor = yield* GraphOp.GraphExecutor

        const graph = EG.singleton("Hello world")

        // Execute twice without cache
        const result1 = yield* executor.execute(graph, Catalog.tokenize, {
          cache: false
        })
        const result2 = yield* executor.execute(graph, Catalog.tokenize, {
          cache: false
        })

        // Both should be cache misses
        expect(result1.metrics.cacheHits).toBe(0)
        expect(result2.metrics.cacheHits).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("Validation", () => {
    it.effect("should validate operations", () =>
      Effect.gen(function* () {
        const executor = yield* GraphOp.GraphExecutor

        const validGraph = EG.singleton("Hello world")
        const emptyGraph = EG.singleton("")

        // Valid graph
        const validResult = yield* executor.validate(
          validGraph,
          Catalog.sentencize
        )
        expect(validResult.valid).toBe(true)
        expect(validResult.errors.length).toBe(0)

        // Invalid graph (empty text)
        const invalidResult = yield* executor.validate(
          emptyGraph,
          Catalog.sentencize
        )
        expect(invalidResult.valid).toBe(false)
        expect(invalidResult.errors.length).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("Cost Estimation", () => {
    it.effect("should estimate operation cost", () =>
      Effect.gen(function* () {
        const executor = yield* GraphOp.GraphExecutor

        const graph = EG.singleton("Hello world")

        const cost = yield* executor.estimateCost(graph, Catalog.sentencize)

        // Should have reasonable estimates
        expect(Duration.toMillis(cost.estimatedTime)).toBeGreaterThan(0)
        expect(cost.complexity).toBe("O(n)")
        expect(cost.tokenCost).toBe(0) // Not an LLM operation
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect("should scale cost by node count", () =>
      Effect.gen(function* () {
        const executor = yield* GraphOp.GraphExecutor

        const smallGraph = EG.singleton("Hi")
        const largeGraph = EG.singleton(
          "One. Two. Three. Four. Five. Six. Seven. Eight."
        )

        const smallCost = yield* executor.estimateCost(
          smallGraph,
          Catalog.sentencize
        )
        const largeCost = yield* executor.estimateCost(
          largeGraph,
          Catalog.sentencize
        )

        // Large graph should have higher estimated time
        expect(Duration.toMillis(largeCost.estimatedTime)).toBeGreaterThanOrEqual(
          Duration.toMillis(smallCost.estimatedTime)
        )
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("Composition", () => {
    it.effect("should compose operations", () =>
      Effect.gen(function* () {
        const executor = yield* GraphOp.GraphExecutor

        // Start with text
        let graph = EG.singleton("Hello world. This is a test.")

        // Step 1: Sentencize
        let result = yield* executor.execute(graph, Catalog.sentencize)

        // Add new nodes to graph
        for (const node of result.newNodes) {
          graph = EG.addNode(graph, node)
        }

        expect(EG.size(graph)).toBe(3) // 1 root + 2 sentences

        // Step 2: Tokenize sentences
        result = yield* executor.execute(graph, Catalog.tokenize)

        // Add tokens to graph
        for (const node of result.newNodes) {
          graph = EG.addNode(graph, node)
        }

        // Should have root + sentences + tokens
        expect(EG.size(graph)).toBeGreaterThan(3)

        // Verify graph structure
        const roots = EG.getRoots(graph)
        expect(roots.length).toBe(1)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("Error Handling", () => {
    it.effect("should handle empty graph gracefully", () =>
      Effect.gen(function* () {
        const executor = yield* GraphOp.GraphExecutor

        const emptyGraph = EG.empty<string>()

        const result = yield* executor.execute(emptyGraph, Catalog.tokenize)

        // Should return empty result, not error
        expect(result.newNodes.length).toBe(0)
        expect(result.errors.length).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe("Metrics", () => {
    it.effect("should collect execution metrics", () =>
      Effect.gen(function* () {
        const executor = yield* GraphOp.GraphExecutor

        const graph = EG.singleton("Hello world. How are you?")

        const result = yield* executor.execute(graph, Catalog.sentencize)

        // Verify metrics
        expect(result.metrics.nodesProcessed).toBe(1)
        expect(result.metrics.nodesCreated).toBe(2)
        expect(Duration.toMillis(result.metrics.duration)).toBeGreaterThan(0)
        expect(result.metrics.tokensConsumed).toBe(0)
      }).pipe(Effect.provide(TestLayer))
    )
  })
})
