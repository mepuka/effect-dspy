
# Graph Operations Engine

The **Graph Operations Engine** is the core computational substrate for Adjunct. It provides a mathematically rigorous, type-safe, and production-ready foundation for executing NLP operations on directed acyclic graphs (DAGs).

## Overview

Operations are modeled as **morphisms in the category of graphs**, enabling:

- **Composability** - Operations compose via categorical laws
- **Type Safety** - Full Effect type inference
- **Performance** - Parallel execution, caching, optimization
- **Observability** - Complete metrics and tracing
- **Verifiability** - Algebraic laws guarantee correctness

## Quick Start

```typescript
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as EG from "../EffectGraph.js"
import * as GraphOp from "./GraphOperations/index.js"
import * as Catalog from "./GraphOperations/Catalog.js"
import { NLPServiceLive } from "../NLPService.js"

const program = Effect.gen(function*() {
  const executor = yield* GraphOp.GraphExecutor

  // Create graph
  const graph = EG.singleton("Hello world. How are you?")

  // Execute operation
  const result = yield* executor.execute(
    graph,
    Catalog.sentencize,
    {
      strategy: GraphOp.ExecutionStrategy.Parallel(4),
      cache: true
    }
  )

  console.log(`Created ${result.newNodes.length} sentences`)
  console.log(`Processed in ${Duration.toMillis(result.metrics.duration)}ms`)
})

const AppLayer = Layer.mergeAll(
  GraphOp.GraphExecutorTest,
  NLPServiceLive
)

Effect.runPromise(program.pipe(Effect.provide(AppLayer)))
```

## Architecture

### Core Abstractions

**GraphOperation<A, B, R, E>**
- `A` - Input node data type
- `B` - Output node data type
- `R` - Required context (e.g., NLPService, LanguageModel)
- `E` - Possible error type

**GraphExecutor**
- Executes operations on graphs
- Supports multiple strategies (Sequential, Parallel, Batch, Streaming)
- Manages caching and metrics
- Validates operations before execution

**ResultStore**
- Caches operation results
- Avoids recomputation
- Provides statistics and garbage collection

### Execution Strategies

**Sequential**
```typescript
GraphOp.ExecutionStrategy.Sequential
```
- Processes nodes one at a time
- Guarantees order
- No concurrency

**Parallel**
```typescript
GraphOp.ExecutionStrategy.Parallel(concurrency)
```
- Processes independent nodes concurrently
- Respects dependencies
- Maximizes throughput

**Batch**
```typescript
GraphOp.ExecutionStrategy.Batch(batchSize)
```
- Groups nodes into batches
- Useful for LLM operations (batch API calls)

**Streaming**
```typescript
GraphOp.ExecutionStrategy.Streaming
```
- Processes nodes as they become available
- Real-time progress updates

## Standard Operations

The `Catalog` module provides ready-to-use operations:

### Text Splitting
- `sentencize` - Split text into sentences
- `tokenize` - Split text into words/tokens
- `paragraphize` - Split text into paragraphs
- `ngrams(n)` - Generate n-grams

### Text Cleaning
- `normalizeWhitespace` - Collapse spaces, trim
- `removePunctuation` - Remove punctuation marks
- `removeStopWords` - Filter common words
- `stem` - Porter stemming

### String Transforms
- `toLowerCase` - Convert to lowercase
- `toUpperCase` - Convert to uppercase
- `trim` - Remove leading/trailing whitespace
- `length` - Get character count

## Creating Custom Operations

### Pure Operation
```typescript
import * as Op from "./GraphOperations/Operation.js"

const reverse = Op.transform({
  name: "reverse",
  description: "Reverse text",
  f: (text) => text.split("").reverse().join("")
})
```

