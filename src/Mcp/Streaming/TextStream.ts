/**
 * TextStream - Effect-based text streaming utilities
 *
 * Provides memory-efficient streaming for large text files and datasets.
 * Uses @effect/platform for cross-platform file system operations.
 *
 * @module Mcp/Streaming/TextStream
 */

import { FileSystem, Path, Error as PlatformError } from "@effect/platform"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

// =============================================================================
// Types and Schemas
// =============================================================================

/**
 * Encoding options for text decoding
 */
export type TextEncoding = "utf-8" | "utf-16le" | "ascii" | "latin1"

/**
 * Options for reading text files
 */
export interface TextReadOptions {
  /** Text encoding (default: utf-8) */
  readonly encoding?: TextEncoding | undefined
  /** Skip empty lines (default: false) */
  readonly skipEmpty?: boolean | undefined
  /** Trim whitespace from lines (default: false) */
  readonly trim?: boolean | undefined
  /** Maximum line length before truncation (default: none) */
  readonly maxLineLength?: number | undefined
}

/**
 * Options for streaming text files
 */
export interface TextStreamOptions extends TextReadOptions {
  /** Chunk size for reading (default: 64KB) */
  readonly chunkSize?: number | undefined
  /** Start from line number (0-indexed, default: 0) */
  readonly startLine?: number | undefined
  /** Maximum number of lines to read (default: all) */
  readonly maxLines?: number | undefined
}

/**
 * A line with its metadata
 */
export class TextLine extends Schema.Class<TextLine>("TextLine")({
  /** The line content */
  content: Schema.String,
  /** Line number (0-indexed) */
  lineNumber: Schema.Number,
  /** Byte offset in the file */
  byteOffset: Schema.Number,
  /** Original length before any trimming */
  originalLength: Schema.Number
}) {}

/**
 * Statistics about a text stream
 */
export class TextStreamStats extends Schema.Class<TextStreamStats>("TextStreamStats")({
  /** Total number of lines */
  totalLines: Schema.Number,
  /** Total bytes read */
  totalBytes: Schema.Number,
  /** Number of non-empty lines */
  nonEmptyLines: Schema.Number,
  /** Average line length */
  avgLineLength: Schema.Number,
  /** Maximum line length */
  maxLineLength: Schema.Number,
  /** Minimum line length */
  minLineLength: Schema.Number
}) {}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Text streaming errors
 */
export class TextStreamError extends Schema.TaggedError<TextStreamError>()("TextStreamError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

export class FileNotFoundError extends Schema.TaggedError<FileNotFoundError>()("FileNotFoundError", {
  path: Schema.String
}) {}

export class EncodingError extends Schema.TaggedError<EncodingError>()("EncodingError", {
  message: Schema.String,
  encoding: Schema.String
}) {}

// =============================================================================
// Core Streaming Functions
// =============================================================================

/**
 * Read a text file as a stream of lines.
 *
 * Memory efficient - processes line by line without loading entire file.
 *
 * @example
 * ```typescript
 * const lines = streamLines("/path/to/file.txt", { trim: true, skipEmpty: true })
 * yield* Stream.runForEach(lines, (line) => Console.log(line))
 * ```
 */
export const streamLines = (
  filePath: string,
  options: TextStreamOptions = {}
): Stream.Stream<string, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> => {
  const encoding = options.encoding ?? "utf-8"
  const skipEmpty = options.skipEmpty ?? false
  const trim = options.trim ?? false
  const maxLineLength = options.maxLineLength
  const startLine = options.startLine ?? 0
  const maxLines = options.maxLines

  const mapPlatformError = <A>(effect: Effect.Effect<A, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path>) =>
    effect.pipe(Effect.mapError((e): TextStreamError => new TextStreamError({ message: String(e), cause: e })))

  return Stream.unwrap(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      // Resolve and check file exists
      const resolvedPath = path.resolve(filePath)
      const exists = yield* mapPlatformError(fs.exists(resolvedPath))

      if (!exists) {
        return Stream.fail(new FileNotFoundError({ path: filePath })) as Stream.Stream<string, TextStreamError | FileNotFoundError, never>
      }

      // Create the streaming pipeline
      const baseStream = fs.stream(resolvedPath).pipe(
        // Decode bytes to text
        Stream.decodeText(encoding),
        // Split into lines
        Stream.splitLines
      )

      return baseStream.pipe(
        // Apply line number and filtering
        Stream.zipWithIndex,
        Stream.filter(([_, index]) => index >= startLine),
        Stream.take(maxLines ?? Number.MAX_SAFE_INTEGER),
        Stream.map(([line, _]): string => {
          let processed = trim ? line.trim() : line
          if (maxLineLength && processed.length > maxLineLength) {
            processed = processed.slice(0, maxLineLength)
          }
          return processed
        }),
        Stream.filter((line) => !skipEmpty || line.length > 0),
        Stream.catchAll((e) => Stream.fail(new TextStreamError({ message: String(e), cause: e })))
      ) as Stream.Stream<string, TextStreamError | FileNotFoundError, never>
    })
  )
}

