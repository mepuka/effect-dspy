/**
 * MCP Streaming Tools
 *
 * Tool definitions for streaming and dataset operations using @effect/ai Tool.make.
 * Provides tools for:
 * - File streaming operations
 * - JSONL handling
 * - Dataset loading from files and URLs
 * - Text processing pipelines
 */

import { Tool, Toolkit } from "@effect/ai"
import * as Schema from "effect/Schema"

// =============================================================================
// Output Schemas
// =============================================================================

/**
 * Lines output for streaming operations
 */
export class LinesOutput extends Schema.Class<LinesOutput>("LinesOutput")({
  lines: Schema.Array(Schema.String),
  count: Schema.Number,
  truncated: Schema.Boolean
}) {}

/**
 * File info output
 */
export class FileInfoOutput extends Schema.Class<FileInfoOutput>("FileInfoOutput")({
  exists: Schema.Boolean,
  sizeBytes: Schema.optional(Schema.Number),
  lineCount: Schema.optional(Schema.Number)
}) {}

/**
 * Text stats output
 */
export class TextStatsOutput extends Schema.Class<TextStatsOutput>("TextStatsOutput")({
  totalLines: Schema.Number,
  totalBytes: Schema.Number,
  nonEmptyLines: Schema.Number,
  avgLineLength: Schema.Number,
  maxLineLength: Schema.Number,
  minLineLength: Schema.Number
}) {}

/**
 * JSONL records output
 */
export class JsonlOutput extends Schema.Class<JsonlOutput>("JsonlOutput")({
  records: Schema.Array(Schema.Unknown),
  count: Schema.Number,
  truncated: Schema.Boolean,
  errors: Schema.optional(Schema.Array(Schema.Struct({
    lineNumber: Schema.Number,
    error: Schema.String
  })))
}) {}

/**
 * JSONL stats output
 */
export class JsonlStatsOutput extends Schema.Class<JsonlStatsOutput>("JsonlStatsOutput")({
  totalLines: Schema.Number,
  successCount: Schema.Number,
  errorCount: Schema.Number,
  skippedCount: Schema.Number
}) {}

/**
 * Dataset metadata output
 */
export class DatasetMetaOutput extends Schema.Class<DatasetMetaOutput>("DatasetMetaOutput")({
  sourceType: Schema.String,
  location: Schema.String,
  format: Schema.String,
  sizeBytes: Schema.optional(Schema.Number),
  loadedAt: Schema.Number
}) {}

/**
 * Generic data output with metadata
 */
export class DataOutput extends Schema.Class<DataOutput>("DataOutput")({
  data: Schema.Unknown,
  meta: DatasetMetaOutput
}) {}

/**
 * Pipeline result output
 */
export class PipelineOutput extends Schema.Class<PipelineOutput>("PipelineOutput")({
  results: Schema.Array(Schema.Unknown),
  processed: Schema.Number,
  failed: Schema.Number,
  skipped: Schema.Number,
  durationMs: Schema.Number,
  errors: Schema.Array(Schema.Struct({
    item: Schema.Unknown,
    error: Schema.String,
    stage: Schema.String
  }))
}) {}

/**
 * Cache stats output
 */
export class CacheStatsOutput extends Schema.Class<CacheStatsOutput>("CacheStatsOutput")({
  entries: Schema.Number,
  sizeBytes: Schema.Number,
  hits: Schema.Number,
  misses: Schema.Number,
  hitRatio: Schema.Number,
  evictions: Schema.Number,
  expirations: Schema.Number
}) {}

// =============================================================================
// Streaming Tools - File Operations
// =============================================================================

/**
 * Read lines from a file with streaming (memory efficient)
 */
export const ReadLines = Tool.make("stream_read_lines", {
  description: "Read lines from a text file. Memory efficient - can handle large files. Supports head/tail operations and filtering.",
  parameters: {
    path: Schema.String.pipe(Schema.minLength(1)),
    options: Schema.optional(Schema.Struct({
      /** Maximum number of lines to return (default: 1000) */
      maxLines: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
      /** Skip first N lines */
      skip: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
      /** Get last N lines (tail mode) */
      tail: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
      /** Trim whitespace from lines */
      trim: Schema.optional(Schema.Boolean),
      /** Skip empty lines */
      skipEmpty: Schema.optional(Schema.Boolean),
      /** Text encoding */
      encoding: Schema.optional(Schema.Literal("utf-8", "ascii", "latin1"))
    }))
  },
  success: LinesOutput
})

/**
 * Get file info and statistics
 */
export const FileInfo = Tool.make("stream_file_info", {
  description: "Get information about a text file - size, line count, and statistics.",
  parameters: {
    path: Schema.String.pipe(Schema.minLength(1))
  },
  success: FileInfoOutput
})

