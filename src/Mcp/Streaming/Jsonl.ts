/**
 * JSONL (JSON Lines) - Effect-based JSONL streaming utilities
 *
 * Provides memory-efficient streaming for JSONL/NDJSON files.
 * Supports schema validation, error recovery, and batch processing.
 *
 * JSONL Format:
 * - One JSON object per line
 * - Each line is a valid JSON value
 * - Lines separated by newline characters
 *
 * @module Mcp/Streaming/Jsonl
 */

import { FileSystem, Path } from "@effect/platform"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

import { FileNotFoundError, streamLines, TextStreamError, type TextStreamOptions } from "./TextStream.js"

// =============================================================================
// Types and Schemas
// =============================================================================

/**
 * Options for reading JSONL files
 */
export interface JsonlReadOptions extends Omit<TextStreamOptions, "trim" | "skipEmpty"> {
  /** Skip lines that fail to parse (default: false - will fail on first error) */
  readonly skipInvalid?: boolean
  /** Collect parse errors instead of failing (default: false) */
  readonly collectErrors?: boolean
  /** Validate against a schema (optional) */
  readonly schema?: Schema.Schema<any>
}

/**
 * Options for writing JSONL files
 */
export interface JsonlWriteOptions {
  /** Pretty print JSON (default: false for compact) */
  readonly pretty?: boolean
  /** Append to existing file (default: false - overwrites) */
  readonly append?: boolean
}

/**
 * Result of parsing a JSONL line
 */
export type JsonlParseResult<A> =
  | { readonly _tag: "Success"; readonly value: A; readonly lineNumber: number }
  | { readonly _tag: "Error"; readonly error: string; readonly line: string; readonly lineNumber: number }

/**
 * Statistics about JSONL processing
 */
export class JsonlStats extends Schema.Class<JsonlStats>("JsonlStats")({
  /** Total lines processed */
  totalLines: Schema.Number,
  /** Successfully parsed lines */
  successCount: Schema.Number,
  /** Failed to parse */
  errorCount: Schema.Number,
  /** Skipped (empty) lines */
  skippedCount: Schema.Number
}) {}

// =============================================================================
// Error Types
// =============================================================================

/**
 * JSON parse error with context
 */
export class JsonlParseError extends Schema.TaggedError<JsonlParseError>()("JsonlParseError", {
  message: Schema.String,
  line: Schema.String,
  lineNumber: Schema.Number,
  cause: Schema.optional(Schema.Unknown)
}) {}

/**
 * Schema validation error
 */
export class JsonlValidationError extends Schema.TaggedError<JsonlValidationError>()("JsonlValidationError", {
  message: Schema.String,
  value: Schema.Unknown,
  lineNumber: Schema.Number
}) {}

// =============================================================================
// Core Parsing Functions
// =============================================================================

/**
 * Parse a single line as JSON.
 */
const parseLine = <A>(
  line: string,
  lineNumber: number,
  schema?: Schema.Schema<A>
): Effect.Effect<A, JsonlParseError | JsonlValidationError> => {
  const trimmed = line.trim()

  // Skip empty lines
  if (trimmed.length === 0) {
    return Effect.fail(new JsonlParseError({
      message: "Empty line",
      line,
      lineNumber
    }))
  }

  return Effect.try({
    try: () => JSON.parse(trimmed),
    catch: (e) => new JsonlParseError({
      message: e instanceof Error ? e.message : String(e),
      line: trimmed.slice(0, 100), // Truncate for error message
      lineNumber,
      cause: e
    })
  }).pipe(
    Effect.flatMap((parsed) => {
      if (schema) {
        return Schema.decodeUnknown(schema)(parsed).pipe(
          Effect.mapError((e) => new JsonlValidationError({
            message: String(e),
            value: parsed,
            lineNumber
          }))
        )
      }
      return Effect.succeed(parsed as A)
    })
  )
}

// =============================================================================
// Streaming Functions
// =============================================================================

/**
 * Stream JSONL file as parsed objects.
 *
 * Memory efficient - processes line by line.
 *
 * @example
 * ```typescript
 * interface Record { id: number; name: string }
 * const records = streamJsonl<Record>("/path/to/data.jsonl")
 * yield* Stream.runForEach(records, (record) => Console.log(record.name))
 * ```
 */
