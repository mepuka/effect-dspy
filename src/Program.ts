/**
 * MVP Demo - Text Processing as Graph Transformations
 *
 * This program demonstrates the core architecture:
 * 1. Create a graph with a single text node
 * 2. Apply sentencization operation → creates child nodes for each sentence
 * 3. Apply tokenization operation → creates grandchild nodes for each token
 * 4. Visualize the resulting DAG structure
 *
 * This shows the fundamental pattern: operations produce new nodes,
 * creating layers in the graph that can be folded/reduced as needed.
 */

import * as Effect from "effect/Effect"
import * as Console from "effect/Console"
import * as EffectGraph from "./EffectGraph.js"
import * as TypeClass from "./TypeClass.js"
import * as TextOperations from "./TextOperations.js"
import { NLPServiceLive } from "./NLPService.js"

// =============================================================================
// Example 1: Basic Sentencization
// =============================================================================

const basicSentencizationExample = Effect.gen(function* () {
  yield* Console.log("=" .repeat(60))
  yield* Console.log("Example 1: Basic Sentencization")
  yield* Console.log("=" .repeat(60))

  // Step 1: Create initial graph with a single text node
  const inputText =
    "Hello world. This is Effect-DSPy! We model text processing as graph transformations."

  yield* Console.log("\n📝 Input Text:")
  yield* Console.log(`"${inputText}"`)

  const initialGraph = EffectGraph.singleton(inputText)

  yield* Console.log(`\n📊 Initial Graph: ${EffectGraph.size(initialGraph)} node(s)`)

  // Step 2: Apply sentencization operation
  yield* Console.log("\n🔄 Applying sentencization operation...")

  const sentencizedGraph = yield* TypeClass.executeOperation(
    initialGraph,
    TextOperations.sentencizeOperation
  )

  yield* Console.log(`\n📊 After Sentencization: ${EffectGraph.size(sentencizedGraph)} node(s)`)

  // Step 3: Display the graph structure
  yield* Console.log("\n🌲 Graph Structure:")
  yield* Console.log(
    EffectGraph.show(sentencizedGraph, data =>
      typeof data === "string" ? `"${data}"` : JSON.stringify(data)
    )
  )

  // Step 4: Extract all sentence data
  const sentences = TypeClass.collectData(sentencizedGraph).filter(
    (data): data is string => typeof data === "string"
  )

  yield* Console.log("\n📋 Extracted Sentences:")
  for (let i = 1; i < sentences.length; i++) {
    yield* Console.log(`  ${i}. "${sentences[i]}"`)
  }
})

// =============================================================================
// Example 2: Sentencization + Tokenization (Multi-level DAG)
// =============================================================================

const multiLevelExample = Effect.gen(function* () {
  yield* Console.log("\n\n" + "=".repeat(60))
  yield* Console.log("Example 2: Multi-Level Processing (Sentences → Tokens)")
  yield* Console.log("=" .repeat(60))

  // Step 1: Create initial graph
  const inputText = "Effect-TS is amazing. Category theory rocks!"

  yield* Console.log("\n📝 Input Text:")
  yield* Console.log(`"${inputText}"`)

  const initialGraph = EffectGraph.singleton(inputText)

  // Step 2: Apply sentencization
  yield* Console.log("\n🔄 Step 1: Sentencization...")
  const sentencizedGraph = yield* TypeClass.executeOperation(
    initialGraph,
    TextOperations.sentencizeOperation
  )

  yield* Console.log(`📊 Graph size: ${EffectGraph.size(sentencizedGraph)} nodes`)

  // Step 3: Apply tokenization to sentences
  yield* Console.log("\n🔄 Step 2: Tokenization...")
  const tokenizedGraph = yield* TypeClass.executeOperation(
    sentencizedGraph,
    TextOperations.tokenizeOperation
  )

  yield* Console.log(`📊 Graph size: ${EffectGraph.size(tokenizedGraph)} nodes`)
  yield* Console.log(`📏 Graph depth: ${TypeClass.depth(tokenizedGraph)} levels`)

  // Step 4: Display the complete DAG
  yield* Console.log("\n🌲 Complete DAG Structure:")
  yield* Console.log(
    EffectGraph.show(tokenizedGraph, data =>
      typeof data === "string" ? `"${data}"` : JSON.stringify(data)
    )
  )
})

// =============================================================================
// Example 3: Using Catamorphism to Fold the Graph
// =============================================================================