/**
 * Compute detailed text statistics
 */
export const TextStats = Tool.make("stream_text_stats", {
  description: "Compute detailed statistics about a text file - line counts, byte sizes, line length distribution.",
  parameters: {
    path: Schema.String.pipe(Schema.minLength(1)),
    options: Schema.optional(Schema.Struct({
      trim: Schema.optional(Schema.Boolean),
      skipEmpty: Schema.optional(Schema.Boolean)
    }))
  },
  success: TextStatsOutput
})

/**
 * Sample random lines from a file
 */
export const SampleLines = Tool.make("stream_sample_lines", {
  description: "Sample random lines from a text file. Useful for creating test/validation datasets.",
  parameters: {
    path: Schema.String.pipe(Schema.minLength(1)),
    sampleSize: Schema.Number.pipe(Schema.greaterThan(0), Schema.lessThanOrEqualTo(10000)),
    options: Schema.optional(Schema.Struct({
      trim: Schema.optional(Schema.Boolean),
      skipEmpty: Schema.optional(Schema.Boolean)
    }))
  },
  success: LinesOutput
})

// =============================================================================
// Streaming Tools - JSONL Operations
// =============================================================================

/**
 * Read JSONL records from a file
 */
export const ReadJsonl = Tool.make("stream_read_jsonl", {
  description: "Read JSON Lines (JSONL/NDJSON) file. Each line is a valid JSON object. Memory efficient for large files.",
  parameters: {
    path: Schema.String.pipe(Schema.minLength(1)),
    options: Schema.optional(Schema.Struct({
      /** Maximum records to return (default: 1000) */
      maxRecords: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
      /** Skip invalid JSON lines instead of failing */
      skipInvalid: Schema.optional(Schema.Boolean),
      /** Collect parse errors */
      collectErrors: Schema.optional(Schema.Boolean)
    }))
  },
  success: JsonlOutput
})

/**
 * Get JSONL file statistics
 */
export const JsonlStats = Tool.make("stream_jsonl_stats", {
  description: "Compute statistics about a JSONL file - record counts, parse success/error rates.",
  parameters: {
    path: Schema.String.pipe(Schema.minLength(1))
  },
  success: JsonlStatsOutput
})

/**
 * Validate JSONL file structure
 */
export const ValidateJsonl = Tool.make("stream_validate_jsonl", {
  description: "Validate a JSONL file - check all lines are valid JSON and collect any parsing errors.",
  parameters: {
    path: Schema.String.pipe(Schema.minLength(1)),
    options: Schema.optional(Schema.Struct({
      /** Maximum errors to collect (default: 100) */
      maxErrors: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0)))
    }))
  },
  success: JsonlOutput
})

/**
 * Sample JSONL records
 */
export const SampleJsonl = Tool.make("stream_sample_jsonl", {
  description: "Sample random records from a JSONL file.",
  parameters: {
    path: Schema.String.pipe(Schema.minLength(1)),
    sampleSize: Schema.Number.pipe(Schema.greaterThan(0), Schema.lessThanOrEqualTo(10000)),
    options: Schema.optional(Schema.Struct({
      skipInvalid: Schema.optional(Schema.Boolean)
    }))
  },
  success: JsonlOutput
})

// =============================================================================
// Streaming Tools - Dataset Loading
// =============================================================================

/**
 * Load text from file or URL
 */
export const LoadText = Tool.make("stream_load_text", {
  description: "Load text content from a local file or remote URL. Auto-detects source type.",
  parameters: {
    location: Schema.String.pipe(Schema.minLength(1)),
    options: Schema.optional(Schema.Struct({
      /** Timeout for URL fetches in ms (default: 30000) */
      timeout: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
      /** Text encoding */
      encoding: Schema.optional(Schema.Literal("utf-8", "ascii", "latin1"))
    }))
  },
  success: DataOutput
})

/**
 * Load lines from file or URL
 */
export const LoadLines = Tool.make("stream_load_lines", {
  description: "Load text as array of lines from a local file or remote URL.",
  parameters: {
    location: Schema.String.pipe(Schema.minLength(1)),
    options: Schema.optional(Schema.Struct({
      timeout: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
      maxLines: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
      trim: Schema.optional(Schema.Boolean),
      skipEmpty: Schema.optional(Schema.Boolean)
    }))
  },
  success: DataOutput
})

/**
 * Load JSONL from file or URL
 */
export const LoadJsonl = Tool.make("stream_load_jsonl", {
  description: "Load JSONL/NDJSON records from a local file or remote URL. Auto-detects source type.",
  parameters: {
    location: Schema.String.pipe(Schema.minLength(1)),
    options: Schema.optional(Schema.Struct({
      timeout: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
      maxRecords: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
      skipInvalid: Schema.optional(Schema.Boolean)
    }))
  },
  success: DataOutput
})

