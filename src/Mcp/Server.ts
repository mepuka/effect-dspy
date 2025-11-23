/**
 * MCP NLP Server
 *
 * Model Context Protocol server that exposes NLP operations as tools.
 * Built entirely on @effect/ai McpServer for fully Effect-based implementation.
 */

import { McpSchema, McpServer } from "@effect/ai"
import { NodeFileSystem } from "@effect/platform-node"
import { NodeSink, NodeStream } from "@effect/platform-node"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import { NLPService, NLPServiceLive } from "../NLPService.js"
import * as Schemas from "./Schemas.js"
import { StreamingToolkit, StreamingHandlersLayer } from "./Streaming/index.js"
import { NlpToolkit } from "./Tools.js"

// Re-export McpServerClient for external use
export const McpServerClient = McpSchema.McpServerClient

// =============================================================================
// Server Configuration
// =============================================================================

export interface McpNlpServerConfig {
  readonly name: string
  readonly version: string
  readonly description?: string
}

const DEFAULT_CONFIG: McpNlpServerConfig = {
  name: "adjunct-nlp",
  version: "1.0.0",
  description: "NLP processing server using Effect-TS and Wink NLP"
}

// =============================================================================
// Tool Handlers Layer
// =============================================================================

/**
 * Create the handlers layer for all NLP tools.
 * This implements each tool's handler using NLPService.
 */
export const NlpToolkitHandlersLive = NlpToolkit.toLayer(
  Effect.gen(function* () {
    const nlp = yield* NLPService

    return {
      nlp_sentencize: ({ text }) =>
        Effect.gen(function* () {
          const sentences = yield* nlp.sentencize(text)
          return new Schemas.TextArrayOutput({
            result: sentences as string[],
            count: sentences.length
          })
        }),

      nlp_tokenize: ({ text }) =>
        Effect.gen(function* () {
          const tokens = yield* nlp.tokenize(text)
          return new Schemas.TextArrayOutput({
            result: tokens as string[],
            count: tokens.length
          })
        }),

      nlp_paragraphize: ({ text }) =>
        Effect.gen(function* () {
          const paragraphs = yield* nlp.paragraphize(text)
          return new Schemas.TextArrayOutput({
            result: paragraphs as string[],
            count: paragraphs.length
          })
        }),

      nlp_pos_tag: ({ text }) =>
        Effect.gen(function* () {
          const posNodes = yield* nlp.posTag(text)
          return new Schemas.POSOutput({
            result: posNodes.map((node) => ({
              text: node.text,
              tag: node.tag,
              description: node.description,
              position: node.position
            })),
            count: posNodes.length
          })
        }),

      nlp_lemmatize: ({ text }) =>
        Effect.gen(function* () {
          const lemmaNodes = yield* nlp.lemmatize(text)
          return new Schemas.LemmaOutput({
            result: lemmaNodes.map((node) => ({
              token: node.token,
              lemma: node.lemma,
              pos: node.pos,
              position: node.position
            })),
            count: lemmaNodes.length
          })
        }),

      nlp_entities: ({ text }) =>
        Effect.gen(function* () {
          const entityNodes = yield* nlp.extractEntities(text)
          return new Schemas.EntityOutput({
            result: entityNodes.map((node) => ({
              text: node.text,
              entityType: node.entityType,
              span: node.span,
              confidence: node.confidence
            })),
            count: entityNodes.length
          })
        }),

      nlp_ngrams: ({ text, n }) =>
        Effect.gen(function* () {
          const ngramList = yield* nlp.ngrams(text, n)
          return new Schemas.TextArrayOutput({
            result: ngramList as string[],
            count: ngramList.length
          })
        }),

      nlp_bag_of_words: ({ tokens }) =>
        Effect.gen(function* () {
          const bow = yield* nlp.bagOfWords(tokens)
          const bowObject = Object.fromEntries(bow)
          const totalTerms = Array.from(bow.values()).reduce((a, b) => a + b, 0)
          return new Schemas.BagOfWordsOutput({
            result: bowObject,
            uniqueTerms: bow.size,
            totalTerms
          })
        }),

      nlp_stem: ({ tokens }) =>
        Effect.gen(function* () {
          const stems = yield* nlp.stem(tokens)
          return new Schemas.TextArrayOutput({
            result: stems as string[],
            count: stems.length
          })
        }),

      nlp_remove_stop_words: ({ tokens }) =>
        Effect.gen(function* () {
          const filtered = yield* nlp.removeStopWords(tokens)
          return new Schemas.TextArrayOutput({
            result: filtered as string[],
            count: filtered.length
          })
        }),

      nlp_word_count: ({ text }) =>
        Effect.gen(function* () {
          const count = yield* nlp.wordCount(text)
          return new Schemas.NumberOutput({ result: count })
        }),

      nlp_similarity: ({ text1, text2 }) =>
        Effect.gen(function* () {
          const score = yield* nlp.stringSimilarity(text1, text2)
          return new Schemas.NumberOutput({ result: score })
        }),

      nlp_normalize: ({ text, options }) =>
        Effect.gen(function* () {
          let result = text
          const opts = options ?? {}

          if (opts.removeWhitespace !== false) {
            result = yield* nlp.normalizeWhitespace(result)
          }
          if (opts.removePunctuation) {
            result = yield* nlp.removePunctuation(result)
          }
          if (opts.lowercase) {
            result = result.toLowerCase()
          }

          return new Schemas.TextOutput({ result })
        }),

      nlp_analyze: ({ text, options }) =>
        Effect.gen(function* () {
          const opts = options ?? {}

          // Default to including basic analysis
          const includeSentences = opts.sentences !== false
          const includeTokens = opts.tokens !== false
          const includePos = opts.pos === true
          const includeLemmas = opts.lemmas === true
          const includeEntities = opts.entities === true
          const ngramN = opts.ngrams

          const sentences = includeSentences
            ? (yield* nlp.sentencize(text)) as string[]
            : undefined

          const tokens = includeTokens
            ? (yield* nlp.tokenize(text)) as string[]
            : undefined

          const pos = includePos
            ? (yield* nlp.posTag(text)).map((n) => ({
                text: n.text,
                tag: n.tag,
                position: n.position
              }))
            : undefined

          const lemmas = includeLemmas
            ? (yield* nlp.lemmatize(text)).map((n) => ({
                token: n.token,
                lemma: n.lemma,
                position: n.position
              }))
            : undefined

          const entities = includeEntities
            ? (yield* nlp.extractEntities(text)).map((n) => ({
                text: n.text,
                entityType: n.entityType,
                span: n.span
              }))
            : undefined

          const ngrams = ngramN
            ? (yield* nlp.ngrams(text, ngramN)) as string[]
            : undefined

          const wordCountVal = yield* nlp.wordCount(text)

          return new Schemas.AnalysisOutput({
            text,
            sentences,
            tokens,
            pos,
            lemmas,
            entities,
            ngrams,
            wordCount: wordCountVal
          })
        })
    }
  })
).pipe(Layer.provide(NLPServiceLive))

