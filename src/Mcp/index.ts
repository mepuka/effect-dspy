/**
 * MCP NLP Module
 *
 * Model Context Protocol server for exposing NLP operations as tools.
 * Built on @effect/ai for fully Effect-based implementation.
 *
 * @module Mcp
 *
 * @example
 * ```typescript
 * import { runServer, NlpToolkit } from "./Mcp/index.js"
 * import { NodeRuntime } from "@effect/platform-node"
 *
 * // Run the MCP server
 * NodeRuntime.runMain(runServer({
 *   name: "my-nlp-server",
 *   version: "1.0.0"
 * }))
 * ```
 */

// Server
export {
  runServer,
  runServerEffect,
  createMcpServerLayer,
  createNlpServerLayer,
  NlpMcpToolkitLayer,
  NlpToolkitHandlersLive
} from "./Server.js"
export type { McpNlpServerConfig } from "./Server.js"

// Tools & Toolkit
export {
  NlpToolkit,
  Sentencize,
  Tokenize,
  Paragraphize,
  PosTag,
  Lemmatize,
  ExtractEntities,
  Ngrams,
  BagOfWords,
  Stem,
  RemoveStopWords,
  WordCount,
  Similarity,
  Normalize,
  Analyze,
  getToolNames,
  getTool
} from "./Tools.js"

// Schemas
export * as Schemas from "./Schemas.js"
export type {
  TextInput,
  NgramInput,
  TokensInput,
  SimilarityInput,
  NormalizeInput,
  AnalyzeInput,
  TextArrayOutput,
  TextOutput,
  NumberOutput,
  POSOutput,
  EntityOutput,
  LemmaOutput,
  BagOfWordsOutput,
  AnalysisOutput,
  GraphCreateInput,
  GraphOutput,
  McpError
} from "./Schemas.js"