/**
 * Load JSON from file or URL
 */
export const LoadJson = Tool.make("stream_load_json", {
  description: "Load and parse JSON from a local file or remote URL.",
  parameters: {
    location: Schema.String.pipe(Schema.minLength(1)),
    options: Schema.optional(Schema.Struct({
      timeout: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0)))
    }))
  },
  success: DataOutput
})

// =============================================================================
// Streaming Tools - Pipeline Operations
// =============================================================================

/**
 * Run text processing pipeline on file
 */
export const ProcessFile = Tool.make("stream_process_file", {
  description: "Run a text processing pipeline on a file. Applies transformations to each line.",
  parameters: {
    path: Schema.String.pipe(Schema.minLength(1)),
    stages: Schema.Array(Schema.Union(
      Schema.Literal("trim"),
      Schema.Literal("lowercase"),
      Schema.Literal("uppercase"),
      Schema.Literal("removePunctuation"),
      Schema.Literal("normalizeWhitespace")
    )).pipe(Schema.minItems(1)),
    options: Schema.optional(Schema.Struct({
      maxLines: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
      skipEmpty: Schema.optional(Schema.Boolean),
      stopOnError: Schema.optional(Schema.Boolean)
    }))
  },
  success: PipelineOutput
})

/**
 * Filter lines by pattern
 */
export const FilterLines = Tool.make("stream_filter_lines", {
  description: "Filter lines from a file that match a regex pattern.",
  parameters: {
    path: Schema.String.pipe(Schema.minLength(1)),
    pattern: Schema.String.pipe(Schema.minLength(1)),
    options: Schema.optional(Schema.Struct({
      /** Invert match - return non-matching lines */
      invert: Schema.optional(Schema.Boolean),
      maxLines: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
      caseInsensitive: Schema.optional(Schema.Boolean)
    }))
  },
  success: LinesOutput
})

/**
 * Extract matching content from lines
 */
export const ExtractMatches = Tool.make("stream_extract_matches", {
  description: "Extract all regex matches from a file. Returns all matched content.",
  parameters: {
    path: Schema.String.pipe(Schema.minLength(1)),
    pattern: Schema.String.pipe(Schema.minLength(1)),
    options: Schema.optional(Schema.Struct({
      /** Return full lines containing matches */
      fullLines: Schema.optional(Schema.Boolean),
      maxMatches: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
      caseInsensitive: Schema.optional(Schema.Boolean)
    }))
  },
  success: LinesOutput
})

// =============================================================================
// Streaming Tools - Batch Operations
// =============================================================================

/**
 * Count lines in file
 */
export const CountLines = Tool.make("stream_count_lines", {
  description: "Count total lines in a file. Memory efficient for large files.",
  parameters: {
    path: Schema.String.pipe(Schema.minLength(1)),
    options: Schema.optional(Schema.Struct({
      skipEmpty: Schema.optional(Schema.Boolean)
    }))
  },
  success: Schema.Struct({
    count: Schema.Number
  })
})

/**
 * Count JSONL records in file
 */
export const CountJsonl = Tool.make("stream_count_jsonl", {
  description: "Count valid JSONL records in a file.",
  parameters: {
    path: Schema.String.pipe(Schema.minLength(1)),
    options: Schema.optional(Schema.Struct({
      skipInvalid: Schema.optional(Schema.Boolean)
    }))
  },
  success: Schema.Struct({
    count: Schema.Number,
    errors: Schema.optional(Schema.Number)
  })
})

// =============================================================================
// Streaming Toolkit
// =============================================================================

/**
 * The complete streaming toolkit containing all available tools
 */
export const StreamingToolkit = Toolkit.make(
  // File operations
  ReadLines,
  FileInfo,
  TextStats,
  SampleLines,

  // JSONL operations
  ReadJsonl,
  JsonlStats,
  ValidateJsonl,
  SampleJsonl,

  // Dataset loading
  LoadText,
  LoadLines,
  LoadJsonl,
  LoadJson,

  // Pipeline operations
  ProcessFile,
  FilterLines,
  ExtractMatches,

  // Batch operations
  CountLines,
  CountJsonl
)

/**
 * Type for the streaming toolkit
 */
export type StreamingToolkit = typeof StreamingToolkit

/**
 * Get all streaming tool names
 */
export const getStreamingToolNames = (): string[] =>
  Object.keys(StreamingToolkit.tools)

/**
 * Get a specific streaming tool by name
 */
export const getStreamingTool = (name: string): Tool.Any | undefined =>
  StreamingToolkit.tools[name as keyof typeof StreamingToolkit.tools]
