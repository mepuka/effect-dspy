/**
 * Tests for EffectGraph module
 */

import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { describe, expect, it } from "vitest"
import * as EG from "../src/EffectGraph.js"

describe("EffectGraph", () => {
  describe("Node Creation", () => {
    it("should create a node with generated ID", () => {
      const node = EG.makeNode("test data")

      expect(node.data).toBe("test data")
      expect(node.id).toBeDefined()
      expect(Option.isNone(node.parentId)).toBe(true)
      expect(node.metadata.depth).toBe(0)
    })

    it("should create a node with parent", () => {
      const parentId = EG.NodeId.make("parent-123")
      const node = EG.makeNode("child data", Option.some(parentId))

      expect(node.data).toBe("child data")
      expect(Option.isSome(node.parentId)).toBe(true)
      expect(Option.getOrThrow(node.parentId)).toBe(parentId)
    })

    it("should track operation in metadata", () => {
      const node = EG.makeNode(
        "data",
        Option.none(),
        Option.some("sentencize")
      )

      expect(Option.getOrThrow(node.metadata.operation)).toBe("sentencize")
    })
  })

  describe("Graph Construction", () => {
    it("should create an empty graph", () => {
      const graph = EG.empty<string>()

      expect(EG.size(graph)).toBe(0)
      expect(EG.getRoots(graph).length).toBe(0)
    })

    it("should create a singleton graph", () => {
      const graph = EG.singleton("hello")

      expect(EG.size(graph)).toBe(1)
      expect(EG.getRoots(graph).length).toBe(1)
      expect(EG.getRoots(graph)[0]?.data).toBe("hello")
    })

    it("should add nodes to graph", () => {
      let graph = EG.empty<string>()
      const node1 = EG.makeNode("first")
      const node2 = EG.makeNode("second", Option.some(node1.id))

      graph = EG.addNode(graph, node1)
      graph = EG.addNode(graph, node2)

      expect(EG.size(graph)).toBe(2)
      expect(EG.getRoots(graph).length).toBe(1)
      expect(EG.getRoots(graph)[0]?.id).toBe(node1.id)
    })

    it("should maintain parent-child relationships", () => {
      const parent = EG.makeNode("parent")
      const child1 = EG.makeNode("child1", Option.some(parent.id))
      const child2 = EG.makeNode("child2", Option.some(parent.id))

      let graph = EG.empty<string>()
      graph = EG.addNode(graph, parent)
      graph = EG.addNode(graph, child1)
      graph = EG.addNode(graph, child2)

      const children = EG.getChildren(graph, parent.id)
      expect(children.length).toBe(2)
      expect(children.map((c: EG.GraphNode<string>) => c.data)).toContain("child1")
      expect(children.map((c: EG.GraphNode<string>) => c.data)).toContain("child2")
    })

    it("should calculate depth correctly", () => {
      const root = EG.makeNode("root")
      const child = EG.makeNode("child", Option.some(root.id))
      const grandchild = EG.makeNode("grandchild", Option.some(child.id))

      let graph = EG.empty<string>()
      graph = EG.addNode(graph, root)
      graph = EG.addNode(graph, child)
      graph = EG.addNode(graph, grandchild)

      const retrievedRoot = EG.getNode(graph, root.id)
      const retrievedChild = EG.getNode(graph, child.id)
      const retrievedGrandchild = EG.getNode(graph, grandchild.id)

      expect(Option.getOrThrow(retrievedRoot).metadata.depth).toBe(0)
      expect(Option.getOrThrow(retrievedChild).metadata.depth).toBe(1)
      expect(Option.getOrThrow(retrievedGrandchild).metadata.depth).toBe(2)
    })
  })

  describe("Graph Operations", () => {
    it("should map over graph data", () => {
      const graph = EG.singleton("hello")
      const mapped = EG.map(graph, (s: string) => s.toUpperCase())

      expect(EG.getRoots(mapped)[0]?.data).toBe("HELLO")
    })

    it("should convert graph to array", () => {
      const root = EG.makeNode("root")
      const child1 = EG.makeNode("child1", Option.some(root.id))
      const child2 = EG.makeNode("child2", Option.some(root.id))

      let graph = EG.empty<string>()
      graph = EG.addNode(graph, root)
      graph = EG.addNode(graph, child1)
      graph = EG.addNode(graph, child2)

      const arr = EG.toArray(graph)
      expect(arr.length).toBe(3)
    })
  })

  describe("Catamorphism", () => {
    it("should fold a simple graph", async () => {
      const graph = EG.singleton(5)

      const algebra: EG.GraphAlgebra<number, number> = (
        node: EG.GraphNode<number>,
        children: ReadonlyArray<number>
      ) => {
        const childSum = children.reduce((a: number, b: number) => a + b, 0)
        return node.data + childSum
      }

      const result = await Effect.runPromise(EG.cata(graph, algebra))

      expect(result).toEqual([5])
    })

    it("should fold a graph with children", async () => {
      const root = EG.makeNode(10)
      const child1 = EG.makeNode(5, Option.some(root.id))
      const child2 = EG.makeNode(3, Option.some(root.id))

      let graph = EG.empty<number>()
      graph = EG.addNode(graph, root)
      graph = EG.addNode(graph, child1)
      graph = EG.addNode(graph, child2)

      // Sum all values
      const algebra: EG.GraphAlgebra<number, number> = (
        node: EG.GraphNode<number>,
        children: ReadonlyArray<number>
      ) => {
        const childSum = children.reduce((a: number, b: number) => a + b, 0)
        return node.data + childSum
      }

      const result = await Effect.runPromise(EG.cata(graph, algebra))

      // Root gets: 10 + (5 + 3) = 18
      expect(result).toEqual([18])
    })

    it("should collect all data in bottom-up order", async () => {
      const root = EG.makeNode("root")
      const child1 = EG.makeNode("child1", Option.some(root.id))
      const child2 = EG.makeNode("child2", Option.some(root.id))

      let graph = EG.empty<string>()
      graph = EG.addNode(graph, root)
      graph = EG.addNode(graph, child1)
      graph = EG.addNode(graph, child2)

      const algebra: EG.GraphAlgebra<string, Array<string>> = (
        node: EG.GraphNode<string>,
        children: ReadonlyArray<Array<string>>
      ) => {
        const allChildren = children.flat()
        return [...allChildren, node.data]
      }

      const result = await Effect.runPromise(EG.cata(graph, algebra))

      // Should have children before parent
      expect(result[0]).toContain("child1")
      expect(result[0]).toContain("child2")
      expect(result[0]).toContain("root")
      const rootIndex = result[0]?.indexOf("root") ?? -1
      const child1Index = result[0]?.indexOf("child1") ?? -1
      expect(rootIndex).toBeGreaterThan(child1Index)
    })
  })

  describe("Anamorphism", () => {
    it("should unfold a graph from a seed", async () => {
      // Create a binary tree structure
      const coalgebra: EG.GraphCoalgebra<number, number> = (seed: number) =>
        Effect.succeed(
          seed <= 1 ? [seed, []] : [seed, [seed - 1, seed - 2]]
        )

      const graph = await Effect.runPromise(EG.ana(3, coalgebra))

      expect(EG.size(graph)).toBeGreaterThan(1)
      expect(EG.getRoots(graph).length).toBe(1)
      expect(EG.getRoots(graph)[0]?.data).toBe(3)
    })
  })

  describe("Graph Visualization", () => {
    it("should show graph structure", () => {
      const root = EG.makeNode("root")
      const child = EG.makeNode("child", Option.some(root.id))

      let graph = EG.empty<string>()
      graph = EG.addNode(graph, root)
      graph = EG.addNode(graph, child)

      const output = EG.show(graph, (s: string) => s)

      expect(output).toContain("root")
      expect(output).toContain("child")
    })
  })
})
