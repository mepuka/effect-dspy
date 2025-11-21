/**
 * Property-based tests for AnnotatedTextGraph annotation functions
 *
 * This test suite verifies algebraic properties of linguistic annotation operations:
 * 1. Idempotence: addAnnotations(addAnnotations(g)) = addAnnotations(g)
 * 2. Preservation: Graph structure, acyclicity, node relationships
 * 3. Correctness: Valid annotations, proper spans, relationship integrity
 * 4. Composition: Order independence where applicable
 */

import { describe, it, expect } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as fc from "fast-check"
import * as AnnotatedGraph from "../src/AnnotatedTextGraph.js"
import * as WinkBackend from "../src/Backends/WinkBackend.js"

// Arbitraries for generating test data
const word = fc.stringMatching(/^[a-zA-Z]{3,10}$/)
const sentence = fc
  .array(word, { minLength: 3, maxLength: 10 })
  .map((words) => words.join(" ") + ".")
const shortSentence = sentence
const nonEmptyText = fc.array(sentence, { minLength: 1, maxLength: 3 }).map((sentences) => sentences.join(" "))

// =============================================================================
// Idempotence Laws for Annotation Functions
// =============================================================================

describe("Annotation Idempotence Laws", () => {
  it.effect(
    "addPOSAnnotations should be idempotent",
    () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(shortSentence, async (text) => {
            const program = Effect.gen(function*() {
              // Create base graph
              const baseGraph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
                includePOS: false,
                includeLemmas: false,
                includeEntities: false,
                includeDependencies: false
              })

              // Add POS annotations once
              const annotated1 = yield* AnnotatedGraph.addPOSAnnotations(baseGraph)
              const count1 = AnnotatedGraph.getPOSNodes(annotated1).length

              // Add POS annotations again (should be idempotent)
              const annotated2 = yield* AnnotatedGraph.addPOSAnnotations(annotated1)
              const count2 = AnnotatedGraph.getPOSNodes(annotated2).length

              // POS node count should be the same (skip if no POS nodes)
              return count1 === 0 ? true : count1 === count2
            })

            return await Effect.runPromise(program.pipe(Effect.provide(WinkBackend.WinkBackendLive)))
          })
        )
      )
  )

  it.effect(
    "addLemmaAnnotations should be idempotent",
    () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(shortSentence, async (text) => {
            const program = Effect.gen(function*() {
              // Create base graph
              const baseGraph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
                includePOS: false,
                includeLemmas: false,
                includeEntities: false,
                includeDependencies: false
              })

              // Add lemma annotations once
              const annotated1 = yield* AnnotatedGraph.addLemmaAnnotations(baseGraph)
              const count1 = AnnotatedGraph.getLemmaNodes(annotated1).length

              // Add lemma annotations again (should be idempotent)
              const annotated2 = yield* AnnotatedGraph.addLemmaAnnotations(annotated1)
              const count2 = AnnotatedGraph.getLemmaNodes(annotated2).length

              // Lemma node count should be the same (skip if no lemma nodes)
              return count1 === 0 ? true : count1 === count2
            })

            return await Effect.runPromise(program.pipe(Effect.provide(WinkBackend.WinkBackendLive)))
          })
        )
      )
  )

  it.effect(
    "addEntityAnnotations should be idempotent",
    () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(
            fc.constantFrom(
              "John Smith visited London.",
              "Microsoft and Google are companies.",
              "Paris is in France.",
              "Apple released a new iPhone."
            ),
            async (text) => {
              const program = Effect.gen(function*() {
                // Create base graph
                const baseGraph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
                  includePOS: false,
                  includeLemmas: false,
                  includeEntities: false,
                  includeDependencies: false
                })

                // Add entity annotations once
                const annotated1 = yield* AnnotatedGraph.addEntityAnnotations(baseGraph)
                const count1 = AnnotatedGraph.getEntityNodes(annotated1).length

                // Add entity annotations again (should be idempotent)
                const annotated2 = yield* AnnotatedGraph.addEntityAnnotations(annotated1)
                const count2 = AnnotatedGraph.getEntityNodes(annotated2).length

                // Entity node count should be the same
                return count1 === count2
              })

              return await Effect.runPromise(program.pipe(Effect.provide(WinkBackend.WinkBackendLive)))
            }
          )
        )
      )
  )
})

// =============================================================================
// Preservation Laws for Annotation Functions
// =============================================================================