// =============================================================================
// MCP Server Layers
// =============================================================================

/**
 * Create the MCP server layer with toolkit registration.
 * Uses McpServer.toolkit to register the NLP tools.
 */
export const NlpMcpToolkitLayer = McpServer.toolkit(NlpToolkit).pipe(
  Layer.provide(NlpToolkitHandlersLive)
)

/**
 * Create the MCP server layer with streaming toolkit registration.
 * Uses McpServer.toolkit to register the streaming tools.
 */
export const StreamingMcpToolkitLayer = McpServer.toolkit(StreamingToolkit).pipe(
  Layer.provide(StreamingHandlersLayer),
  Layer.provide(NodeFileSystem.layer)
)

/**
 * Create the complete MCP NLP server layer for stdio transport.
 */
export const createMcpServerLayer = (
  config: McpNlpServerConfig = DEFAULT_CONFIG
) =>
  McpServer.layerStdio({
    name: config.name,
    version: config.version,
    stdin: NodeStream.stdin,
    stdout: NodeSink.stdout
  })

/**
 * Create the full server layer combining NLP toolkit and server (NLP only).
 */
export const createNlpServerLayer = (
  config: McpNlpServerConfig = DEFAULT_CONFIG
) =>
  NlpMcpToolkitLayer.pipe(
    Layer.provide(createMcpServerLayer(config)),
    Layer.provide(Logger.add(Logger.prettyLogger({ stderr: true })))
  )

/**
 * Create the full server layer combining all toolkits (NLP + Streaming).
 */
export const createFullServerLayer = (
  config: McpNlpServerConfig = DEFAULT_CONFIG
) => {
  const serverLayer = createMcpServerLayer(config)
  const loggerLayer = Logger.add(Logger.prettyLogger({ stderr: true }))

  // Combine toolkit layers using provideMerge to preserve deps
  return NlpMcpToolkitLayer.pipe(
    Layer.provideMerge(StreamingMcpToolkitLayer),
    Layer.provideMerge(serverLayer),
    Layer.provideMerge(loggerLayer)
  )
}

// =============================================================================
// Server Runner
// =============================================================================

/**
 * Run the MCP server with all tools (NLP + Streaming).
 * Uses Effect Layer.launch for lifecycle management.
 */
export const runServer = (config?: McpNlpServerConfig): Effect.Effect<never> =>
  Layer.launch(createFullServerLayer(config ?? DEFAULT_CONFIG))

/**
 * Run the MCP NLP-only server.
 * Uses Effect Layer.launch for lifecycle management.
 */
export const runNlpServer = (config?: McpNlpServerConfig): Effect.Effect<never> =>
  Layer.launch(createNlpServerLayer(config ?? DEFAULT_CONFIG))

/**
 * Run the server as an Effect program (for use with Effect.runPromise)
 */
export const runServerEffect = (config?: McpNlpServerConfig): Effect.Effect<never> =>
  runServer(config)
