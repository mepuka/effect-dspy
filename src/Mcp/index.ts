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
  runNlpServer,
  runServerEffect,
  createMcpServerLayer,
  createNlpServerLayer,
  createFullServerLayer,
  NlpMcpToolkitLayer,
  StreamingMcpToolkitLayer,
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

// =============================================================================
// Streaming Module
// =============================================================================

/**
 * Streaming utilities for text processing pipelines.
 *
 * Provides:
 * - **TextStream**: Memory-efficient file streaming
 * - **Jsonl**: JSONL/NDJSON parsing and writing
 * - **DatasetLoader**: Load from files, URLs, strings
 * - **Cache**: In-memory caching with TTL
 * - **Pipeline**: Composable processing workflows
 * - **StreamingTools**: MCP tools for streaming operations
 */
export * as Streaming from "./Streaming/index.js"

// Re-export commonly used streaming utilities
export {
  // TextStream utilities
  streamLines,
  readTextFile,
  readLines,
  countLines,
  head,
  tail,
  TextStreamError,
  FileNotFoundError,

  // JSONL utilities
  streamJsonl,
  readJsonl,
  writeJsonl,
  JsonlParseError,

  // DatasetLoader utilities
  load,
  loadText,
  loadLines,
  loadJsonl,
  loadJson,
  fromFile,
  fromUrl,
  NetworkError,
  DatasetLoadError,

  // Cache utilities
  Cache,
  cached,
  memoize,
  cacheLayer,
  defaultCacheLayer,

  // Pipeline utilities
  Pipeline,
  StreamPipeline,
  TextStages,

  // Streaming toolkit for MCP
  StreamingToolkit,
  getStreamingToolNames,
  StreamingHandlersLayer
} from "./Streaming/index.js"