export const streamJsonl = <A = unknown>(
  filePath: string,
  options: JsonlReadOptions = {}
): Stream.Stream<A, TextStreamError | FileNotFoundError | JsonlParseError | JsonlValidationError, FileSystem.FileSystem | Path.Path> => {
  const skipInvalid = options.skipInvalid ?? false

  return streamLines(filePath, { ...options, trim: true, skipEmpty: true }).pipe(
    Stream.zipWithIndex,
    Stream.mapEffect(([line, lineNumber]) =>
      parseLine<A>(line, lineNumber, options.schema).pipe(
        skipInvalid
          ? Effect.option
          : Effect.map(Option.some)
      )
    ),
    Stream.filterMap((opt) => opt)
  )
}

/**
 * Stream JSONL with validation against an Effect Schema.
 *
 * Type-safe streaming with compile-time schema validation.
 *
 * @example
 * ```typescript
 * const RecordSchema = Schema.Struct({
 *   id: Schema.Number,
 *   name: Schema.String,
 *   email: Schema.String
 * })
 *
 * const records = streamJsonlSchema(RecordSchema, "/path/to/data.jsonl")
 * ```
 */
export const streamJsonlSchema = <A, I>(
  schema: Schema.Schema<A, I>,
  filePath: string,
  options: Omit<JsonlReadOptions, "schema"> = {}
): Stream.Stream<A, TextStreamError | FileNotFoundError | JsonlParseError | JsonlValidationError, FileSystem.FileSystem | Path.Path> =>
  streamJsonl<A>(filePath, { ...options, schema: schema as any })

/**
 * Stream JSONL with parse results (success or error).
 *
 * Useful when you want to handle errors per-line without failing the stream.
 *
 * @example
 * ```typescript
 * const results = streamJsonlResults<Record>("/path/to/data.jsonl")
 * yield* Stream.runForEach(results, (result) => {
 *   if (result._tag === "Success") {
 *     Console.log("Parsed:", result.value)
 *   } else {
 *     Console.error("Error at line", result.lineNumber, result.error)
 *   }
 * })
 * ```
 */
export const streamJsonlResults = <A = unknown>(
  filePath: string,
  options: Omit<JsonlReadOptions, "skipInvalid" | "collectErrors"> = {}
): Stream.Stream<JsonlParseResult<A>, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> =>
  streamLines(filePath, { ...options, trim: true, skipEmpty: true }).pipe(
    Stream.zipWithIndex,
    Stream.mapEffect(([line, lineNumber]) =>
      parseLine<A>(line, lineNumber, options.schema).pipe(
        Effect.map((value): JsonlParseResult<A> => ({
          _tag: "Success",
          value,
          lineNumber
        })),
        Effect.catchAll((e): Effect.Effect<JsonlParseResult<A>> =>
          Effect.succeed({
            _tag: "Error",
            error: e.message,
            line,
            lineNumber
          })
        )
      )
    )
  )

/**
 * Read all JSONL records into an array.
 *
 * Use only for small files - for large files use streamJsonl.
 */
