/**
 * Demo: Graph Operations Executor
 *
 * Demonstrates the core graph operations engine with a simple NLP pipeline.
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Duration from "effect/Duration"
import * as EG from "../src/EffectGraph.js"
import * as GraphOp from "../src/GraphOperations/index.js"
import * as Catalog from "../src/GraphOperations/Catalog.js"
import { NLPServiceLive } from "../src/NLPService.js"

// Combine all layers
const AppLayer = Layer.mergeAll(
  GraphOp.ResultStoreLive,
  GraphOp.GraphExecutorLive,
  NLPServiceLive
)

// Demo program
const program = Effect.gen(function* () {
  console.log("=".repeat(60))
  console.log("Graph Operations Executor Demo")
  console.log("=".repeat(60))
  console.log()

  const executor = yield* GraphOp.GraphExecutor

  // Sample text
  const text = `
    The quick brown fox jumps over the lazy dog.
    This is a demonstration of the graph operations engine.
    We can process text using functional operations.
  `.trim()

  console.log("Input Text:")
  console.log(text)
  console.log()

  // Create initial graph
  let graph = EG.singleton(text)

  console.log("Initial Graph:")
  console.log(`- Nodes: ${EG.size(graph)}`)
  console.log()

  // === Step 1: Sentencize ===
  console.log("Step 1: Sentencize (split into sentences)")
  console.log("-".repeat(60))

  let result = yield* executor.execute(graph, Catalog.sentencize, {
    strategy: GraphOp.ExecutionStrategy.Sequential,
    cache: true,
    trace: false,
    timeout: null
  })

  console.log(`✓ Created ${result.newNodes.length} sentences`)
  console.log(`✓ Processed in ${Duration.toMillis(result.metrics.duration)}ms`)
  console.log(`✓ Cache: ${result.metrics.cacheHits} hits, ${result.metrics.cacheMisses} misses`)

  // Add sentences to graph
  for (const node of result.newNodes) {
    graph = EG.addNode(graph, node)
  }

  console.log()
  result.newNodes.forEach((node, i) => {
    console.log(`  Sentence ${i + 1}: "${node.data}"`)
  })
  console.log()

  // === Step 2: Tokenize ===
  console.log("Step 2: Tokenize (split sentences into words)")
  console.log("-".repeat(60))

  result = yield* executor.execute(graph, Catalog.tokenize, {
    strategy: GraphOp.ExecutionStrategy.Parallel(4),
    cache: true,
    trace: false,
    timeout: null
  })

  console.log(`✓ Created ${result.newNodes.length} tokens`)
  console.log(`✓ Processed in ${Duration.toMillis(result.metrics.duration)}ms`)
  console.log(`✓ Strategy: Parallel (concurrency=4)`)
  console.log()

  // Add tokens to graph
  for (const node of result.newNodes) {
    graph = EG.addNode(graph, node)
  }

  // === Step 3: Lowercase ===
  console.log("Step 3: Lowercase (normalize casing)")
  console.log("-".repeat(60))

  result = yield* executor.execute(graph, Catalog.toLowerCase, {
    strategy: GraphOp.ExecutionStrategy.Parallel(8),
    cache: true,
    trace: false,
    timeout: null
  })

  console.log(`✓ Converted ${result.newNodes.length} tokens to lowercase`)
  console.log(`✓ Processed in ${Duration.toMillis(result.metrics.duration)}ms`)
  console.log()

  // Add lowercase tokens to graph
  for (const node of result.newNodes) {
    graph = EG.addNode(graph, node)
  }

  // === Step 4: Remove Stop Words ===
  console.log("Step 4: Remove Stop Words (filter out common words)")
  console.log("-".repeat(60))

  result = yield* executor.execute(graph, Catalog.removeStopWords, {
    strategy: GraphOp.ExecutionStrategy.Parallel(8),
    cache: true,
    trace: false,
    timeout: null
  })

  console.log(`✓ Filtered ${result.newNodes.length} content words (removed stop words)`)
  console.log(`✓ Processed in ${Duration.toMillis(result.metrics.duration)}ms`)
  console.log()

  // Add filtered tokens to graph
  for (const node of result.newNodes) {
    graph = EG.addNode(graph, node)
  }

  // Show some examples
  console.log("Sample content words:")
  result.newNodes.slice(0, 10).forEach((node) => {
    console.log(`  - "${node.data}"`)
  })
  console.log()

  // === Step 5: Stem ===
  console.log("Step 5: Stem (reduce words to roots)")
  console.log("-".repeat(60))

  result = yield* executor.execute(graph, Catalog.stem, {
    strategy: GraphOp.ExecutionStrategy.Parallel(8),
    cache: true,
    trace: false,
    timeout: null
  })

  console.log(`✓ Stemmed ${result.newNodes.length} tokens`)
  console.log(`✓ Processed in ${Duration.toMillis(result.metrics.duration)}ms`)
  console.log()

  // Add stemmed tokens to graph
  for (const node of result.newNodes) {
    graph = EG.addNode(graph, node)
  }

  // === Final Graph Stats ===
  console.log("Final Graph Statistics")
  console.log("=".repeat(60))
  console.log(`Total Nodes: ${EG.size(graph)}`)
  console.log(`Root Nodes: ${EG.getRoots(graph).length}`)

  const allNodes = EG.toArray(graph)
  const maxDepth = allNodes.reduce(
    (max, node) => Math.max(max, node.metadata.depth),
    0
  )
  console.log(`Max Depth: ${maxDepth}`)

  // Count by operation
  const operationCounts = new Map<string, number>()
  for (const node of allNodes) {
    if (node.metadata.operation._tag === "Some") {
      const op = node.metadata.operation.value
      operationCounts.set(op, (operationCounts.get(op) || 0) + 1)
    }
  }

  console.log()
  console.log("Nodes by Operation:")
  for (const [op, count] of operationCounts.entries()) {
    console.log(`  ${op}: ${count}`)
  }

  console.log()
  console.log("=".repeat(60))
  console.log("Demo Complete!")
  console.log("=".repeat(60))
})

// Run the program
Effect.runPromise(program.pipe(Effect.provide(AppLayer))).catch(console.error)
