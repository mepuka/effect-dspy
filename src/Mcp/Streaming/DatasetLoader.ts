/**
 * DatasetLoader - Effect-based dataset loading utilities
 *
 * Provides unified interface for loading text data from:
 * - Local files
 * - Remote URLs (HTTP/HTTPS)
 * - Inline strings
 *
 * Features:
 * - Automatic format detection
 * - Streaming for large files
 * - Built-in caching
 * - Progress tracking
 *
 * @module Mcp/Streaming/DatasetLoader
 */

import { FileSystem, Path } from "@effect/platform"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

import {
  FileNotFoundError,
  readTextFile,
  streamLines,
  TextStreamError,
  type TextEncoding,
  type TextReadOptions,
  type TextStreamOptions
} from "./TextStream.js"
import {
  JsonlParseError,
  JsonlValidationError,
  readJsonl,
  streamJsonl,
  type JsonlReadOptions
} from "./Jsonl.js"

// =============================================================================
// Types and Schemas
// =============================================================================

/**
 * Supported data source types
 */
export type DataSourceType = "file" | "url" | "string"

/**
 * Supported data formats
 */
export type DataFormat = "text" | "lines" | "jsonl" | "json" | "csv"

/**
 * Data source specification
 */
export interface DataSource {
  /** Type of source */
  readonly type: DataSourceType
  /** Path, URL, or content string */
  readonly location: string
  /** Data format (auto-detected if not specified) */
  readonly format?: DataFormat
  /** Text encoding (default: utf-8) */
  readonly encoding?: TextEncoding
}

/**
 * Options for loading datasets
 */
export interface DatasetLoadOptions extends TextReadOptions {
  /** Cache results (default: true for URLs, false for files) */
  readonly cache?: boolean | undefined
  /** Cache TTL in milliseconds (default: 5 minutes) */
  readonly cacheTtl?: number | undefined
  /** Timeout for URL fetches in milliseconds (default: 30 seconds) */
  readonly timeout?: number | undefined
  /** User agent for HTTP requests */
  readonly userAgent?: string | undefined
  /** Custom headers for HTTP requests */
  readonly headers?: Record<string, string> | undefined
  /** Skip SSL verification (default: false) */
  readonly insecure?: boolean | undefined
}

/**
 * Loaded dataset metadata
 */
export class DatasetMeta extends Schema.Class<DatasetMeta>("DatasetMeta")({
  /** Source type */
  sourceType: Schema.Literal("file", "url", "string"),
  /** Source location */
  location: Schema.String,
  /** Detected or specified format */
  format: Schema.Literal("text", "lines", "jsonl", "json", "csv"),
  /** Content size in bytes (if known) */
  sizeBytes: Schema.optional(Schema.Number),
  /** Load timestamp */
  loadedAt: Schema.Number,
  /** Whether result was cached */
  fromCache: Schema.Boolean
}) {}

/**
 * Result of loading a dataset
 */
export interface DatasetResult<A> {
  readonly data: A
  readonly meta: DatasetMeta
}

// =============================================================================
// Error Types
// =============================================================================

export class DatasetLoadError extends Schema.TaggedError<DatasetLoadError>()("DatasetLoadError", {
  message: Schema.String,
  source: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

export class NetworkError extends Schema.TaggedError<NetworkError>()("NetworkError", {
  message: Schema.String,
  url: Schema.String,
  statusCode: Schema.optional(Schema.Number)
}) {}

export class UnsupportedFormatError extends Schema.TaggedError<UnsupportedFormatError>()("UnsupportedFormatError", {
  format: Schema.String,
  message: Schema.String
}) {}

// =============================================================================
// Format Detection
// =============================================================================

/**
 * Detect format from file extension or URL path
 */
const detectFormat = (location: string): DataFormat => {
  const lower = location.toLowerCase()

  if (lower.endsWith(".jsonl") || lower.endsWith(".ndjson")) {
    return "jsonl"
  }
  if (lower.endsWith(".json")) {
    return "json"
  }
  if (lower.endsWith(".csv")) {
    return "csv"
  }
  if (lower.endsWith(".txt") || lower.endsWith(".text")) {
    return "text"
  }

  // Default to lines for unknown formats
  return "lines"
}

/**
 * Detect source type from location
 */
const detectSourceType = (location: string): DataSourceType => {
  if (location.startsWith("http://") || location.startsWith("https://")) {
    return "url"
  }
  if (location.includes("\n") || (!location.includes("/") && !location.includes("\\"))) {
    // Contains newlines or no path separators - likely inline string
    // But only if it's short or has newlines
    if (location.length < 100 || location.includes("\n")) {
      return "string"
    }
  }
  return "file"
}

// =============================================================================
// HTTP Utilities
// =============================================================================

/**
 * Fetch text content from a URL
 */
const fetchUrl = (
  url: string,
  options: DatasetLoadOptions = {}
): Effect.Effect<string, NetworkError> => {
  const timeout = options.timeout ?? 30000
  const userAgent = options.userAgent ?? "Effect-DatasetLoader/1.0"
  const headers = options.headers ?? {}

  return Effect.tryPromise({
    try: async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": userAgent,
            ...headers
          },
          signal: controller.signal
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        return await response.text()
      } finally {
        clearTimeout(timeoutId)
      }
    },
    catch: (e) => new NetworkError({
      message: e instanceof Error ? e.message : String(e),
      url,
      statusCode: undefined
    })
  })
}