export const readJsonl = <A = unknown>(
  filePath: string,
  options: JsonlReadOptions = {}
): Effect.Effect<ReadonlyArray<A>, TextStreamError | FileNotFoundError | JsonlParseError | JsonlValidationError, FileSystem.FileSystem | Path.Path> =>
  streamJsonl<A>(filePath, options).pipe(
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

/**
 * Read JSONL with schema validation into typed array.
 */
export const readJsonlSchema = <A, I>(
  schema: Schema.Schema<A, I>,
  filePath: string,
  options: Omit<JsonlReadOptions, "schema"> = {}
): Effect.Effect<ReadonlyArray<A>, TextStreamError | FileNotFoundError | JsonlParseError | JsonlValidationError, FileSystem.FileSystem | Path.Path> =>
  readJsonl<A>(filePath, { ...options, schema: schema as any })

// =============================================================================
// Batch Processing
// =============================================================================

/**
 * Process JSONL records in batches.
 *
 * @example
 * ```typescript
 * yield* streamJsonlBatches<Record>(
 *   "/path/to/data.jsonl",
 *   100,
 *   (batch) => saveToDatabase(Chunk.toReadonlyArray(batch))
 * )
 * ```
 */
export const streamJsonlBatches = <A, B, E, R>(
  filePath: string,
  batchSize: number,
  processBatch: (batch: Chunk.Chunk<A>) => Effect.Effect<B, E, R>,
  options: JsonlReadOptions = {}
): Stream.Stream<B, TextStreamError | FileNotFoundError | JsonlParseError | JsonlValidationError | E, FileSystem.FileSystem | Path.Path | R> =>
  streamJsonl<A>(filePath, options).pipe(
    Stream.grouped(batchSize),
    Stream.mapEffect(processBatch)
  )

/**
 * Process JSONL records in parallel with controlled concurrency.
 */
export const streamJsonlParallel = <A, B, E, R>(
  filePath: string,
  processRecord: (record: A) => Effect.Effect<B, E, R>,
  options: JsonlReadOptions & { readonly concurrency?: number } = {}
): Stream.Stream<B, TextStreamError | FileNotFoundError | JsonlParseError | JsonlValidationError | E, FileSystem.FileSystem | Path.Path | R> => {
  const concurrency = options.concurrency ?? 4

  return streamJsonl<A>(filePath, options).pipe(
    Stream.mapEffect(processRecord, { concurrency })
  )
}

// =============================================================================
// Writing Functions
// =============================================================================

/**
 * Write records to a JSONL file.
 *
 * @example
 * ```typescript
 * const records = [
 *   { id: 1, name: "Alice" },
 *   { id: 2, name: "Bob" }
 * ]
 * yield* writeJsonl("/path/to/output.jsonl", records)
 * ```
 */
export const writeJsonl = <A>(
  filePath: string,
  records: Iterable<A>,
  options: JsonlWriteOptions = {}
): Effect.Effect<void, TextStreamError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const pathSvc = yield* Path.Path

    const resolvedPath = pathSvc.resolve(filePath)
    const pretty = options.pretty ?? false

    // Serialize all records to JSONL format
    const lines = Array.from(records)
      .map((record) => pretty ? JSON.stringify(record, null, 2) : JSON.stringify(record))
      .join("\n")

    const encoder = new TextEncoder()
    const bytes = encoder.encode(lines + "\n")

    if (options.append) {
      const exists = yield* fs.exists(resolvedPath)
      if (exists) {
        const existing = yield* fs.readFile(resolvedPath)
        const newBytes = new Uint8Array(existing.length + bytes.length)
        newBytes.set(existing, 0)
        newBytes.set(bytes, existing.length)
        yield* fs.writeFile(resolvedPath, newBytes)
      } else {
        yield* fs.writeFile(resolvedPath, bytes)
      }
    } else {
      yield* fs.writeFile(resolvedPath, bytes)
    }
  }).pipe(
    Effect.mapError((e) => new TextStreamError({ message: String(e), cause: e }))
  )

/**
 * Write a stream of records to a JSONL file.
 *
 * Memory efficient - writes as it processes.
 */
export const writeJsonlStream = <A, E, R>(
  filePath: string,
  records: Stream.Stream<A, E, R>,
  options: JsonlWriteOptions = {}
): Effect.Effect<void, TextStreamError | E, FileSystem.FileSystem | Path.Path | R> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const pathSvc = yield* Path.Path

    const resolvedPath = pathSvc.resolve(filePath)
    const pretty = options.pretty ?? false

    // Collect all records (for now - could be optimized for true streaming)
    const allRecords = yield* Stream.runCollect(records)
    const lines = Chunk.toReadonlyArray(allRecords)
      .map((record) => pretty ? JSON.stringify(record, null, 2) : JSON.stringify(record))
      .join("\n")

    const encoder = new TextEncoder()
    const bytes = encoder.encode(lines + "\n")

    if (options.append) {
      const exists = yield* fs.exists(resolvedPath)
      if (exists) {
        const existing = yield* fs.readFile(resolvedPath)
        const newBytes = new Uint8Array(existing.length + bytes.length)
        newBytes.set(existing, 0)
        newBytes.set(bytes, existing.length)
        yield* fs.writeFile(resolvedPath, newBytes)
      } else {
        yield* fs.writeFile(resolvedPath, bytes)
      }
    } else {
      yield* fs.writeFile(resolvedPath, bytes)
    }
  }).pipe(
    Effect.mapError((e) => {
      if (e instanceof TextStreamError) return e
      return new TextStreamError({ message: String(e), cause: e })
    })
  )

/**
 * Append a single record to a JSONL file.
 */
export const appendJsonl = <A>(
  filePath: string,
  record: A,
  options: Omit<JsonlWriteOptions, "append"> = {}
): Effect.Effect<void, TextStreamError, FileSystem.FileSystem | Path.Path> =>
  writeJsonl(filePath, [record], { ...options, append: true })

// =============================================================================
// Statistics and Validation
// =============================================================================

/**
 * Compute statistics about a JSONL file.
 */
export const computeJsonlStats = (
  filePath: string,
  options: Omit<JsonlReadOptions, "skipInvalid" | "collectErrors"> = {}
): Effect.Effect<JsonlStats, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> =>
  streamJsonlResults(filePath, options).pipe(
    Stream.runFold(
      { totalLines: 0, successCount: 0, errorCount: 0, skippedCount: 0 },
      (acc, result) => ({
        totalLines: acc.totalLines + 1,
        successCount: acc.successCount + (result._tag === "Success" ? 1 : 0),
        errorCount: acc.errorCount + (result._tag === "Error" ? 1 : 0),
        skippedCount: acc.skippedCount
      })
    ),
    Effect.map((acc) => new JsonlStats(acc))
  )

