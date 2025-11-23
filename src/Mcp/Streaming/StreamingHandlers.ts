/**
 * Streaming Tool Handlers
 *
 * Implementation of streaming tool handlers for MCP.
 * Uses the streaming utilities from TextStream, Jsonl, DatasetLoader, and Pipeline.
 */

import { FileSystem, Path } from "@effect/platform"
import { NodeFileSystem, NodePath } from "@effect/platform-node"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"

import * as TextStream from "./TextStream.js"
import * as Jsonl from "./Jsonl.js"
import * as DatasetLoader from "./DatasetLoader.js"
import * as Pipeline from "./Pipeline.js"
import * as Tools from "./StreamingTools.js"

// Layer that provides FileSystem and Path for platform operations
const PlatformLayer = Layer.merge(NodeFileSystem.layer, NodePath.layer)

// =============================================================================
// Helper Functions
// =============================================================================

const filterUndefined = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result as T
}

/**
 * Helper to provide platform dependencies to effects that need FileSystem/Path
 */
const withPlatform = <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>): Effect.Effect<A, E, never> =>
  effect.pipe(Effect.provide(PlatformLayer))

// =============================================================================
// Streaming Handlers Layer
// =============================================================================

/**
 * Create streaming handlers - returns the handlers object.
 *
 * NOTE: These handlers need to be provided with FileSystem and Path layers.
 * The handlers catch all errors and return them in a normalized format.
 */
