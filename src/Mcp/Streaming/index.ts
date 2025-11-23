/**
 * Streaming - Effect-based streaming utilities for NLP processing
 *
 * This module provides comprehensive text streaming and data loading utilities:
 *
 * - **TextStream**: Memory-efficient file streaming with line-by-line processing
 * - **Jsonl**: JSONL/NDJSON parsing and writing with schema validation
 * - **DatasetLoader**: Unified interface for loading from files, URLs, and strings
 * - **Cache**: In-memory caching with TTL and LRU eviction
 * - **Pipeline**: Composable text processing workflows
 *
 * @module Mcp/Streaming
 *
 * @example
 * ```typescript
 * import { TextStream, Jsonl, DatasetLoader, Cache, Pipeline } from "./Streaming/index.js"
 * import { NodeFileSystem } from "@effect/platform-node"
 * import * as Effect from "effect/Effect"
 *
 * // Stream large file line by line
 * const program = TextStream.streamLines("/path/to/large-file.txt", { trim: true })
 *   .pipe(
 *     Stream.filter((line) => line.length > 0),
 *     Stream.mapEffect(processLine),
 *     Stream.runDrain
 *   )
 *   .pipe(Effect.provide(NodeFileSystem.layer))
 *
 * // Load JSONL with schema validation
 * const records = yield* Jsonl.readJsonlSchema(
 *   RecordSchema,
 *   "/path/to/data.jsonl"
 * )
 *
 * // Auto-detect and load from URL
 * const dataset = yield* DatasetLoader.load("https://example.com/data.jsonl")
 *
 * // Build processing pipeline
 * const results = yield* Pipeline.fromFile("/path/to/corpus.txt")
 *   .map("normalize", (line) => line.toLowerCase().trim())
 *   .filter((line) => line.length > 10)
 *   .run()
 * ```
 */

// =============================================================================
// TextStream Exports
// =============================================================================

export * as TextStream from "./TextStream.js"

export {
  // Types
  type TextEncoding,
  type TextReadOptions,
  type TextStreamOptions,

  // Classes
  TextLine,
  TextStreamStats,

  // Errors
  TextStreamError,
  FileNotFoundError,
  EncodingError,

  // Core streaming functions
  streamLines,
  streamLinesWithMetadata,
  readTextFile,
  readLines,
  countLines,
  computeStats,

  // Batch processing
  streamBatches,
  streamParallel,

  // Text transformations
  streamParagraphs,
  streamChunks,
  streamSentences,

  // Writing utilities
  writeLines,
  writeTextFile,

  // Utility functions
  fileExists,
  getFileSize,
  sampleLines,
  head,
  tail
} from "./TextStream.js"

// =============================================================================
// JSONL Exports
// =============================================================================

export * as Jsonl from "./Jsonl.js"

export {
  // Types
  type JsonlReadOptions,
  type JsonlWriteOptions,
  type JsonlParseResult,

  // Classes
  JsonlStats,

  // Errors
  JsonlParseError,
  JsonlValidationError,

  // Streaming functions
  streamJsonl,
  streamJsonlSchema,
  streamJsonlResults,
  readJsonl,
  readJsonlSchema,

  // Batch processing
  streamJsonlBatches,
  streamJsonlParallel,

  // Writing functions
  writeJsonl,
  writeJsonlStream,
  appendJsonl,

  // Statistics and validation
  computeJsonlStats,
  validateJsonl,

  // Utility functions
  countJsonlRecords,
  headJsonl,
  sampleJsonl,
  filterJsonl,
  mapJsonl,
  parseJsonlString,
  stringifyJsonl
} from "./Jsonl.js"

// =============================================================================
// DatasetLoader Exports
// =============================================================================

export * as DatasetLoader from "./DatasetLoader.js"

export {
  // Types
  type DataSourceType,
  type DataFormat,
  type DataSource,
  type DatasetLoadOptions,
  type DatasetResult,

  // Classes
  DatasetMeta,

  // Errors
  DatasetLoadError,
  NetworkError,
  UnsupportedFormatError,

  // Core loading functions
  loadText,
  loadLines,
  loadJsonl,
  loadJson,
  load,

  // Streaming loaders
  streamFromSource,
  streamJsonlFromSource,

  // Convenience functions
  fromFile,
  fromUrl,
  jsonlFromFile,
  jsonlFromUrl,
  jsonFromFile,
  jsonFromUrl
} from "./DatasetLoader.js"

// =============================================================================
// Cache Exports
// =============================================================================

export * as CacheModule from "./Cache.js"

export {
  // Types
  type CacheConfig,
  type CacheResult,

  // Service
  Cache,
  type CacheService,

  // Classes
  CacheStats,

  // Layers
  layer as cacheLayer,
  defaultLayer as defaultCacheLayer,
  shortLivedLayer as shortLivedCacheLayer,
  longLivedLayer as longLivedCacheLayer,

  // Helper functions
  get as cacheGet,
  set as cacheSet,
  getOrSet as cacheGetOrSet,
  has as cacheHas,
  del as cacheDel,
  clear as cacheClear,
  stats as cacheStats,
  makeKey,
  namespacedKey,

  // Decorators
  cached,
  memoize
} from "./Cache.js"

// =============================================================================
// Pipeline Exports
// =============================================================================

export * as PipelineModule from "./Pipeline.js"

export {
  // Types
  type PipelineStage,
  type PipelineConfig,

  // Classes
  Pipeline,
  StreamPipeline,
  PipelineProgress,
  PipelineResult,

  // Pre-built stages
  TextStages,
  PipelineOps,

  // Factory functions
  stage,
  syncStage,
  filterStage
} from "./Pipeline.js"

// =============================================================================
// Streaming Tools Exports (MCP)
// =============================================================================

export * as StreamingTools from "./StreamingTools.js"

export {
  // Output schemas
  LinesOutput,
  FileInfoOutput,
  TextStatsOutput,
  JsonlOutput,
  JsonlStatsOutput,
  DatasetMetaOutput,
  DataOutput,
  PipelineOutput,
  CacheStatsOutput,

  // Tools
  ReadLines,
  FileInfo,
  TextStats,
  SampleLines,
  ReadJsonl,
  JsonlStats as JsonlStatsTool,
  ValidateJsonl,
  SampleJsonl,
  LoadText,
  LoadLines,
  LoadJsonl as LoadJsonlTool,
  LoadJson,
  ProcessFile,
  FilterLines,
  ExtractMatches,
  CountLines,
  CountJsonl,

  // Toolkit
  StreamingToolkit,
  type StreamingToolkit as StreamingToolkitType,
  getStreamingToolNames,
  getStreamingTool
} from "./StreamingTools.js"

// =============================================================================
// Streaming Handlers Exports (MCP)
// =============================================================================

export {
  makeStreamingHandlers,
  StreamingHandlersLayer
} from "./StreamingHandlers.js"
