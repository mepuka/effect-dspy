/**
 * Tests for TextGraph module using Effect's Graph
 */

import * as Effect from "effect/Effect"
import * as Graph from "effect/Graph"
import { describe, expect, test } from "vitest"
import * as TG from "../src/TextGraph.js"
import * as NLP from "../src/NLPService.js"
import * as S from "../src/Schema.js"

describe("TextGraph", () => {
  describe("Construction", () => {
    test("should create an empty graph", () => {
      const graph = TG.empty()

      expect(TG.nodeCount(graph)).toBe(0)
      expect(TG.edgeCount(graph)).toBe(0)
    })

    test("should create a singleton graph", () => {
      const graph = TG.singleton("Hello world", "document")

      expect(TG.nodeCount(graph)).toBe(1)
      const nodes = TG.toArray(graph)
      expect(nodes[0]?.text).toBe("Hello world")
      expect(nodes[0]?.type).toBe("document")
    })

    test.skip("should create a graph from a document", async () => {
      const text = "First sentence. Second sentence. Third sentence."
      const graph = await Effect.runPromise(
        TG.fromDocument(text).pipe(Effect.provide(NLP.NLPServiceLive))
      )

      expect(TG.nodeCount(graph)).toBeGreaterThan(1)

      // Should have document node plus sentence nodes
      const docNodes = TG.findNodesByType(graph, "document")
      const sentenceNodes = TG.findNodesByType(graph, "sentence")

      expect(docNodes.length).toBe(1)
      expect(sentenceNodes.length).toBe(3)
    })
  })

  describe("Graph Operations", () => {
    test("should add children to a node", () => {
      const graph = TG.singleton("Parent", "sentence")
      const parentIdx = TG.getRoots(graph)[0]

      if (parentIdx === undefined) {
        throw new Error("No root node found")
      }

      const children = [
        new S.TextNode({
          text: "Child 1",
          type: "token",
          timestamp: Date.now()
        }),
        new S.TextNode({
          text: "Child 2",
          type: "token",
          timestamp: Date.now()
        })
      ]

      const newGraph = TG.addChildren(graph, parentIdx, children, "contains")

      expect(TG.nodeCount(newGraph)).toBe(3)
      expect(TG.edgeCount(newGraph)).toBe(2)
    })

    test.skip("should tokenize nodes in the graph", async () => {
      const graph = TG.singleton("Hello world", "sentence")
      const tokenizedGraph = await Effect.runPromise(
        TG.tokenizeNodes(graph).pipe(Effect.provide(NLP.NLPServiceLive))
      )

      // Should have original sentence plus tokens
      const sentenceNodes = TG.findNodesByType(tokenizedGraph, "sentence")
      const tokenNodes = TG.findNodesByType(tokenizedGraph, "token")

      expect(sentenceNodes.length).toBe(1)
      expect(tokenNodes.length).toBeGreaterThan(0)
    })

    test("should map over nodes", () => {
      const graph = TG.singleton("hello", "token")

      const mappedGraph = TG.mapNodes(graph, (node) =>
        new S.TextNode({
          ...node,
          text: node.text.toUpperCase()
        })
      )

      const nodes = TG.toArray(mappedGraph)
      expect(nodes[0]?.text).toBe("HELLO")
    })

    test("should filter nodes", () => {
      let graph = TG.empty()

      graph = Graph.mutate(graph, (mutable) => {
        Graph.addNode(
          mutable,
          new S.TextNode({ text: "sentence", type: "sentence", timestamp: Date.now() })
        )
        Graph.addNode(
          mutable,
          new S.TextNode({ text: "token", type: "token", timestamp: Date.now() })
        )
      })

      const filtered = TG.filterNodes(graph, (node) => node.type === "sentence")

      expect(TG.nodeCount(filtered)).toBe(1)
      const nodes = TG.toArray(filtered)
      expect(nodes[0]?.type).toBe("sentence")
    })
  })

  describe("Traversal", () => {
    test("should traverse in DFS order", () => {
      const graph = Graph.directed<S.TextNode, S.TextEdge>((mutable) => {
        const root = Graph.addNode(
          mutable,
          new S.TextNode({ text: "root", type: "document", timestamp: Date.now() })
        )
        const child1 = Graph.addNode(
          mutable,
          new S.TextNode({ text: "child1", type: "sentence", timestamp: Date.now() })
        )
        const child2 = Graph.addNode(
          mutable,
          new S.TextNode({ text: "child2", type: "sentence", timestamp: Date.now() })
        )

        Graph.addEdge(mutable, root, child1, new S.TextEdge({ relation: "contains" }))
        Graph.addEdge(mutable, root, child2, new S.TextEdge({ relation: "contains" }))
      })

      const dfsNodes = Array.from(Graph.values(TG.dfs(graph, [0])))
      expect(dfsNodes.length).toBe(3)
      expect(dfsNodes[0]?.text).toBe("root")
    })

    test("should traverse in BFS order", () => {
      const graph = Graph.directed<S.TextNode, S.TextEdge>((mutable) => {
        const root = Graph.addNode(
          mutable,
          new S.TextNode({ text: "root", type: "document", timestamp: Date.now() })
        )
        const child1 = Graph.addNode(
          mutable,
          new S.TextNode({ text: "child1", type: "sentence", timestamp: Date.now() })
        )

        Graph.addEdge(mutable, root, child1, new S.TextEdge({ relation: "contains" }))
      })

      const bfsNodes = Array.from(Graph.values(TG.bfs(graph, [0])))
      expect(bfsNodes.length).toBe(2)
    })

    test("should get roots and leaves", () => {
      const graph = Graph.directed<S.TextNode, S.TextEdge>((mutable) => {
        const root = Graph.addNode(
          mutable,
          new S.TextNode({ text: "root", type: "document", timestamp: Date.now() })
        )
        const child = Graph.addNode(
          mutable,
          new S.TextNode({ text: "child", type: "sentence", timestamp: Date.now() })
        )

        Graph.addEdge(mutable, root, child, new S.TextEdge({ relation: "contains" }))
      })

      const roots = TG.getRoots(graph)
      const leaves = TG.getLeaves(graph)

      expect(roots.length).toBe(1)
      expect(leaves.length).toBe(1)
      expect(roots[0]).toBe(0)
      expect(leaves[0]).toBe(1)
    })
  })

  describe("Queries", () => {
    test("should find nodes by type", () => {
      const graph = Graph.directed<S.TextNode, S.TextEdge>((mutable) => {
        Graph.addNode(
          mutable,
          new S.TextNode({ text: "doc", type: "document", timestamp: Date.now() })
        )
        Graph.addNode(
          mutable,
          new S.TextNode({ text: "sent", type: "sentence", timestamp: Date.now() })
        )
        Graph.addNode(
          mutable,
          new S.TextNode({ text: "tok", type: "token", timestamp: Date.now() })
        )
      })

      const sentences = TG.findNodesByType(graph, "sentence")
      const tokens = TG.findNodesByType(graph, "token")

      expect(sentences.length).toBe(1)
      expect(tokens.length).toBe(1)
    })

    test("should check if graph is acyclic", () => {
      const acyclicGraph = Graph.directed<S.TextNode, S.TextEdge>((mutable) => {
        const a = Graph.addNode(
          mutable,
          new S.TextNode({ text: "A", type: "document", timestamp: Date.now() })
        )
        const b = Graph.addNode(
          mutable,
          new S.TextNode({ text: "B", type: "sentence", timestamp: Date.now() })
        )

        Graph.addEdge(mutable, a, b, new S.TextEdge({ relation: "contains" }))
      })

      expect(TG.isAcyclic(acyclicGraph)).toBe(true)
    })
  })

  describe("Visualization", () => {
    test("should export to GraphViz", () => {
      const graph = TG.singleton("Test", "document")
      const dot = TG.toGraphViz(graph)

      expect(dot).toContain("digraph")
      expect(dot).toContain("Test")
    })

    test("should export to Mermaid", () => {
      const graph = TG.singleton("Test", "document")
      const mermaid = TG.toMermaid(graph)

      expect(mermaid).toContain("flowchart")
      expect(mermaid).toContain("Test")
    })

    test("should show graph structure", () => {
      const graph = TG.singleton("Test", "document")
      const output = TG.show(graph)

      expect(output).toContain("document")
      expect(output).toContain("Test")
    })
  })
})