/**
 * Read a text file as a stream of TextLine objects with metadata.
 *
 * Includes line numbers and byte offsets for each line.
 */
export const streamLinesWithMetadata = (
  filePath: string,
  options: TextStreamOptions = {}
): Stream.Stream<TextLine, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> => {
  const encoding = options.encoding ?? "utf-8"
  const skipEmpty = options.skipEmpty ?? false
  const trim = options.trim ?? false
  const maxLineLength = options.maxLineLength
  const startLine = options.startLine ?? 0
  const maxLines = options.maxLines

  const mapPlatformError = <A>(effect: Effect.Effect<A, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path>) =>
    effect.pipe(Effect.mapError((e): TextStreamError => new TextStreamError({ message: String(e), cause: e })))

  return Stream.unwrap(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const resolvedPath = path.resolve(filePath)
      const exists = yield* mapPlatformError(fs.exists(resolvedPath))

      if (!exists) {
        return Stream.fail(new FileNotFoundError({ path: filePath })) as Stream.Stream<TextLine, TextStreamError | FileNotFoundError, never>
      }

      let byteOffset = 0

      const baseStream = fs.stream(resolvedPath).pipe(
        Stream.decodeText(encoding),
        Stream.splitLines
      )

      const resultStream = baseStream.pipe(
        Stream.zipWithIndex,
        Stream.filter(([_, index]) => index >= startLine),
        Stream.take(maxLines ?? Number.MAX_SAFE_INTEGER),
        Stream.map(([line, lineNumber]): TextLine => {
          const originalLength = line.length
          const content = trim ? line.trim() : line
          const truncated = maxLineLength && content.length > maxLineLength
            ? content.slice(0, maxLineLength)
            : content

          const textLine = new TextLine({
            content: truncated,
            lineNumber,
            byteOffset,
            originalLength
          })

          // Update byte offset (line + newline character)
          byteOffset += Buffer.byteLength(line, encoding as BufferEncoding) + 1

          return textLine
        }),
        Stream.filter((textLine) => !skipEmpty || textLine.content.length > 0),
        Stream.catchAll((e) => Stream.fail(new TextStreamError({ message: String(e), cause: e })))
      )

      return resultStream as Stream.Stream<TextLine, TextStreamError | FileNotFoundError, never>
    })
  )
}

/**
 * Read entire file as a single string.
 *
 * Use only for small files - for large files use streamLines.
 */
export const readTextFile = (
  filePath: string,
  encoding: TextEncoding = "utf-8"
): Effect.Effect<string, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const resolvedPath = path.resolve(filePath)
    const exists = yield* fs.exists(resolvedPath)

    if (!exists) {
      return yield* Effect.fail(new FileNotFoundError({ path: filePath }))
    }

    const bytes = yield* fs.readFile(resolvedPath)
    const decoder = new TextDecoder(encoding)
    return decoder.decode(bytes)
  }).pipe(
    Effect.mapError((e) =>
      e instanceof FileNotFoundError
        ? e
        : new TextStreamError({ message: String(e), cause: e })
    )
  )

/**
 * Read file as array of lines.
 *
 * Loads all lines into memory - use streamLines for large files.
 */
export const readLines = (
  filePath: string,
  options: TextReadOptions = {}
): Effect.Effect<ReadonlyArray<string>, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> =>
  Stream.runCollect(streamLines(filePath, options)).pipe(
    Effect.map(Chunk.toReadonlyArray)
  )

/**
 * Count lines in a file without loading it into memory.
 */
export const countLines = (
  filePath: string
): Effect.Effect<number, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> =>
  streamLines(filePath).pipe(
    Stream.runCount
  )

/**
 * Compute statistics about a text file.
 */