/**
 * Stream content from a URL (for large files)
 */
const streamUrl = (
  url: string,
  options: DatasetLoadOptions = {}
): Stream.Stream<string, NetworkError> => {
  const timeout = options.timeout ?? 30000
  const userAgent = options.userAgent ?? "Effect-DatasetLoader/1.0"
  const headers = options.headers ?? {}

  return Stream.unwrap(
    Effect.tryPromise({
      try: async () => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": userAgent,
            ...headers
          },
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const text = await response.text()
        return Stream.fromIterable(text.split("\n"))
      },
      catch: (e) => new NetworkError({
        message: e instanceof Error ? e.message : String(e),
        url,
        statusCode: undefined
      })
    })
  )
}

// =============================================================================
// Core Loading Functions
// =============================================================================

/**
 * Load text content from any source.
 *
 * @example
 * ```typescript
 * // From file
 * const content = yield* loadText({ type: "file", location: "/path/to/file.txt" })
 *
 * // From URL
 * const content = yield* loadText({ type: "url", location: "https://example.com/data.txt" })
 *
 * // From string
 * const content = yield* loadText({ type: "string", location: "Hello, World!" })
 * ```
 */
export const loadText = (
  source: DataSource,
  options: DatasetLoadOptions = {}
): Effect.Effect<DatasetResult<string>, DatasetLoadError | FileNotFoundError | NetworkError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const sourceType = source.type
    const location = source.location
    const loadedAt = Date.now()

    let content: string
    let sizeBytes: number | undefined

    switch (sourceType) {
      case "file": {
        content = yield* readTextFile(location, source.encoding).pipe(
          Effect.mapError((e) =>
            e instanceof FileNotFoundError
              ? e
              : new DatasetLoadError({ message: String(e), source: location, cause: e })
          )
        )
        sizeBytes = Buffer.byteLength(content, source.encoding ?? "utf-8")
        break
      }

      case "url": {
        content = yield* fetchUrl(location, options)
        sizeBytes = Buffer.byteLength(content, "utf-8")
        break
      }

      case "string": {
        content = location
        sizeBytes = Buffer.byteLength(content, "utf-8")
        break
      }
    }

    return {
      data: content,
      meta: new DatasetMeta({
        sourceType,
        location: sourceType === "string" ? "<inline>" : location,
        format: "text",
        sizeBytes,
        loadedAt,
        fromCache: false
      })
    }
  })

/**
 * Load text content as array of lines.
 */
export const loadLines = (
  source: DataSource,
  options: DatasetLoadOptions = {}
): Effect.Effect<DatasetResult<ReadonlyArray<string>>, DatasetLoadError | FileNotFoundError | NetworkError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const result = yield* loadText(source, options)

    const lines = result.data
      .split("\n")
      .map((line) => options.trim ? line.trim() : line)
      .filter((line) => !options.skipEmpty || line.length > 0)

    return {
      data: lines,
      meta: new DatasetMeta({
        ...result.meta,
        format: "lines"
      })
    }
  })

/**
 * Load JSONL content from any source.
 */
