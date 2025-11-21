/**
 * Tests for AnnotatedTextGraph - Text graphs with linguistic annotations
 */

import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Graph from "effect/Graph"
import * as AnnotatedGraph from "../src/AnnotatedTextGraph.js"
import * as S from "../src/Schema.js"
import * as WinkBackend from "../src/Backends/WinkBackend.js"

// =============================================================================
// Type Guards
// =============================================================================

describe("AnnotatedTextGraph Type Guards", () => {
  it.effect("isTextNode should identify TextNode instances", () =>
    Effect.gen(function* () {
      const textNode = new S.TextNode({
        text: "test",
        type: "sentence",
        operation: "sentencize",
        timestamp: Date.now()
      })
      const posNode = new S.POSNode({
        text: "test",
        tag: "NN",
        position: 0,
        timestamp: Date.now()
      })

      expect(AnnotatedGraph.isTextNode(textNode)).toBe(true)
      expect(AnnotatedGraph.isTextNode(posNode)).toBe(false)
    })
  )

  it.effect("isPOSNode should identify POSNode instances", () =>
    Effect.gen(function* () {
      const posNode = new S.POSNode({
        text: "test",
        tag: "NN",
        position: 0,
        timestamp: Date.now()
      })
      const textNode = new S.TextNode({
        text: "test",
        type: "sentence",
        operation: "sentencize",
        timestamp: Date.now()
      })

      expect(AnnotatedGraph.isPOSNode(posNode)).toBe(true)
      expect(AnnotatedGraph.isPOSNode(textNode)).toBe(false)
    })
  )

  it.effect("isEntityNode should identify EntityNode instances", () =>
    Effect.gen(function* () {
      const entityNode = new S.EntityNode({
        text: "John",
        entityType: "PERSON",
        span: { start: 0, end: 4 },
        timestamp: Date.now()
      })
      const textNode = new S.TextNode({
        text: "test",
        type: "sentence",
        operation: "sentencize",
        timestamp: Date.now()
      })

      expect(AnnotatedGraph.isEntityNode(entityNode)).toBe(true)
      expect(AnnotatedGraph.isEntityNode(textNode)).toBe(false)
    })
  )

  it.effect("isLemmaNode should identify LemmaNode instances", () =>
    Effect.gen(function* () {
      const lemmaNode = new S.LemmaNode({
        token: "running",
        lemma: "run",
        pos: "VBG",
        position: 0,
        timestamp: Date.now()
      })
      const textNode = new S.TextNode({
        text: "test",
        type: "sentence",
        operation: "sentencize",
        timestamp: Date.now()
      })

      expect(AnnotatedGraph.isLemmaNode(lemmaNode)).toBe(true)
      expect(AnnotatedGraph.isLemmaNode(textNode)).toBe(false)
    })
  )
})

// =============================================================================
// Graph Construction
// =============================================================================