export const computeStats = (
  filePath: string,
  options: TextReadOptions = {}
): Effect.Effect<TextStreamStats, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> =>
  streamLinesWithMetadata(filePath, options).pipe(
    Stream.runFold(
      {
        totalLines: 0,
        totalBytes: 0,
        nonEmptyLines: 0,
        totalLength: 0,
        maxLineLength: 0,
        minLineLength: Number.MAX_SAFE_INTEGER
      },
      (acc, line) => ({
        totalLines: acc.totalLines + 1,
        totalBytes: acc.totalBytes + line.originalLength + 1,
        nonEmptyLines: acc.nonEmptyLines + (line.content.length > 0 ? 1 : 0),
        totalLength: acc.totalLength + line.content.length,
        maxLineLength: Math.max(acc.maxLineLength, line.content.length),
        minLineLength: Math.min(acc.minLineLength, line.content.length)
      })
    ),
    Effect.map((acc) =>
      new TextStreamStats({
        totalLines: acc.totalLines,
        totalBytes: acc.totalBytes,
        nonEmptyLines: acc.nonEmptyLines,
        avgLineLength: acc.totalLines > 0 ? acc.totalLength / acc.totalLines : 0,
        maxLineLength: acc.maxLineLength,
        minLineLength: acc.totalLines > 0 ? acc.minLineLength : 0
      })
    )
  )

// =============================================================================
// Batch Processing
// =============================================================================

/**
 * Process lines in batches for bulk operations.
 *
 * Useful for database inserts, API calls, or other batch-oriented tasks.
 *
 * @example
 * ```typescript
 * yield* streamBatches("/path/to/file.txt", 100, (batch) =>
 *   Effect.forEach(batch, processLine, { concurrency: 10 })
 * )
 * ```
 */
export const streamBatches = <A, E, R>(
  filePath: string,
  batchSize: number,
  processBatch: (batch: Chunk.Chunk<string>) => Effect.Effect<A, E, R>,
  options: TextStreamOptions = {}
): Stream.Stream<A, TextStreamError | FileNotFoundError | E, FileSystem.FileSystem | Path.Path | R> =>
  streamLines(filePath, options).pipe(
    Stream.grouped(batchSize),
    Stream.mapEffect(processBatch)
  )

/**
 * Process lines in parallel with controlled concurrency.
 *
 * @example
 * ```typescript
 * yield* streamParallel("/path/to/file.txt", processLine, { concurrency: 10 })
 * ```
 */
export const streamParallel = <A, E, R>(
  filePath: string,
  processLine: (line: string) => Effect.Effect<A, E, R>,
  options: TextStreamOptions & { readonly concurrency?: number } = {}
): Stream.Stream<A, TextStreamError | FileNotFoundError | E, FileSystem.FileSystem | Path.Path | R> => {
  const concurrency = options.concurrency ?? 4

  return streamLines(filePath, options).pipe(
    Stream.mapEffect(processLine, { concurrency })
  )
}

// =============================================================================
// Text Transformation Streams
// =============================================================================

/**
 * Create a stream that chunks text by paragraph boundaries.
 */
export const streamParagraphs = (
  filePath: string,
  options: TextReadOptions = {}
): Stream.Stream<string, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> => {
  const trim = options.trim ?? true

  return Stream.unwrap(
    Effect.gen(function* () {
      const content = yield* readTextFile(filePath, options.encoding)

      // Split by double newlines (paragraph boundaries)
      const paragraphs = content
        .split(/\n\s*\n/)
        .map((p) => trim ? p.trim() : p)
        .filter((p) => p.length > 0)

      return Stream.fromIterable(paragraphs)
    })
  )
}

/**
 * Create a stream of text chunks with specified size.
 *
 * Useful for processing large texts in fixed-size windows.
 */
export const streamChunks = (
  filePath: string,
  chunkSize: number,
  options: TextReadOptions & { readonly overlap?: number } = {}
): Stream.Stream<string, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> => {
  const overlap = options.overlap ?? 0

  return Stream.unwrap(
    Effect.gen(function* () {
      const content = yield* readTextFile(filePath, options.encoding)
      const chunks: string[] = []
      const step = chunkSize - overlap

      for (let i = 0; i < content.length; i += step) {
        chunks.push(content.slice(i, i + chunkSize))
      }

      return Stream.fromIterable(chunks)
    })
  )
}