const catamorphismExample = Effect.gen(function* () {
  yield* Console.log("\n\n" + "=".repeat(60))
  yield* Console.log("Example 3: Catamorphism (Folding the Graph)")
  yield* Console.log("=" .repeat(60))

  // Step 1: Build a graph with sentences
  const inputText = "One. Two. Three."

  const initialGraph = EffectGraph.singleton(inputText)
  const sentencizedGraph = yield* TypeClass.executeOperation(
    initialGraph,
    TextOperations.sentencizeOperation
  )

  yield* Console.log("\n📝 Input: \"One. Two. Three.\"")
  yield* Console.log("📊 After sentencization: 4 nodes (1 text + 3 sentences)")

  // Step 2: Define an algebra that counts characters
  const charCountAlgebra: EffectGraph.GraphAlgebra<string | any, number> = (
    node,
    childrenCounts
  ) => {
    const nodeChars = typeof node.data === "string" ? node.data.length : 0
    const childrenTotal = childrenCounts.reduce((a, b) => a + b, 0)
    return nodeChars + childrenTotal
  }

  // Step 3: Apply catamorphism
  yield* Console.log("\n🔄 Applying catamorphism to count total characters...")
  const results = yield* EffectGraph.cata(sentencizedGraph, charCountAlgebra)

  yield* Console.log(`\n✅ Total characters (from root): ${results[0]}`)

  // Step 4: Another algebra - collect all text in reverse depth order
  const collectAlgebra: EffectGraph.GraphAlgebra<
    string | any,
    ReadonlyArray<string>
  > = (node, childrenTexts) => {
    const nodeText = typeof node.data === "string" ? [node.data] : []
    const allChildTexts = childrenTexts.flat()
    return [...allChildTexts, ...nodeText]
  }

  const collectedTexts = yield* EffectGraph.cata(
    sentencizedGraph,
    collectAlgebra
  )

  yield* Console.log("\n📋 Collected texts (bottom-up order):")
  const texts = collectedTexts[0] || []
  for (let i = 0; i < texts.length; i++) {
    yield* Console.log(`  ${i + 1}. "${texts[i]}"`)
  }
})

// =============================================================================
// Example 4: Pipeline Composition
// =============================================================================

const pipelineExample = Effect.gen(function* () {
  yield* Console.log("\n\n" + "=".repeat(60))
  yield* Console.log("Example 4: Pipeline Composition")
  yield* Console.log("=" .repeat(60))

  const inputText =
    "  Hello   World!   This is   a test.  Category theory   is beautiful.  "

  yield* Console.log("\n📝 Input (with messy whitespace):")
  yield* Console.log(`"${inputText}"`)

  // Apply the standard pipeline: normalize → sentencize → filter
  const initialGraph = EffectGraph.singleton(inputText)

  yield* Console.log("\n🔄 Applying standard pipeline:")
  yield* Console.log("  1. Normalize whitespace")
  yield* Console.log("  2. Sentencize")
  yield* Console.log("  3. Filter empty sentences")

  const processedGraph = yield* TypeClass.executeOperations(
    initialGraph,
    TextOperations.standardPipeline
  )

  yield* Console.log(`\n📊 Final graph: ${EffectGraph.size(processedGraph)} nodes`)

  yield* Console.log("\n🌲 Result:")
  yield* Console.log(
    EffectGraph.show(processedGraph, data =>
      typeof data === "string" ? `"${data}"` : JSON.stringify(data)
    )
  )
})

// =============================================================================
// Main Program
// =============================================================================

const program = Effect.gen(function* () {
  yield* Console.log("\n🚀 Effect-DSPy: Text Processing as Graph Transformations\n")

  // Run all examples
  yield* basicSentencizationExample
  yield* multiLevelExample
  yield* catamorphismExample
  yield* pipelineExample

  yield* Console.log("\n\n" + "=".repeat(60))
  yield* Console.log("✨ All examples completed successfully!")
  yield* Console.log("=" .repeat(60))
  yield* Console.log(
    "\n💡 Key Takeaways:"
  )
  yield* Console.log(
    "  • Text operations create child nodes in a DAG"
  )
  yield* Console.log(
    "  • Catamorphisms fold the graph bottom-up"
  )
  yield* Console.log(
    "  • Operations are pure, composable, and type-safe"
  )
  yield* Console.log(
    "  • NLP wrapped in Effect for dependency injection"
  )
  yield* Console.log("")
})

// Provide the NLP service and run the program
const runnable = Effect.provide(program, NLPServiceLive)

Effect.runPromise(runnable).catch(console.error)