export const makeStreamingHandlers = Effect.gen(function* () {
  return {
    // ==========================
    // File Operations
    // ==========================

    stream_read_lines: ({ path, options }: { readonly path: string; readonly options?: { readonly maxLines?: number | undefined; readonly skip?: number | undefined; readonly tail?: number | undefined; readonly trim?: boolean | undefined; readonly skipEmpty?: boolean | undefined; readonly encoding?: "utf-8" | "ascii" | "latin1" | undefined } | undefined }) =>
      Effect.gen(function* () {
        const opts = options ?? {}
        const maxLines = opts.maxLines ?? 1000
        const skip = opts.skip ?? 0
        const tailN = opts.tail

        const readOptions = filterUndefined({
          trim: opts.trim,
          skipEmpty: opts.skipEmpty,
          encoding: opts.encoding ?? "utf-8"
        })

        let lines: ReadonlyArray<string>

        if (tailN) {
          lines = yield* TextStream.tail(path, tailN, readOptions)
        } else {
          lines = yield* TextStream.streamLines(path, {
            ...readOptions,
            startLine: skip,
            maxLines
          }).pipe(
            Stream.runCollect,
            Effect.map(Chunk.toReadonlyArray)
          )
        }

        return new Tools.LinesOutput({
          lines: lines as string[],
          count: lines.length,
          truncated: lines.length >= maxLines
        })
      }).pipe(withPlatform, Effect.catchAll((e) => Effect.succeed(new Tools.LinesOutput({
        lines: [],
        count: 0,
        truncated: false
      })))),

    stream_file_info: ({ path }: { readonly path: string }) =>
      Effect.gen(function* () {
        const exists = yield* TextStream.fileExists(path)

        if (!exists) {
          return new Tools.FileInfoOutput({ exists: false })
        }

        const sizeBytes = yield* TextStream.getFileSize(path)
        const lineCount = yield* TextStream.countLines(path)

        return new Tools.FileInfoOutput({
          exists: true,
          sizeBytes: Number(sizeBytes),
          lineCount
        })
      }).pipe(withPlatform, Effect.catchAll(() => Effect.succeed(new Tools.FileInfoOutput({ exists: false })))),

    stream_text_stats: ({ path, options }: { readonly path: string; readonly options?: { readonly trim?: boolean | undefined; readonly skipEmpty?: boolean | undefined } | undefined }) =>
      Effect.gen(function* () {
        const opts = options ?? {}
        const stats = yield* TextStream.computeStats(path, filterUndefined({
          trim: opts.trim,
          skipEmpty: opts.skipEmpty
        }))

        return new Tools.TextStatsOutput({
          totalLines: stats.totalLines,
          totalBytes: stats.totalBytes,
          nonEmptyLines: stats.nonEmptyLines,
          avgLineLength: stats.avgLineLength,
          maxLineLength: stats.maxLineLength,
          minLineLength: stats.minLineLength
        })
      }).pipe(withPlatform, Effect.catchAll(() => Effect.succeed(new Tools.TextStatsOutput({
        totalLines: 0,
        totalBytes: 0,
        nonEmptyLines: 0,
        avgLineLength: 0,
        maxLineLength: 0,
        minLineLength: 0
      })))),

    stream_sample_lines: ({ path, sampleSize, options }: { readonly path: string; readonly sampleSize: number; readonly options?: { readonly trim?: boolean | undefined; readonly skipEmpty?: boolean | undefined } | undefined }) =>
      Effect.gen(function* () {
        const opts = options ?? {}
        const lines = yield* TextStream.sampleLines(path, sampleSize, filterUndefined({
          trim: opts.trim,
          skipEmpty: opts.skipEmpty
        }))

        return new Tools.LinesOutput({
          lines: lines as string[],
          count: lines.length,
          truncated: false
        })
      }).pipe(withPlatform, Effect.catchAll(() => Effect.succeed(new Tools.LinesOutput({
        lines: [],
        count: 0,
        truncated: false
      })))),

    // ==========================
    // JSONL Operations
    // ==========================

    stream_read_jsonl: ({ path, options }: { readonly path: string; readonly options?: { readonly maxRecords?: number | undefined; readonly skipInvalid?: boolean | undefined; readonly collectErrors?: boolean | undefined } | undefined }) =>
      Effect.gen(function* () {
        const opts = options ?? {}
        const maxRecords = opts.maxRecords ?? 1000
        const skipInvalid = opts.skipInvalid ?? false
        const collectErrors = opts.collectErrors ?? false

        if (collectErrors) {
          const results = yield* Jsonl.streamJsonlResults(path).pipe(
            Stream.take(maxRecords),
            Stream.runCollect,
            Effect.map(Chunk.toReadonlyArray)
          )

          const records = results
            .filter((r) => r._tag === "Success")
            .map((r) => (r as any).value)

          const errors = results
            .filter((r) => r._tag === "Error")
            .map((r) => ({
              lineNumber: (r as any).lineNumber as number,
              error: (r as any).error as string
            }))

          return new Tools.JsonlOutput({
            records,
            count: records.length,
            truncated: results.length >= maxRecords,
            errors: errors.length > 0 ? errors : undefined
          })
        }

        const records = yield* Jsonl.streamJsonl(path, { skipInvalid }).pipe(
          Stream.take(maxRecords),
          Stream.runCollect,
          Effect.map(Chunk.toReadonlyArray)
        )

        return new Tools.JsonlOutput({
          records: records as unknown[],
          count: records.length,
          truncated: records.length >= maxRecords
        })
      }).pipe(withPlatform, Effect.catchAll(() => Effect.succeed(new Tools.JsonlOutput({
        records: [],
        count: 0,
        truncated: false
      })))),

    stream_jsonl_stats: ({ path }: { readonly path: string }) =>
      Effect.gen(function* () {
        const stats = yield* Jsonl.computeJsonlStats(path)

        return new Tools.JsonlStatsOutput({
          totalLines: stats.totalLines,
          successCount: stats.successCount,
          errorCount: stats.errorCount,
          skippedCount: stats.skippedCount
        })
      }).pipe(withPlatform, Effect.catchAll(() => Effect.succeed(new Tools.JsonlStatsOutput({
        totalLines: 0,
        successCount: 0,
        errorCount: 0,
        skippedCount: 0
      })))),

    stream_validate_jsonl: ({ path, options }: { readonly path: string; readonly options?: { readonly maxErrors?: number | undefined } | undefined }) =>
      Effect.gen(function* () {
        const opts = options ?? {}
        const maxErrors = opts.maxErrors ?? 100

        const results = yield* Jsonl.streamJsonlResults(path).pipe(
          Stream.runCollect,
          Effect.map(Chunk.toReadonlyArray)
        )

        const records = results
          .filter((r) => r._tag === "Success")
          .map((r) => (r as any).value)

        const errors = results
          .filter((r) => r._tag === "Error")
          .slice(0, maxErrors)
          .map((r) => ({
            lineNumber: (r as any).lineNumber as number,
            error: (r as any).error as string
          }))

        return new Tools.JsonlOutput({
          records,
          count: records.length,
          truncated: false,
          errors: errors.length > 0 ? errors : undefined
        })
      }).pipe(withPlatform, Effect.catchAll(() => Effect.succeed(new Tools.JsonlOutput({
        records: [],
        count: 0,
        truncated: false
      })))),

    stream_sample_jsonl: ({ path, sampleSize, options }: { readonly path: string; readonly sampleSize: number; readonly options?: { readonly skipInvalid?: boolean | undefined } | undefined }) =>
      Effect.gen(function* () {
        const opts = options ?? {}
        const records = yield* Jsonl.sampleJsonl(path, sampleSize, {
          skipInvalid: opts.skipInvalid ?? false
        })

        return new Tools.JsonlOutput({
          records: records as unknown[],
          count: records.length,
          truncated: false
        })
      }).pipe(withPlatform, Effect.catchAll(() => Effect.succeed(new Tools.JsonlOutput({
        records: [],
        count: 0,
        truncated: false
      })))),

    // ==========================
    // Dataset Loading
    // ==========================

    stream_load_text: ({ location, options }: { readonly location: string; readonly options?: { readonly timeout?: number | undefined; readonly encoding?: "utf-8" | "ascii" | "latin1" | undefined } | undefined }) =>
      Effect.gen(function* () {
        const opts = options ?? {}
        const sourceType = location.startsWith("http") ? "url" as const : "file" as const

        const result = yield* DatasetLoader.loadText(
          { type: sourceType, location },
          filterUndefined({ timeout: opts.timeout, encoding: opts.encoding ?? "utf-8" })
        )

        return new Tools.DataOutput({
          data: result.data,
          meta: new Tools.DatasetMetaOutput({
            sourceType: result.meta.sourceType,
            location: result.meta.location,
            format: result.meta.format,
            sizeBytes: result.meta.sizeBytes,
            loadedAt: result.meta.loadedAt
          })
        })
      }).pipe(withPlatform, Effect.catchAll((e) => Effect.succeed(new Tools.DataOutput({
        data: "",
        meta: new Tools.DatasetMetaOutput({
          sourceType: "file",
          location,
          format: "text",
          loadedAt: Date.now()
        })
      })))),

    stream_load_lines: ({ location, options }: { readonly location: string; readonly options?: { readonly timeout?: number | undefined; readonly maxLines?: number | undefined; readonly trim?: boolean | undefined; readonly skipEmpty?: boolean | undefined } | undefined }) =>
      Effect.gen(function* () {
        const opts = options ?? {}
        const sourceType = location.startsWith("http") ? "url" as const : "file" as const

        const result = yield* DatasetLoader.loadLines(
          { type: sourceType, location },
          filterUndefined({ timeout: opts.timeout, trim: opts.trim, skipEmpty: opts.skipEmpty })
        )

        const lines = opts.maxLines
          ? result.data.slice(0, opts.maxLines)
          : result.data

        return new Tools.DataOutput({
          data: lines,
          meta: new Tools.DatasetMetaOutput({
            sourceType: result.meta.sourceType,
            location: result.meta.location,
            format: result.meta.format,
            sizeBytes: result.meta.sizeBytes,
            loadedAt: result.meta.loadedAt
          })
        })
      }).pipe(withPlatform, Effect.catchAll(() => Effect.succeed(new Tools.DataOutput({
        data: [],
        meta: new Tools.DatasetMetaOutput({
          sourceType: "file",
          location,
          format: "lines",
          loadedAt: Date.now()
        })
      })))),

    stream_load_jsonl: ({ location, options }: { readonly location: string; readonly options?: { readonly timeout?: number | undefined; readonly maxRecords?: number | undefined; readonly skipInvalid?: boolean | undefined } | undefined }) =>
      Effect.gen(function* () {
        const opts = options ?? {}
        const sourceType = location.startsWith("http") ? "url" as const : "file" as const

        const result = yield* DatasetLoader.loadJsonl(
          { type: sourceType, location },
          filterUndefined({ timeout: opts.timeout, skipInvalid: opts.skipInvalid ?? false })
        )

        const records = opts.maxRecords
          ? result.data.slice(0, opts.maxRecords)
          : result.data

        return new Tools.DataOutput({
          data: records,
          meta: new Tools.DatasetMetaOutput({
            sourceType: result.meta.sourceType,
            location: result.meta.location,
            format: result.meta.format,
            sizeBytes: result.meta.sizeBytes,
            loadedAt: result.meta.loadedAt
          })
        })
      }).pipe(withPlatform, Effect.catchAll(() => Effect.succeed(new Tools.DataOutput({
        data: [],
        meta: new Tools.DatasetMetaOutput({
          sourceType: "file",
          location,
          format: "jsonl",
          loadedAt: Date.now()
        })
      })))),

    stream_load_json: ({ location, options }: { readonly location: string; readonly options?: { readonly timeout?: number | undefined } | undefined }) =>
      Effect.gen(function* () {
        const opts = options ?? {}
        const sourceType = location.startsWith("http") ? "url" as const : "file" as const

        const result = yield* DatasetLoader.loadJson(
          { type: sourceType, location },
          filterUndefined({ timeout: opts.timeout })
        )

        return new Tools.DataOutput({
          data: result.data,
          meta: new Tools.DatasetMetaOutput({
            sourceType: result.meta.sourceType,
            location: result.meta.location,
            format: result.meta.format,
            sizeBytes: result.meta.sizeBytes,
            loadedAt: result.meta.loadedAt
          })
        })
      }).pipe(withPlatform, Effect.catchAll(() => Effect.succeed(new Tools.DataOutput({
        data: null,
        meta: new Tools.DatasetMetaOutput({
          sourceType: "file",
          location,
          format: "json",
          loadedAt: Date.now()
        })
      })))),

    // ==========================
    // Pipeline Operations
    // ==========================

    stream_process_file: ({ path, stages, options }: { readonly path: string; readonly stages: ReadonlyArray<"trim" | "lowercase" | "uppercase" | "removePunctuation" | "normalizeWhitespace">; readonly options?: { readonly maxLines?: number | undefined; readonly skipEmpty?: boolean | undefined; readonly stopOnError?: boolean | undefined } | undefined }) =>
      Effect.gen(function* () {
        const opts = options ?? {}

        const pipelineOpts: { skipEmpty?: boolean } = {}
        if (opts.skipEmpty !== undefined) pipelineOpts.skipEmpty = opts.skipEmpty

        let pipeline: Pipeline.StreamPipeline<any, any, any> = Pipeline.Pipeline.fromFile(path, pipelineOpts)

        for (const stage of stages) {
          switch (stage) {
            case "trim":
              pipeline = pipeline.map("trim", (s: string) => s.trim())
              break
            case "lowercase":
              pipeline = pipeline.map("lowercase", (s: string) => s.toLowerCase())
              break
            case "uppercase":
              pipeline = pipeline.map("uppercase", (s: string) => s.toUpperCase())
              break
            case "removePunctuation":
              pipeline = pipeline.map("removePunctuation", (s: string) => s.replace(/[^\w\s]/g, ""))
              break
            case "normalizeWhitespace":
              pipeline = pipeline.map("normalizeWhitespace", (s: string) => s.replace(/\s+/g, " ").trim())
              break
          }
        }

        if (opts.maxLines) {
          pipeline = pipeline.take(opts.maxLines)
        }

        const result = yield* pipeline.run()

        return new Tools.PipelineOutput({
          results: result.data as unknown[],
          processed: result.processed,
          failed: result.failed,
          skipped: result.skipped,
          durationMs: result.duration,
          errors: result.errors.map((e) => ({
            item: e.item,
            error: e.error,
            stage: e.stage
          }))
        })
      }).pipe(withPlatform, Effect.catchAll(() => Effect.succeed(new Tools.PipelineOutput({
        results: [],
        processed: 0,
        failed: 0,
        skipped: 0,
        durationMs: 0,
        errors: []
      })))),

    stream_filter_lines: ({ path, pattern, options }: { readonly path: string; readonly pattern: string; readonly options?: { readonly invert?: boolean | undefined; readonly maxLines?: number | undefined; readonly caseInsensitive?: boolean | undefined } | undefined }) =>
      Effect.gen(function* () {
        const opts = options ?? {}
        const regex = new RegExp(pattern, opts.caseInsensitive ? "i" : "")
        const maxLines = opts.maxLines ?? 1000

        const lines = yield* TextStream.streamLines(path, { trim: true, skipEmpty: true }).pipe(
          Stream.filter((line) => {
            const matches = regex.test(line)
            return opts.invert ? !matches : matches
          }),
          Stream.take(maxLines),
          Stream.runCollect,
          Effect.map(Chunk.toReadonlyArray)
        )

        return new Tools.LinesOutput({
          lines: lines as string[],
          count: lines.length,
          truncated: lines.length >= maxLines
        })
      }).pipe(withPlatform, Effect.catchAll(() => Effect.succeed(new Tools.LinesOutput({
        lines: [],
        count: 0,
        truncated: false
      })))),

    stream_extract_matches: ({ path, pattern, options }: { readonly path: string; readonly pattern: string; readonly options?: { readonly fullLines?: boolean | undefined; readonly maxMatches?: number | undefined; readonly caseInsensitive?: boolean | undefined } | undefined }) =>
      Effect.gen(function* () {
        const opts = options ?? {}
        const regex = new RegExp(pattern, `g${opts.caseInsensitive ? "i" : ""}`)
        const maxMatches = opts.maxMatches ?? 1000

        if (opts.fullLines) {
          const lineRegex = new RegExp(pattern, opts.caseInsensitive ? "i" : "")
          const lines = yield* TextStream.streamLines(path, { trim: true, skipEmpty: true }).pipe(
            Stream.filter((line) => lineRegex.test(line)),
            Stream.take(maxMatches),
            Stream.runCollect,
            Effect.map(Chunk.toReadonlyArray)
          )

          return new Tools.LinesOutput({
            lines: lines as string[],
            count: lines.length,
            truncated: lines.length >= maxMatches
          })
        }

        const content = yield* TextStream.readTextFile(path)
        const allMatches = Array.from(content.matchAll(regex), (m) => m[0])
        const matches = allMatches.slice(0, maxMatches)

        return new Tools.LinesOutput({
          lines: matches,
          count: matches.length,
          truncated: allMatches.length > maxMatches
        })
      }).pipe(withPlatform, Effect.catchAll(() => Effect.succeed(new Tools.LinesOutput({
        lines: [],
        count: 0,
        truncated: false
      })))),

    // ==========================
    // Batch Operations
    // ==========================

    stream_count_lines: ({ path, options }: { readonly path: string; readonly options?: { readonly skipEmpty?: boolean | undefined } | undefined }) =>
      Effect.gen(function* () {
        const opts = options ?? {}

        if (opts.skipEmpty) {
          const count = yield* TextStream.streamLines(path, { skipEmpty: true }).pipe(
            Stream.runCount
          )
          return { count }
        }

        const count = yield* TextStream.countLines(path)
        return { count }
      }).pipe(withPlatform, Effect.catchAll(() => Effect.succeed({ count: 0 }))),

    stream_count_jsonl: ({ path, options }: { readonly path: string; readonly options?: { readonly skipInvalid?: boolean | undefined } | undefined }) =>
      Effect.gen(function* () {
        const opts = options ?? {}
        const stats = yield* Jsonl.computeJsonlStats(path)

        if (opts.skipInvalid) {
          return {
            count: stats.successCount,
            errors: stats.errorCount > 0 ? stats.errorCount : undefined
          }
        }

        return {
          count: stats.totalLines,
          errors: stats.errorCount > 0 ? stats.errorCount : undefined
        }
      }).pipe(withPlatform, Effect.catchAll(() => Effect.succeed({ count: 0 })))
  }
})


/**
 * Create the handlers layer for all streaming tools.
 * This connects the handlers to the StreamingToolkit.
 */
export const StreamingHandlersLayer = Tools.StreamingToolkit.toLayer(makeStreamingHandlers)
