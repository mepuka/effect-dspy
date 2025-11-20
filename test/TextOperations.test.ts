/**
 * Tests for TextOperations module
 */

import { describe, it, expect } from "vitest"
import * as Effect from "effect/Effect"
import * as EG from "../src/EffectGraph.js"
import * as TC from "../src/TypeClass.js"
import * as TextOps from "../src/TextOperations.js"
import { NLPServiceLive } from "../src/NLPService.js"

describe("TextOperations", () => {
  describe("Sentencization", () => {
    it("should split text into sentences", async () => {
      const text = "Hello world. This is a test. Final sentence!"
      const node = EG.makeNode(text)

      const operation = TextOps.sentencizeOperation
      const result = await Effect.runPromise(
        Effect.provide(operation.apply(node), NLPServiceLive)
      )

      expect(result.length).toBe(3)
      expect(result[0]?.data).toContain("Hello")
      expect(result[1]?.data).toContain("test")
      expect(result[2]?.data).toContain("Final")
    })

    it("should handle single sentence", async () => {
      const text = "Just one sentence"
      const node = EG.makeNode(text)

      const operation = TextOps.sentencizeOperation
      const result = await Effect.runPromise(
        Effect.provide(operation.apply(node), NLPServiceLive)
      )

      expect(result.length).toBe(1)
      expect(result[0]?.data).toBe(text)
    })

    it("should handle empty text", async () => {
      const text = ""
      const node = EG.makeNode(text)

      const operation = TextOps.sentencizeOperation
      const result = await Effect.runPromise(
        Effect.provide(operation.apply(node), NLPServiceLive)
      )

      expect(result.length).toBe(0)
    })
  })

  describe("Tokenization", () => {
    it("should split text into tokens", async () => {
      const text = "Hello world!"
      const node = EG.makeNode(text)

      const operation = TextOps.tokenizeOperation
      const result = await Effect.runPromise(
        Effect.provide(operation.apply(node), NLPServiceLive)
      )

      expect(result.length).toBeGreaterThan(2)
      const tokens = result.map((r) => r.data)
      expect(tokens).toContain("Hello")
      expect(tokens).toContain("world")
    })
  })

  describe("Graph Operations", () => {
    it("should execute sentencization on a graph", async () => {
      const text = "First sentence. Second sentence."
      const graph = EG.singleton(text)

      const result = await Effect.runPromise(
        Effect.provide(
          TC.executeOperation(graph, TextOps.sentencizeOperation),
          NLPServiceLive
        )
      )

      expect(EG.size(result)).toBe(3) // 1 original + 2 sentences
    })

    it("should create multi-level graph with sentencize + tokenize", async () => {
      const text = "Hello world."
      const graph = EG.singleton(text)

      // Apply sentencization
      const sentencized = await Effect.runPromise(
        Effect.provide(
          TC.executeOperation(graph, TextOps.sentencizeOperation),
          NLPServiceLive
        )
      )

      expect(EG.size(sentencized)).toBe(2) // 1 text + 1 sentence

      // Apply tokenization
      const tokenized = await Effect.runPromise(
        Effect.provide(
          TC.executeOperation(sentencized, TextOps.tokenizeOperation),
          NLPServiceLive
        )
      )

      expect(EG.size(tokenized)).toBeGreaterThan(3) // text + sentence + tokens
      expect(TC.depth(tokenized)).toBe(2) // 3 levels: text -> sentence -> tokens
    })
  })

  describe("Transformation Operations", () => {
    it("should lowercase text", async () => {
      const text = "HELLO WORLD"
      const node = EG.makeNode(text)

      const result = await Effect.runPromise(
        TextOps.lowercaseOperation.apply(node)
      )

      expect(result[0]?.data).toBe("hello world")
    })

    it("should uppercase text", async () => {
      const text = "hello world"
      const node = EG.makeNode(text)

      const result = await Effect.runPromise(
        TextOps.uppercaseOperation.apply(node)
      )

      expect(result[0]?.data).toBe("HELLO WORLD")
    })
  })

  describe("Forgetful Operations", () => {
    it("should join nodes with separator", async () => {
      const node1 = EG.makeNode("Hello")
      const node2 = EG.makeNode("world")

      const joinOp = TextOps.joinOperation(" ")
      const result = await Effect.runPromise(joinOp.apply([node1, node2]))

      expect(result.data).toBe("Hello world")
    })

    it("should concatenate nodes", async () => {
      const node1 = EG.makeNode("Hello")
      const node2 = EG.makeNode("World")

      const result = await Effect.runPromise(
        TextOps.concatenateOperation.apply([node1, node2])
      )

      expect(result.data).toBe("HelloWorld")
    })
  })

  describe("Adjunctions", () => {
    it("should have sentencization adjunction", () => {
      const adj = TextOps.sentencizationAdjunction

      expect(adj.expand).toBeDefined()
      expect(adj.aggregate).toBeDefined()
      expect(adj.expand.name).toBe("sentencize")
    })

    it("should demonstrate free-forgetful duality", async () => {
      const text = "Hello. World."
      const node = EG.makeNode(text)

      // Apply free (expand)
      const sentences = await Effect.runPromise(
        Effect.provide(
          TextOps.sentencizationAdjunction.expand.apply(node),
          NLPServiceLive
        )
      )

      expect(sentences.length).toBe(2)

      // Apply forgetful (aggregate)
      const rejoined = await Effect.runPromise(
        Effect.provide(
          TextOps.sentencizationAdjunction.aggregate.apply(sentences),
          NLPServiceLive
        )
      )

      // Should be similar to original (modulo whitespace)
      expect(rejoined.data).toContain("Hello")
      expect(rejoined.data).toContain("World")
    })
  })
})