/**
 * Stream sentences from a text file using basic sentence boundary detection.
 */
export const streamSentences = (
  filePath: string,
  options: TextReadOptions = {}
): Stream.Stream<string, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> =>
  Stream.unwrap(
    Effect.gen(function* () {
      const content = yield* readTextFile(filePath, options.encoding)

      // Basic sentence boundary detection
      // Split on . ! ? followed by space or end of string
      const sentences = content
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

      return Stream.fromIterable(sentences)
    })
  )

// =============================================================================
// Text Writing Utilities
// =============================================================================

/**
 * Write a stream of lines to a file.
 */
export const writeLines = (
  filePath: string,
  lines: Stream.Stream<string, never, never>,
  options: { readonly append?: boolean; readonly encoding?: TextEncoding } = {}
): Effect.Effect<void, TextStreamError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const pathSvc = yield* Path.Path

    const resolvedPath = pathSvc.resolve(filePath)
    // Note: TextEncoder always uses UTF-8, encoding option is reserved for future use
    const _encoding = options.encoding ?? "utf-8"
    void _encoding

    // Collect lines and join with newlines
    const allLines = yield* Stream.runCollect(lines)
    const content = Chunk.join(allLines, "\n")

    const encoder = new TextEncoder()
    const bytes = encoder.encode(content)

    if (options.append) {
      // Check if file exists for appending
      const exists = yield* fs.exists(resolvedPath)
      if (exists) {
        const existing = yield* fs.readFile(resolvedPath)
        const newBytes = new Uint8Array(existing.length + 1 + bytes.length)
        newBytes.set(existing, 0)
        newBytes.set([10], existing.length) // newline
        newBytes.set(bytes, existing.length + 1)
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
 * Write text content to a file.
 */
export const writeTextFile = (
  filePath: string,
  content: string,
  options: { readonly append?: boolean; readonly encoding?: TextEncoding } = {}
): Effect.Effect<void, TextStreamError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const pathSvc = yield* Path.Path

    const resolvedPath = pathSvc.resolve(filePath)
    const encoder = new TextEncoder()
    const bytes = encoder.encode(content)

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

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a file exists.
 */
export const fileExists = (
  filePath: string
): Effect.Effect<boolean, TextStreamError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    return yield* fs.exists(path.resolve(filePath))
  }).pipe(
    Effect.mapError((e) => new TextStreamError({ message: String(e), cause: e }))
  )

/**
 * Get file size in bytes.
 */
export const getFileSize = (
  filePath: string
): Effect.Effect<bigint, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    const resolvedPath = path.resolve(filePath)
    const exists = yield* fs.exists(resolvedPath)

    if (!exists) {
      return yield* Effect.fail(new FileNotFoundError({ path: filePath }))
    }

    const stat = yield* fs.stat(resolvedPath)
    return stat.size
  }).pipe(
    Effect.mapError((e) =>
      e instanceof FileNotFoundError
        ? e
        : new TextStreamError({ message: String(e), cause: e })
    )
  )

/**
 * Sample random lines from a file.
 *
 * Useful for creating test/validation datasets.
 */
export const sampleLines = (
  filePath: string,
  sampleSize: number,
  options: TextReadOptions = {}
): Effect.Effect<ReadonlyArray<string>, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    // Read all lines
    const allLines = yield* readLines(filePath, options)

    if (allLines.length <= sampleSize) {
      return allLines
    }

    // Fisher-Yates shuffle to select random sample
    const indices = Array.from({ length: allLines.length }, (_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }

    return indices
      .slice(0, sampleSize)
      .sort((a, b) => a - b)
      .map((i) => allLines[i])
  })

/**
 * Head: Get first N lines from a file.
 */
export const head = (
  filePath: string,
  n: number,
  options: TextReadOptions = {}
): Effect.Effect<ReadonlyArray<string>, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> =>
  streamLines(filePath, { ...options, maxLines: n }).pipe(
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  )

/**
 * Tail: Get last N lines from a file.
 */
export const tail = (
  filePath: string,
  n: number,
  options: TextReadOptions = {}
): Effect.Effect<ReadonlyArray<string>, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> =>
  streamLines(filePath, options).pipe(
    Stream.runCollect,
    Effect.map((chunk) => {
      const arr = Chunk.toReadonlyArray(chunk)
      return arr.slice(Math.max(0, arr.length - n))
    })
  )