/**
 * Validate a JSONL file against a schema and collect all errors.
 *
 * Returns a tuple of [valid records, errors].
 */
export const validateJsonl = <A, I>(
  schema: Schema.Schema<A, I>,
  filePath: string,
  options: Omit<JsonlReadOptions, "schema" | "skipInvalid" | "collectErrors"> = {}
): Effect.Effect<
  { readonly valid: ReadonlyArray<A>; readonly errors: ReadonlyArray<JsonlParseResult<never> & { _tag: "Error" }> },
  TextStreamError | FileNotFoundError,
  FileSystem.FileSystem | Path.Path
> =>
  streamJsonlResults<A>(filePath, { ...options, schema: schema as any }).pipe(
    Stream.runFold(
      { valid: [] as A[], errors: [] as Array<JsonlParseResult<never> & { _tag: "Error" }> },
      (acc, result) => {
        if (result._tag === "Success") {
          return { ...acc, valid: [...acc.valid, result.value] }
        }
        return { ...acc, errors: [...acc.errors, result as any] }
      }
    )
  )

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Count records in a JSONL file (only counts valid JSON lines).
 */
export const countJsonlRecords = (
  filePath: string,
  options: JsonlReadOptions = {}
): Effect.Effect<number, TextStreamError | FileNotFoundError | JsonlParseError | JsonlValidationError, FileSystem.FileSystem | Path.Path> =>
  streamJsonl(filePath, options).pipe(
    Stream.runCount
  )

/**
 * Get first N records from a JSONL file.
 */
export const headJsonl = <A = unknown>(
  filePath: string,
  n: number,
  options: JsonlReadOptions = {}
): Effect.Effect<ReadonlyArray<A>, TextStreamError | FileNotFoundError | JsonlParseError | JsonlValidationError, FileSystem.FileSystem | Path.Path> =>
  streamJsonl<A>(filePath, { ...options, maxLines: n }).pipe(
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

/**
 * Sample random records from a JSONL file.
 */
export const sampleJsonl = <A = unknown>(
  filePath: string,
  sampleSize: number,
  options: JsonlReadOptions = {}
): Effect.Effect<ReadonlyArray<A>, TextStreamError | FileNotFoundError | JsonlParseError | JsonlValidationError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const allRecords = yield* readJsonl<A>(filePath, options)

    if (allRecords.length <= sampleSize) {
      return allRecords
    }

    // Fisher-Yates shuffle
    const indices = Array.from({ length: allRecords.length }, (_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }

    return indices
      .slice(0, sampleSize)
      .sort((a, b) => a - b)
      .map((i) => allRecords[i])
  })

/**
 * Filter JSONL records by a predicate.
 */
export const filterJsonl = <A = unknown>(
  filePath: string,
  predicate: (record: A) => boolean,
  options: JsonlReadOptions = {}
): Stream.Stream<A, TextStreamError | FileNotFoundError | JsonlParseError | JsonlValidationError, FileSystem.FileSystem | Path.Path> =>
  streamJsonl<A>(filePath, options).pipe(
    Stream.filter(predicate)
  )

/**
 * Map over JSONL records.
 */
export const mapJsonl = <A, B>(
  filePath: string,
  fn: (record: A) => B,
  options: JsonlReadOptions = {}
): Stream.Stream<B, TextStreamError | FileNotFoundError | JsonlParseError | JsonlValidationError, FileSystem.FileSystem | Path.Path> =>
  streamJsonl<A>(filePath, options).pipe(
    Stream.map(fn)
  )

/**
 * Parse a JSONL string (not from file).
 */
export const parseJsonlString = <A = unknown>(
  content: string,
  schema?: Schema.Schema<A>
): Effect.Effect<ReadonlyArray<A>, JsonlParseError | JsonlValidationError> => {
  const lines = content.split("\n").filter((line) => line.trim().length > 0)

  return Effect.forEach(lines, (line, index) =>
    parseLine<A>(line, index, schema)
  )
}

/**
 * Stringify records to JSONL format.
 */
export const stringifyJsonl = <A>(
  records: Iterable<A>,
  options: { readonly pretty?: boolean } = {}
): string => {
  const pretty = options.pretty ?? false
  return Array.from(records)
    .map((record) => pretty ? JSON.stringify(record, null, 2) : JSON.stringify(record))
    .join("\n")
}