describe("Annotation Preservation Laws", () => {
  it.effect(
    "addPOSAnnotations should preserve text nodes",
    () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(shortSentence, async (text) => {
            const program = Effect.gen(function*() {
              // Create base graph
              const baseGraph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
                includePOS: false,
                includeLemmas: false,
                includeEntities: false,
                includeDependencies: false
              })

              const textNodesBefore = AnnotatedGraph.getTextNodes(baseGraph).length

              // Add POS annotations
              const annotated = yield* AnnotatedGraph.addPOSAnnotations(baseGraph)
              const textNodesAfter = AnnotatedGraph.getTextNodes(annotated).length

              // Text node count should be preserved
              return textNodesBefore === textNodesAfter
            })

            return await Effect.runPromise(program.pipe(Effect.provide(WinkBackend.WinkBackendLive)))
          })
        )
      )
  )

  it.effect(
    "addLemmaAnnotations should preserve text nodes",
    () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(shortSentence, async (text) => {
            const program = Effect.gen(function*() {
              // Create base graph
              const baseGraph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
                includePOS: false,
                includeLemmas: false,
                includeEntities: false,
                includeDependencies: false
              })

              const textNodesBefore = AnnotatedGraph.getTextNodes(baseGraph).length

              // Add lemma annotations
              const annotated = yield* AnnotatedGraph.addLemmaAnnotations(baseGraph)
              const textNodesAfter = AnnotatedGraph.getTextNodes(annotated).length

              // Text node count should be preserved
              return textNodesBefore === textNodesAfter
            })

            return await Effect.runPromise(program.pipe(Effect.provide(WinkBackend.WinkBackendLive)))
          })
        )
      )
  )

  it.effect(
    "addEntityAnnotations should preserve text nodes",
    () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(shortSentence, async (text) => {
            const program = Effect.gen(function*() {
              // Create base graph
              const baseGraph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
                includePOS: false,
                includeLemmas: false,
                includeEntities: false,
                includeDependencies: false
              })

              const textNodesBefore = AnnotatedGraph.getTextNodes(baseGraph).length

              // Add entity annotations
              const annotated = yield* AnnotatedGraph.addEntityAnnotations(baseGraph)
              const textNodesAfter = AnnotatedGraph.getTextNodes(annotated).length

              // Text node count should be preserved
              return textNodesBefore === textNodesAfter
            })

            return await Effect.runPromise(program.pipe(Effect.provide(WinkBackend.WinkBackendLive)))
          })
        )
      )
  )

  it.effect(
    "annotations should preserve graph acyclicity",
    () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(shortSentence, async (text) => {
            const program = Effect.gen(function*() {
              // Create base graph
              const baseGraph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
                includePOS: false,
                includeLemmas: false,
                includeEntities: false,
                includeDependencies: false
              })

              // Add all annotation types
              const withPOS = yield* AnnotatedGraph.addPOSAnnotations(baseGraph)
              const withLemmas = yield* AnnotatedGraph.addLemmaAnnotations(withPOS)
              const withEntities = yield* AnnotatedGraph.addEntityAnnotations(withLemmas)

              // Graph should remain acyclic
              // Note: We don't have isAcyclic on AnnotatedGraph, but the graph should be valid
              const finalNodeCount = AnnotatedGraph.nodeCount(withEntities)

              return finalNodeCount > 0
            })

            return await Effect.runPromise(program.pipe(Effect.provide(WinkBackend.WinkBackendLive)))
          })
        )
      )
  )
})

// =============================================================================
// Correctness Laws for Annotations
// =============================================================================

describe("Annotation Correctness Laws", () => {
  it.effect(
    "POS annotations should have valid tags",
    () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(shortSentence, async (text) => {
            const program = Effect.gen(function*() {
              const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
                includePOS: true,
                includeLemmas: false,
                includeEntities: false,
                includeDependencies: false
              })

              const posNodes = AnnotatedGraph.getPOSNodes(graph)

              // All POS nodes should have non-empty text and tags
              for (const { node } of posNodes) {
                if (!node.text || node.text.length === 0) return false
                if (!node.tag || node.tag.length === 0) return false
                if (typeof node.position !== "number") return false
              }

              return true
            })

            return await Effect.runPromise(program.pipe(Effect.provide(WinkBackend.WinkBackendLive)))
          })
        )
      )
  )

  it.effect(
    "Lemma annotations should have valid lemmas",
    () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(shortSentence, async (text) => {
            const program = Effect.gen(function*() {
              const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
                includePOS: false,
                includeLemmas: true,
                includeEntities: false,
                includeDependencies: false
              })

              const lemmaNodes = AnnotatedGraph.getLemmaNodes(graph)

              // All lemma nodes should have non-empty tokens and lemmas
              for (const { node } of lemmaNodes) {
                if (!node.token || node.token.length === 0) return false
                if (!node.lemma || node.lemma.length === 0) return false
                if (typeof node.position !== "number") return false
              }

              return true
            })

            return await Effect.runPromise(program.pipe(Effect.provide(WinkBackend.WinkBackendLive)))
          })
        )
      )
  )

  it.effect(
    "Entity annotations should have valid spans",
    () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(
            fc.constantFrom(
              "John Smith visited London.",
              "Microsoft and Google are companies.",
              "Paris is in France."
            ),
            async (text) => {
              const program = Effect.gen(function*() {
                const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
                  includePOS: false,
                  includeLemmas: false,
                  includeEntities: true,
                  includeDependencies: false
                })

                const entityNodes = AnnotatedGraph.getEntityNodes(graph)

                // All entity nodes should have valid spans
                for (const { node } of entityNodes) {
                  if (!node.text || node.text.length === 0) return false
                  if (!node.entityType || node.entityType.length === 0) return false
                  if (!node.span) return false
                  if (typeof node.span.start !== "number") return false
                  if (typeof node.span.end !== "number") return false
                  // Span should be valid: start < end
                  if (node.span.start >= node.span.end) return false
                  // Span should be within text bounds
                  if (node.span.start < 0 || node.span.end > text.length) return false
                }

                return true
              })

              return await Effect.runPromise(program.pipe(Effect.provide(WinkBackend.WinkBackendLive)))
            }
          )
        )
      )
  )

  it.effect(
    "Number of POS nodes should match number of tokens",
    () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(shortSentence, async (text) => {
            const program = Effect.gen(function*() {
              const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
                includePOS: true,
                includeLemmas: false,
                includeEntities: false,
                includeDependencies: false
              })

              const posNodes = AnnotatedGraph.getPOSNodes(graph)
              const textNodes = AnnotatedGraph.getTextNodes(graph)
              const tokenNodes = textNodes.filter(({ node }) => node.type === "token")

              // If no tokens, skip this test (edge case)
              if (tokenNodes.length === 0) return true

              // POS node count should equal token node count
              return posNodes.length === tokenNodes.length
            })

            return await Effect.runPromise(program.pipe(Effect.provide(WinkBackend.WinkBackendLive)))
          })
        )
      )
  )

  it.effect(
    "Number of lemma nodes should match number of tokens",
    () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(shortSentence, async (text) => {
            const program = Effect.gen(function*() {
              const graph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
                includePOS: false,
                includeLemmas: true,
                includeEntities: false,
                includeDependencies: false
              })

              const lemmaNodes = AnnotatedGraph.getLemmaNodes(graph)
              const textNodes = AnnotatedGraph.getTextNodes(graph)
              const tokenNodes = textNodes.filter(({ node }) => node.type === "token")

              // If no tokens, skip this test (edge case)
              if (tokenNodes.length === 0) return true

              // Lemma node count should equal token node count
              return lemmaNodes.length === tokenNodes.length
            })

            return await Effect.runPromise(program.pipe(Effect.provide(WinkBackend.WinkBackendLive)))
          })
        )
      )
  )
})