describe("AnnotatedTextGraph Construction", () => {
  it.effect("empty should create an empty graph", () =>
    Effect.gen(function* () {
      const graph = AnnotatedGraph.empty()
      expect(AnnotatedGraph.nodeCount(graph)).toBe(0)
    })
  )

  it.effect("fromDocumentAnnotated should create document and sentences", () =>
    Effect.gen(function* () {
      const text = "Hello world. This is a test."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: false,
        includeLemmas: false,
        includeEntities: false,
        includeDependencies: false
      })

      const textNodes = AnnotatedGraph.getTextNodes(graph)

      // Should have 1 document + 2 sentences = 3 text nodes
      expect(textNodes.length).toBeGreaterThanOrEqual(3)

      // Check document node exists
      const docNodes = textNodes.filter(({ node }) => node.type === "document")
      expect(docNodes.length).toBe(1)
      expect(docNodes[0].node.text).toBe(text)

      // Check sentence nodes exist
      const sentenceNodes = textNodes.filter(({ node }) => node.type === "sentence")
      expect(sentenceNodes.length).toBeGreaterThanOrEqual(2)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("fromDocumentAnnotated should add POS annotations when requested", () =>
    Effect.gen(function* () {
      const text = "Hello world."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: true,
        includeLemmas: false,
        includeEntities: false,
        includeDependencies: false
      })

      const posNodes = AnnotatedGraph.getPOSNodes(graph)

      // Should have POS nodes for tokens in "Hello world."
      expect(posNodes.length).toBeGreaterThan(0)

      // Verify POS nodes have valid structure
      posNodes.forEach(({ node }) => {
        expect(node.text).toBeTruthy()
        expect(node.tag).toBeTruthy()
        expect(typeof node.position).toBe("number")
      })
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("fromDocumentAnnotated should add lemma annotations when requested", () =>
    Effect.gen(function* () {
      const text = "The cats are running."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: false,
        includeLemmas: true,
        includeEntities: false,
        includeDependencies: false
      })

      const lemmaNodes = AnnotatedGraph.getLemmaNodes(graph)

      // Should have lemma nodes
      expect(lemmaNodes.length).toBeGreaterThan(0)

      // Verify lemma nodes have valid structure
      lemmaNodes.forEach(({ node }) => {
        expect(node.token).toBeTruthy()
        expect(node.lemma).toBeTruthy()
        expect(typeof node.position).toBe("number")
      })
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("fromDocumentAnnotated should add entity annotations when requested", () =>
    Effect.gen(function* () {
      const text = "John visited Paris."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: false,
        includeLemmas: false,
        includeEntities: true,
        includeDependencies: false
      })

      const entityNodes = AnnotatedGraph.getEntityNodes(graph)

      // Should have entity nodes (Wink's simple heuristic finds capitalized words)
      expect(entityNodes.length).toBeGreaterThan(0)

      // Verify entity nodes have valid structure
      entityNodes.forEach(({ node }) => {
        expect(node.text).toBeTruthy()
        expect(node.entityType).toBeTruthy()
        expect(node.span).toBeTruthy()
        expect(typeof node.span.start).toBe("number")
        expect(typeof node.span.end).toBe("number")
      })
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("fromDocumentAnnotated should add all annotations by default", () =>
    Effect.gen(function* () {
      const text = "Hello world."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text)

      const counts = AnnotatedGraph.countNodesByType(graph)

      // Should have text nodes, POS nodes, lemma nodes, and entity nodes
      expect(counts.text).toBeGreaterThan(0)
      expect(counts.pos).toBeGreaterThan(0)
      expect(counts.lemma).toBeGreaterThan(0)
      expect(counts.entity).toBeGreaterThan(0)

      // Dependency and relation nodes should be 0 (not supported by WinkBackend)
      expect(counts.dependency).toBe(0)
      expect(counts.relation).toBe(0)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )
})

// =============================================================================
// Annotation Functions
// =============================================================================

describe("AnnotatedTextGraph Annotation Functions", () => {
  it.effect("addPOSAnnotations should add POS nodes to existing graph", () =>
    Effect.gen(function* () {
      const text = "Test sentence."

      // Create base graph without POS
      const baseGraph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: false,
        includeLemmas: false,
        includeEntities: false,
        includeDependencies: false
      })

      // Verify no POS nodes initially
      expect(AnnotatedGraph.getPOSNodes(baseGraph).length).toBe(0)

      // Add POS annotations
      const annotatedGraph = yield* AnnotatedGraph.addPOSAnnotations(baseGraph)

      // Verify POS nodes were added
      const posNodes = AnnotatedGraph.getPOSNodes(annotatedGraph)
      expect(posNodes.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("addLemmaAnnotations should add lemma nodes to existing graph", () =>
    Effect.gen(function* () {
      const text = "Cats are running."

      // Create base graph without lemmas
      const baseGraph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: false,
        includeLemmas: false,
        includeEntities: false,
        includeDependencies: false
      })

      // Verify no lemma nodes initially
      expect(AnnotatedGraph.getLemmaNodes(baseGraph).length).toBe(0)

      // Add lemma annotations
      const annotatedGraph = yield* AnnotatedGraph.addLemmaAnnotations(baseGraph)

      // Verify lemma nodes were added
      const lemmaNodes = AnnotatedGraph.getLemmaNodes(annotatedGraph)
      expect(lemmaNodes.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("addEntityAnnotations should add entity nodes to existing graph", () =>
    Effect.gen(function* () {
      const text = "John Smith visited London."

      // Create base graph without entities
      const baseGraph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: false,
        includeLemmas: false,
        includeEntities: false,
        includeDependencies: false
      })

      // Verify no entity nodes initially
      expect(AnnotatedGraph.getEntityNodes(baseGraph).length).toBe(0)

      // Add entity annotations
      const annotatedGraph = yield* AnnotatedGraph.addEntityAnnotations(baseGraph)

      // Verify entity nodes were added
      const entityNodes = AnnotatedGraph.getEntityNodes(annotatedGraph)
      expect(entityNodes.length).toBeGreaterThan(0)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )
})

// =============================================================================
// Query Functions
// =============================================================================

describe("AnnotatedTextGraph Query Functions", () => {
  it.effect("getPOSNodes should return all POS nodes with indices", () =>
    Effect.gen(function* () {
      const text = "Hello world."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: true,
        includeLemmas: false,
        includeEntities: false
      })

      const posNodes = AnnotatedGraph.getPOSNodes(graph)

      expect(posNodes.length).toBeGreaterThan(0)

      // Each result should have index and node
      posNodes.forEach((item) => {
        expect(typeof item.index).toBe("number")
        expect(item.node).toBeInstanceOf(S.POSNode)
      })
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("filterByPOSTag should filter POS nodes by tag", () =>
    Effect.gen(function* () {
      const text = "The quick brown fox jumps."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: true,
        includeLemmas: false,
        includeEntities: false
      })

      const allPOS = AnnotatedGraph.getPOSNodes(graph)

      // Find a tag that exists in the results
      if (allPOS.length > 0) {
        const existingTag = allPOS[0].node.tag
        const filtered = AnnotatedGraph.filterByPOSTag(graph, existingTag)

        // Should find at least the one we know exists
        expect(filtered.length).toBeGreaterThan(0)

        // All results should have the requested tag
        filtered.forEach((node) => {
          expect(node.tag).toBe(existingTag)
        })
      }
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("getEntityNodes should return all entity nodes", () =>
    Effect.gen(function* () {
      const text = "John visited Paris."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: false,
        includeLemmas: false,
        includeEntities: true
      })

      const entityNodes = AnnotatedGraph.getEntityNodes(graph)

      expect(entityNodes.length).toBeGreaterThan(0)

      entityNodes.forEach((item) => {
        expect(typeof item.index).toBe("number")
        expect(item.node).toBeInstanceOf(S.EntityNode)
      })
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("filterEntitiesByType should filter entities by type", () =>
    Effect.gen(function* () {
      const text = "Microsoft and Google are companies."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: false,
        includeLemmas: false,
        includeEntities: true
      })

      const allEntities = AnnotatedGraph.getEntityNodes(graph)

      if (allEntities.length > 0) {
        const existingType = allEntities[0].node.entityType
        const filtered = AnnotatedGraph.filterEntitiesByType(graph, existingType)

        expect(filtered.length).toBeGreaterThan(0)

        filtered.forEach((node) => {
          expect(node.entityType).toBe(existingType)
        })
      }
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("getLemmaNodes should return all lemma nodes", () =>
    Effect.gen(function* () {
      const text = "Cats are running."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: false,
        includeLemmas: true,
        includeEntities: false
      })

      const lemmaNodes = AnnotatedGraph.getLemmaNodes(graph)

      expect(lemmaNodes.length).toBeGreaterThan(0)

      lemmaNodes.forEach((item) => {
        expect(typeof item.index).toBe("number")
        expect(item.node).toBeInstanceOf(S.LemmaNode)
      })
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("getTextNodes should return only structural text nodes", () =>
    Effect.gen(function* () {
      const text = "Hello world."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text)

      const textNodes = AnnotatedGraph.getTextNodes(graph)

      expect(textNodes.length).toBeGreaterThan(0)

      textNodes.forEach((item) => {
        expect(typeof item.index).toBe("number")
        expect(item.node).toBeInstanceOf(S.TextNode)
      })
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("countNodesByType should count all node types", () =>
    Effect.gen(function* () {
      const text = "Hello world."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: true,
        includeLemmas: true,
        includeEntities: true,
        includeDependencies: false
      })

      const counts = AnnotatedGraph.countNodesByType(graph)

      // Should have counts for all types
      expect(typeof counts.text).toBe("number")
      expect(typeof counts.pos).toBe("number")
      expect(typeof counts.entity).toBe("number")
      expect(typeof counts.lemma).toBe("number")
      expect(typeof counts.dependency).toBe("number")
      expect(typeof counts.relation).toBe("number")

      // Should have some text, POS, lemma, and entity nodes
      expect(counts.text).toBeGreaterThan(0)
      expect(counts.pos).toBeGreaterThan(0)
      expect(counts.lemma).toBeGreaterThan(0)
      expect(counts.entity).toBeGreaterThan(0)

      // Should have no dependency or relation nodes (not supported by Wink)
      expect(counts.dependency).toBe(0)
      expect(counts.relation).toBe(0)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )
})

// =============================================================================
// Utility Functions
// =============================================================================

describe("AnnotatedTextGraph Utilities", () => {
  it.effect("toArray should return all nodes as array", () =>
    Effect.gen(function* () {
      const text = "Hello world."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: true,
        includeLemmas: false,
        includeEntities: false
      })

      const nodes = AnnotatedGraph.toArray(graph)

      expect(Array.isArray(nodes)).toBe(true)
      expect(nodes.length).toBeGreaterThan(0)
      expect(nodes.length).toBe(AnnotatedGraph.nodeCount(graph))
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("nodeCount should return total node count", () =>
    Effect.gen(function* () {
      const text = "Hello world."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text)

      const count = AnnotatedGraph.nodeCount(graph)

      expect(typeof count).toBe("number")
      expect(count).toBeGreaterThan(0)

      const nodes = AnnotatedGraph.toArray(graph)
      expect(count).toBe(nodes.length)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("getRoots should return nodes with no incoming edges", () =>
    Effect.gen(function* () {
      const text = "Hello world."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: false,
        includeLemmas: false,
        includeEntities: false
      })

      const roots = AnnotatedGraph.getRoots(graph)

      // Should have at least one root (the document node)
      expect(roots.length).toBeGreaterThan(0)

      // Get the first root node
      const rootNode = Graph.getNode(graph, roots[0])
      expect(rootNode._tag).toBe("Some")

      if (rootNode._tag === "Some") {
        expect(AnnotatedGraph.isTextNode(rootNode.value)).toBe(true)
        if (AnnotatedGraph.isTextNode(rootNode.value)) {
          expect(rootNode.value.type).toBe("document")
        }
      }
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )
})

// =============================================================================
// Integration Tests
// =============================================================================

describe("AnnotatedTextGraph Integration", () => {
  it.effect("should handle empty text gracefully", () =>
    Effect.gen(function* () {
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated("")

      const counts = AnnotatedGraph.countNodesByType(graph)

      // Empty text should still create a document node
      expect(counts.text).toBeGreaterThanOrEqual(1)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("should handle multi-sentence documents", () =>
    Effect.gen(function* () {
      const text = "First sentence. Second sentence. Third sentence."
      const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: false,
        includeLemmas: false,
        includeEntities: false
      })

      const textNodes = AnnotatedGraph.getTextNodes(graph)
      const sentenceNodes = textNodes.filter(({ node }) => node.type === "sentence")

      // Should have 3 sentences
      expect(sentenceNodes.length).toBe(3)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )

  it.effect("should allow incremental annotation", () =>
    Effect.gen(function* () {
      const text = "Hello world."

      // Start with no annotations
      let graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
        includePOS: false,
        includeLemmas: false,
        includeEntities: false
      })

      expect(AnnotatedGraph.getPOSNodes(graph).length).toBe(0)
      expect(AnnotatedGraph.getLemmaNodes(graph).length).toBe(0)
      expect(AnnotatedGraph.getEntityNodes(graph).length).toBe(0)

      // Add POS annotations
      graph = yield* AnnotatedGraph.addPOSAnnotations(graph)
      expect(AnnotatedGraph.getPOSNodes(graph).length).toBeGreaterThan(0)

      // Add lemma annotations
      graph = yield* AnnotatedGraph.addLemmaAnnotations(graph)
      expect(AnnotatedGraph.getLemmaNodes(graph).length).toBeGreaterThan(0)

      // Add entity annotations
      graph = yield* AnnotatedGraph.addEntityAnnotations(graph)
      expect(AnnotatedGraph.getEntityNodes(graph).length).toBeGreaterThan(0)
    }).pipe(Effect.provide(WinkBackend.WinkBackendLive))
  )
})