export const loadJsonl = <A = unknown>(
  source: DataSource,
  options: DatasetLoadOptions & JsonlReadOptions = {}
): Effect.Effect<DatasetResult<ReadonlyArray<A>>, DatasetLoadError | FileNotFoundError | NetworkError | JsonlParseError | JsonlValidationError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const sourceType = source.type
    const location = source.location
    const loadedAt = Date.now()

    let data: ReadonlyArray<A>
    let sizeBytes: number | undefined

    switch (sourceType) {
      case "file": {
        data = yield* readJsonl<A>(location, options).pipe(
          Effect.mapError((e) => {
            if (e instanceof FileNotFoundError) return e
            if (e instanceof JsonlParseError) return e
            if (e instanceof JsonlValidationError) return e
            return new DatasetLoadError({ message: String(e), source: location, cause: e })
          })
        )
        break
      }

      case "url": {
        const content = yield* fetchUrl(location, options)
        sizeBytes = Buffer.byteLength(content, "utf-8")

        const lines = content.split("\n").filter((line) => line.trim().length > 0)
        data = yield* Effect.forEach(lines, (line, index) => {
          const trimmed = line.trim()
          return Effect.try({
            try: () => JSON.parse(trimmed) as A,
            catch: (e) => new JsonlParseError({
              message: e instanceof Error ? e.message : String(e),
              line: trimmed.slice(0, 100),
              lineNumber: index
            })
          })
        })
        break
      }

      case "string": {
        const lines = location.split("\n").filter((line) => line.trim().length > 0)
        sizeBytes = Buffer.byteLength(location, "utf-8")

        data = yield* Effect.forEach(lines, (line, index) => {
          const trimmed = line.trim()
          return Effect.try({
            try: () => JSON.parse(trimmed) as A,
            catch: (e) => new JsonlParseError({
              message: e instanceof Error ? e.message : String(e),
              line: trimmed.slice(0, 100),
              lineNumber: index
            })
          })
        })
        break
      }
    }

    return {
      data,
      meta: new DatasetMeta({
        sourceType,
        location: sourceType === "string" ? "<inline>" : location,
        format: "jsonl",
        sizeBytes,
        loadedAt,
        fromCache: false
      })
    }
  })

/**
 * Load JSON content from any source.
 */
export const loadJson = <A = unknown>(
  source: DataSource,
  options: DatasetLoadOptions = {}
): Effect.Effect<DatasetResult<A>, DatasetLoadError | FileNotFoundError | NetworkError | JsonlParseError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const result = yield* loadText(source, options)

    const data = yield* Effect.try({
      try: () => JSON.parse(result.data) as A,
      catch: (e) => new JsonlParseError({
        message: e instanceof Error ? e.message : String(e),
        line: result.data.slice(0, 100),
        lineNumber: 0
      })
    })

    return {
      data,
      meta: new DatasetMeta({
        ...result.meta,
        format: "json"
      })
    }
  })

// =============================================================================
// Auto-Detection Loading
// =============================================================================

/**
 * Load dataset with automatic format and source detection.
 *
 * @example
 * ```typescript
 * // Auto-detects file type and format
 * const data = yield* load("/path/to/data.jsonl")
 *
 * // Auto-detects URL and format
 * const data = yield* load("https://example.com/dataset.jsonl")
 * ```
 */
export const load = <A = unknown>(
  location: string,
  options: DatasetLoadOptions = {}
): Effect.Effect<DatasetResult<A | ReadonlyArray<A> | ReadonlyArray<string> | string>, DatasetLoadError | FileNotFoundError | NetworkError | JsonlParseError | JsonlValidationError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const sourceType = detectSourceType(location)
    const format = detectFormat(location)

    const source: DataSource = {
      type: sourceType,
      location,
      format
    }

    switch (format) {
      case "jsonl":
        return yield* loadJsonl<A>(source, options)

      case "json":
        return yield* loadJson<A>(source, options)

      case "lines":
        return yield* loadLines(source, options)

      case "text":
      default:
        return yield* loadText(source, options)
    }
  })

// =============================================================================
// Streaming Loaders
// =============================================================================

/**
 * Stream lines from any source.
 */
export const streamFromSource = (
  source: DataSource,
  options: TextStreamOptions = {}
): Stream.Stream<string, DatasetLoadError | FileNotFoundError | NetworkError | TextStreamError, FileSystem.FileSystem | Path.Path> => {
  const sourceType = source.type
  const location = source.location

  switch (sourceType) {
    case "file":
      return streamLines(location, options) as Stream.Stream<string, DatasetLoadError | FileNotFoundError | NetworkError | TextStreamError, FileSystem.FileSystem | Path.Path>

    case "url":
      return streamUrl(location, options as any) as Stream.Stream<string, DatasetLoadError | FileNotFoundError | NetworkError | TextStreamError, FileSystem.FileSystem | Path.Path>

    case "string":
      return Stream.fromIterable(
        location
          .split("\n")
          .map((line) => options.trim ? line.trim() : line)
          .filter((line) => !options.skipEmpty || line.length > 0)
      ) as Stream.Stream<string, DatasetLoadError | FileNotFoundError | NetworkError | TextStreamError, FileSystem.FileSystem | Path.Path>
  }
}