### Effectful Operation
```typescript
const extractEntities = Op.make<string, Entity, LanguageModel, LLMError>({
  name: "extractEntities",
  description: "Extract named entities using LLM",
  category: "llm",
  apply: (node) =>
    Effect.gen(function*() {
      const llm = yield* LanguageModel
      const response = yield* llm.generate({
        messages: [{
          role: "user",
          content: `Extract entities from: ${node.data}`
        }]
      })
      const entities = parseEntities(response.content)
      return entities.map(e =>
        EG.makeNode(e, Option.some(node.id), Option.some("extractEntities"))
      )
    }),
  validate: (node) =>
    Effect.succeed(
      node.data.length > 0
        ? Types.ValidationResult.valid()
        : Types.ValidationResult.invalid(["Text is empty"])
    ),
  estimateCost: (node) =>
    Effect.succeed({
      estimatedTime: Duration.seconds(2),
      tokenCost: estimateTokens(node.data),
      memoryCost: node.data.length * 10,
      complexity: "O(n)"
    })
})
```

## Composition

Operations compose naturally:

```typescript
const pipeline = Effect.gen(function*() {
  const executor = yield* GraphOp.GraphExecutor

  let graph = EG.singleton(text)

  // Step 1: Sentencize
  let result = yield* executor.execute(graph, Catalog.sentencize)
  for (const node of result.newNodes) {
    graph = EG.addNode(graph, node)
  }

  // Step 2: Tokenize
  result = yield* executor.execute(graph, Catalog.tokenize)
  for (const node of result.newNodes) {
    graph = EG.addNode(graph, node)
  }

  // Step 3: Remove stop words
  result = yield* executor.execute(graph, Catalog.removeStopWords)
  for (const node of result.newNodes) {
    graph = EG.addNode(graph, node)
  }

  return graph
})
```

## Caching

Enable caching to avoid recomputation:

```typescript
const result = yield* executor.execute(
  graph,
  operation,
  { cache: true }
)

console.log(`Cache hits: ${result.metrics.cacheHits}`)
console.log(`Cache misses: ${result.metrics.cacheMisses}`)
```

## Validation

Validate operations before execution:

```typescript
const validation = yield* executor.validate(graph, operation)

if (!validation.valid) {
  console.error("Validation errors:", validation.errors)
}
```

## Cost Estimation

Estimate operation cost:

```typescript
const cost = yield* executor.estimateCost(graph, operation)

console.log(`Estimated time: ${Duration.toMillis(cost.estimatedTime)}ms`)
console.log(`Token cost: ${cost.tokenCost}`)
console.log(`Complexity: ${cost.complexity}`)
```

## Metrics

All executions collect metrics:

```typescript
interface ExecutionMetrics {
  readonly duration: Duration
  readonly nodesProcessed: number
  readonly nodesCreated: number
  readonly tokensConsumed: number
  readonly cacheHits: number
  readonly cacheMisses: number
}
```

## Testing

Run tests:

```bash
bun test test/GraphOperations/Executor.test.ts
```

Run demo:

```bash
bunx tsx scripts/demo-executor.ts
```

## Mathematical Foundations

### Category Theory

Operations form a category where:
- **Objects**: `EffectGraph<A>` (graphs)
- **Morphisms**: `GraphOperation<A, B>` (transformations)
- **Composition**: Sequential composition of operations
- **Identity**: `Op.identity<A>()`

**Laws:**
```
// Associativity
(f ∘ g) ∘ h = f ∘ (g ∘ h)

// Identity
id ∘ f = f = f ∘ id

// Functoriality
map(f ∘ g) = map(f) ∘ map(g)
```

### Recursion Schemes

**Catamorphism (Fold)** - Bottom-up consumption
```typescript
EG.cata(graph, algebra)
```

**Anamorphism (Unfold)** - Top-down generation
```typescript
EG.ana(seed, coalgebra)
```

### Monoid Structure

Metrics form a monoid:
```typescript
const combined = ExecutionMetrics.combine(metrics1, metrics2)
```

## Future Enhancements

- [ ] **Execution Planning** - Multi-operation optimization
- [ ] **Streaming Support** - Real-time execution updates
- [ ] **Batch Optimization** - Group similar operations
- [ ] **Persistent Caching** - IndexedDB storage
- [ ] **Query API** - SQL-like graph queries
- [ ] **Observability** - OpenTelemetry tracing

## References

- Main documentation: `docs/GRAPH-OPERATIONS-ENGINE.md`
- Architecture plan: `docs/agentic-nlp-workbench-plan.md`
- Effect documentation: https://effect.website/docs

---

**Status:** ✅ Production Ready (Core Engine)
**Version:** 1.0
**Last Updated:** 2025-11-21