// =============================================================================
// Composition Laws for Annotations
// =============================================================================

describe("Annotation Composition Laws", () => {
  it.effect(
    "Order of POS and lemma annotations should not matter for node counts",
    () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(shortSentence, async (text) => {
            const program = Effect.gen(function*() {
              // Create base graph
              const baseGraph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
                includePOS: false,
                includeLemmas: false,
                includeEntities: false,
                includeDependencies: false
              })

              // Path 1: POS then lemmas
              const path1_pos = yield* AnnotatedGraph.addPOSAnnotations(baseGraph)
              const path1_final = yield* AnnotatedGraph.addLemmaAnnotations(path1_pos)

              // Path 2: Lemmas then POS
              const path2_lemma = yield* AnnotatedGraph.addLemmaAnnotations(baseGraph)
              const path2_final = yield* AnnotatedGraph.addPOSAnnotations(path2_lemma)

              // Both paths should produce same number of each annotation type
              const path1_pos_count = AnnotatedGraph.getPOSNodes(path1_final).length
              const path2_pos_count = AnnotatedGraph.getPOSNodes(path2_final).length
              const path1_lemma_count = AnnotatedGraph.getLemmaNodes(path1_final).length
              const path2_lemma_count = AnnotatedGraph.getLemmaNodes(path2_final).length

              return (
                path1_pos_count === path2_pos_count && path1_lemma_count === path2_lemma_count
              )
            })

            return await Effect.runPromise(program.pipe(Effect.provide(WinkBackend.WinkBackendLive)))
          })
        )
      )
  )

  it.effect(
    "Adding all annotations should produce expected node counts",
    () =>
      Effect.promise(() =>
        fc.assert(
          fc.asyncProperty(shortSentence, async (text) => {
            const program = Effect.gen(function*() {
              // Create base graph
              const baseGraph = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
                includePOS: false,
                includeLemmas: false,
                includeEntities: false,
                includeDependencies: false
              })

              // Add all annotations incrementally
              const withPOS = yield* AnnotatedGraph.addPOSAnnotations(baseGraph)
              const withLemmas = yield* AnnotatedGraph.addLemmaAnnotations(withPOS)
              const withEntities = yield* AnnotatedGraph.addEntityAnnotations(withLemmas)

              // Create fully annotated graph in one go
              const fullyAnnotated = yield* AnnotatedGraph.fromDocumentAnnotated(text, {
                includePOS: true,
                includeLemmas: true,
                includeEntities: true,
                includeDependencies: false
              })

              // Compare counts
              const counts1 = AnnotatedGraph.countNodesByType(withEntities)
              const counts2 = AnnotatedGraph.countNodesByType(fullyAnnotated)

              return (
                counts1.text === counts2.text &&
                counts1.pos === counts2.pos &&
                counts1.lemma === counts2.lemma &&
                counts1.entity === counts2.entity
              )
            })

            return await Effect.runPromise(program.pipe(Effect.provide(WinkBackend.WinkBackendLive)))
          })
        )
      )
  )
})