/**
 * Stream JSONL records from any source.
 */
export const streamJsonlFromSource = <A = unknown>(
  source: DataSource,
  options: JsonlReadOptions = {}
): Stream.Stream<A, DatasetLoadError | FileNotFoundError | NetworkError | JsonlParseError | JsonlValidationError, FileSystem.FileSystem | Path.Path> => {
  const sourceType = source.type
  const location = source.location

  switch (sourceType) {
    case "file":
      return streamJsonl<A>(location, options).pipe(
        Stream.mapError((e) => {
          if (e instanceof FileNotFoundError) return e
          if (e instanceof JsonlParseError) return e
          if (e instanceof JsonlValidationError) return e
          return new DatasetLoadError({ message: String(e), source: location, cause: e })
        })
      )

    case "url":
    case "string": {
      const content = sourceType === "url"
        ? Stream.unwrap(fetchUrl(location, options as any).pipe(Effect.map((text) => Stream.succeed(text))))
        : Stream.succeed(location)

      return content.pipe(
        Stream.flatMap((text) => Stream.fromIterable(text.split("\n"))),
        Stream.map((line) => line.trim()),
        Stream.filter((line) => line.length > 0),
        Stream.zipWithIndex,
        Stream.mapEffect(([line, lineNumber]) =>
          Effect.try({
            try: () => JSON.parse(line) as A,
            catch: (e) => new JsonlParseError({
              message: e instanceof Error ? e.message : String(e),
              line: line.slice(0, 100),
              lineNumber
            })
          })
        )
      )
    }
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

// Error union types for convenience functions
type LoadTextError = DatasetLoadError | FileNotFoundError | NetworkError
type LoadJsonlError = DatasetLoadError | FileNotFoundError | NetworkError | JsonlParseError | JsonlValidationError
type LoadJsonError = DatasetLoadError | FileNotFoundError | NetworkError | JsonlParseError

/**
 * Load text from a file path (shorthand).
 */
export const fromFile = (
  path: string,
  options: DatasetLoadOptions = {}
): Effect.Effect<string, LoadTextError, FileSystem.FileSystem | Path.Path> =>
  loadText({ type: "file", location: path }, options).pipe(
    Effect.map((r) => r.data)
  )

/**
 * Load text from a URL (shorthand).
 */
export const fromUrl = (
  url: string,
  options: DatasetLoadOptions = {}
): Effect.Effect<string, LoadTextError, FileSystem.FileSystem | Path.Path> =>
  loadText({ type: "url", location: url }, options).pipe(
    Effect.map((r) => r.data)
  )

/**
 * Load JSONL from a file path (shorthand).
 */
export const jsonlFromFile = <A = unknown>(
  path: string,
  options: DatasetLoadOptions & JsonlReadOptions = {}
): Effect.Effect<ReadonlyArray<A>, LoadJsonlError, FileSystem.FileSystem | Path.Path> =>
  loadJsonl<A>({ type: "file", location: path }, options).pipe(
    Effect.map((r) => r.data)
  )

/**
 * Load JSONL from a URL (shorthand).
 */
export const jsonlFromUrl = <A = unknown>(
  url: string,
  options: DatasetLoadOptions & JsonlReadOptions = {}
): Effect.Effect<ReadonlyArray<A>, LoadJsonlError, FileSystem.FileSystem | Path.Path> =>
  loadJsonl<A>({ type: "url", location: url }, options).pipe(
    Effect.map((r) => r.data)
  )

/**
 * Load JSON from a file path (shorthand).
 */
export const jsonFromFile = <A = unknown>(
  path: string,
  options: DatasetLoadOptions = {}
): Effect.Effect<A, LoadJsonError, FileSystem.FileSystem | Path.Path> =>
  loadJson<A>({ type: "file", location: path }, options).pipe(
    Effect.map((r) => r.data)
  )

/**
 * Load JSON from a URL (shorthand).
 */
export const jsonFromUrl = <A = unknown>(
  url: string,
  options: DatasetLoadOptions = {}
): Effect.Effect<A, LoadJsonError, FileSystem.FileSystem | Path.Path> =>
  loadJson<A>({ type: "url", location: url }, options).pipe(
    Effect.map((r) => r.data)
  )
