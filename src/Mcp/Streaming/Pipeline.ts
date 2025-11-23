/**
 * Pipeline - Composable text processing pipelines
 *
 * Provides a fluent API for building text processing workflows:
 * - Composable pipeline stages
 * - Progress tracking
 * - Error recovery
 * - Batch processing
 * - Concurrent execution
 *
 * @module Mcp/Streaming/Pipeline
 */

import { FileSystem, Path } from "@effect/platform"
import * as Chunk from "effect/Chunk"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"

import { type TextEncoding, streamLines, TextStreamError, FileNotFoundError } from "./TextStream.js"
import { JsonlParseError, JsonlValidationError, streamJsonl } from "./Jsonl.js"

// =============================================================================
// Types and Schemas
// =============================================================================

/**
 * Pipeline stage that transforms input to output
 */
export interface PipelineStage<A, B, E = never, R = never> {
  readonly name: string
  readonly transform: (input: A) => Effect.Effect<B, E, R>
}

/**
 * Pipeline progress information
 */
export class PipelineProgress extends Schema.Class<PipelineProgress>("PipelineProgress")({
  /** Current stage name */
  stage: Schema.String,
  /** Items processed */
  processed: Schema.Number,
  /** Items failed */
  failed: Schema.Number,
  /** Items skipped */
  skipped: Schema.Number,
  /** Start timestamp */
  startedAt: Schema.Number,
  /** Current timestamp */
  currentAt: Schema.Number,
  /** Estimated items remaining */
  remaining: Schema.optional(Schema.Number),
  /** Processing rate (items/second) */
  rate: Schema.Number
}) {}

/**
 * Pipeline result
 */
export class PipelineResult<A> {
  constructor(
    /** Output data */
    readonly data: ReadonlyArray<A>,
    /** Total items processed */
    readonly processed: number,
    /** Items that failed */
    readonly failed: number,
    /** Items that were skipped */
    readonly skipped: number,
    /** Execution time in ms */
    readonly duration: number,
    /** Errors encountered */
    readonly errors: ReadonlyArray<{ item: unknown; error: string; stage: string }>
  ) {}
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Stop on first error (default: false) */
  readonly stopOnError?: boolean
  /** Maximum concurrent operations (default: 1) */
  readonly concurrency?: number
  /** Batch size for batch operations (default: 100) */
  readonly batchSize?: number
  /** Progress callback */
  readonly onProgress?: (progress: PipelineProgress) => void
  /** Error callback */
  readonly onError?: (error: unknown, item: unknown, stage: string) => void
}

// =============================================================================
// Pipeline Builder
// =============================================================================

/**
 * Fluent pipeline builder
 */
export class Pipeline<A, E = never, R = never> {
  private readonly stages: Array<PipelineStage<any, any, any, any>> = []
  private readonly config: PipelineConfig

  private constructor(
    stages: Array<PipelineStage<any, any, any, any>>,
    config: PipelineConfig
  ) {
    this.stages = stages
    this.config = config
  }

  /**
   * Create a new pipeline starting from string input
   */
  static fromString(config: PipelineConfig = {}): Pipeline<string> {
    return new Pipeline([], config)
  }

  /**
   * Create a pipeline from a stream source
   */
  static fromStream<A, SE, SR>(
    stream: Stream.Stream<A, SE, SR>,
    config: PipelineConfig = {}
  ): StreamPipeline<A, SE, SR> {
    return new StreamPipeline(stream, [], config)
  }

  /**
   * Create a pipeline from a file
   */
  static fromFile(
    filePath: string,
    options: { encoding?: TextEncoding; skipEmpty?: boolean; trim?: boolean } = {},
    config: PipelineConfig = {}
  ): StreamPipeline<string, TextStreamError | FileNotFoundError, FileSystem.FileSystem | Path.Path> {
    return new StreamPipeline(
      streamLines(filePath, options),
      [],
      config
    )
  }

  /**
   * Create a pipeline from a JSONL file
   */
  static fromJsonl<A = unknown>(
    filePath: string,
    options: { skipInvalid?: boolean } = {},
    config: PipelineConfig = {}
  ): StreamPipeline<A, TextStreamError | FileNotFoundError | JsonlParseError | JsonlValidationError, FileSystem.FileSystem | Path.Path> {
    return new StreamPipeline(
      streamJsonl<A>(filePath, options),
      [],
      config
    )
  }

  /**
   * Create a pipeline from an iterable
   */
  static fromIterable<A>(
    items: Iterable<A>,
    config: PipelineConfig = {}
  ): StreamPipeline<A, never, never> {
    return new StreamPipeline(
      Stream.fromIterable(items),
      [],
      config
    )
  }

  /**
   * Add a transformation stage
   */
  pipe<B, E2, R2>(
    name: string,
    transform: (input: A) => Effect.Effect<B, E2, R2>
  ): Pipeline<B, E | E2, R | R2> {
    return new Pipeline(
      [...this.stages, { name, transform }],
      this.config
    )
  }

  /**
   * Add a map stage (synchronous)
   */
  map<B>(name: string, fn: (input: A) => B): Pipeline<B, E, R> {
    return this.pipe(name, (input) => Effect.succeed(fn(input)))
  }

  /**
   * Add a filter stage
   */
  filter(name: string, predicate: (input: A) => boolean): Pipeline<A, E, R> {
    return new Pipeline(
      [...this.stages, { name, transform: (input: A) =>
        predicate(input) ? Effect.succeed(input) : Effect.fail("filtered" as any)
      }],
      this.config
    ) as any
  }

  /**
   * Add a flatMap stage
   */
  flatMap<B, E2, R2>(
    name: string,
    fn: (input: A) => Effect.Effect<ReadonlyArray<B>, E2, R2>
  ): Pipeline<B, E | E2, R | R2> {
    return new Pipeline(
      [...this.stages, { name, transform: fn }],
      this.config
    ) as any
  }

  /**
   * Execute pipeline on a single item
   */
  run(input: A): Effect.Effect<unknown, E, R> {
    return this.stages.reduce(
      (acc, stage) => Effect.flatMap(acc, stage.transform),
      Effect.succeed(input) as Effect.Effect<unknown, E, R>
    )
  }

  /**
   * Execute pipeline on multiple items
   */
  runAll(inputs: Iterable<A>): Effect.Effect<PipelineResult<unknown>, never, R> {
    return Effect.gen(function* (this: Pipeline<A, E, R>) {
      const startedAt = Date.now()
      const results: unknown[] = []
      const errors: Array<{ item: unknown; error: string; stage: string }> = []
      let processed = 0
      let failed = 0
      let skipped = 0

      for (const input of inputs) {
        const result = yield* this.run(input).pipe(
          Effect.map((value) => ({ _tag: "success" as const, value })),
          Effect.catchAll((error) =>
            Effect.succeed({ _tag: "error" as const, error: String(error) })
          )
        )

        if (result._tag === "success") {
          results.push(result.value)
          processed++
        } else {
          if (result.error === "filtered") {
            skipped++
          } else {
            failed++
            errors.push({
              item: input,
              error: result.error,
              stage: this.stages[this.stages.length - 1]?.name ?? "unknown"
            })

            if (this.config.stopOnError) {
              break
            }
          }
        }

        // Progress callback
        if (this.config.onProgress) {
          const elapsed = Date.now() - startedAt
          this.config.onProgress(new PipelineProgress({
            stage: this.stages[this.stages.length - 1]?.name ?? "complete",
            processed,
            failed,
            skipped,
            startedAt,
            currentAt: Date.now(),
            rate: elapsed > 0 ? (processed / elapsed) * 1000 : 0
          }))
        }
      }

      return new PipelineResult(
        results,
        processed,
        failed,
        skipped,
        Date.now() - startedAt,
        errors
      )
    }.bind(this))
  }
}

// =============================================================================
// Stream Pipeline
// =============================================================================

/**
 * Pipeline that operates on streams for memory efficiency
 */
export class StreamPipeline<A, E, R> {
  constructor(
    private readonly source: Stream.Stream<A, E, R>,
    private readonly stages: Array<PipelineStage<any, any, any, any>>,
    private readonly config: PipelineConfig
  ) {}

  /**
   * Add a transformation stage
   */
  pipe<B, E2, R2>(
    name: string,
    transform: (input: A) => Effect.Effect<B, E2, R2>
  ): StreamPipeline<B, E | E2, R | R2> {
    return new StreamPipeline(
      this.source as any,
      [...this.stages, { name, transform }],
      this.config
    )
  }

  /**
   * Add a map stage (synchronous)
   */
  map<B>(name: string, fn: (input: A) => B): StreamPipeline<B, E, R> {
    return this.pipe(name, (input) => Effect.succeed(fn(input)))
  }

  /**
   * Add a filter stage
   */
  filter(predicate: (input: A) => boolean): StreamPipeline<A, E, R> {
    return new StreamPipeline(
      this.source.pipe(Stream.filter(predicate)),
      this.stages,
      this.config
    )
  }

  /**
   * Add a flatMap stage
   */
  flatMap<B, E2, R2>(
    name: string,
    fn: (input: A) => Effect.Effect<ReadonlyArray<B>, E2, R2>
  ): StreamPipeline<B, E | E2, R | R2> {
    return new StreamPipeline(
      this.source.pipe(
        Stream.mapEffect((item) => fn(item as any)),
        Stream.flatMap(Stream.fromIterable)
      ) as any,
      this.stages,
      this.config
    )
  }

  /**
   * Batch items for bulk processing
   */
  batch(size: number): StreamPipeline<Chunk.Chunk<A>, E, R> {
    return new StreamPipeline(
      this.source.pipe(Stream.grouped(size)),
      this.stages,
      this.config
    )
  }

  /**
   * Take first N items
   */
  take(n: number): StreamPipeline<A, E, R> {
    return new StreamPipeline(
      this.source.pipe(Stream.take(n)),
      this.stages,
      this.config
    )
  }

  /**
   * Skip first N items
   */
  skip(n: number): StreamPipeline<A, E, R> {
    return new StreamPipeline(
      this.source.pipe(Stream.drop(n)),
      this.stages,
      this.config
    )
  }

  /**
   * Get the underlying stream after all transformations
   */
  toStream(): Stream.Stream<unknown, E, R> {
    const concurrency = this.config.concurrency ?? 1

    return this.stages.reduce(
      (stream, stage) =>
        stream.pipe(
          Stream.mapEffect(stage.transform, { concurrency })
        ),
      this.source as Stream.Stream<unknown, E, R>
    )
  }

  /**
   * Execute pipeline and collect results
   */
  run(): Effect.Effect<PipelineResult<unknown>, E, R> {
    return Effect.gen(function* (this: StreamPipeline<A, E, R>) {
      const startedAt = Date.now()
      const results: unknown[] = []
      const errors: Array<{ item: unknown; error: string; stage: string }> = []
      let processed = 0
      let failed = 0
      let skipped = 0

      const stream = this.toStream()

      yield* stream.pipe(
        Stream.runForEach((item) =>
          Effect.sync(() => {
            results.push(item)
            processed++
          })
        ),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            failed++
            errors.push({
              item: null,
              error: String(error),
              stage: "stream"
            })
          })
        )
      )

      return new PipelineResult(
        results,
        processed,
        failed,
        skipped,
        Date.now() - startedAt,
        errors
      )
    }.bind(this))
  }

  /**
   * Execute pipeline with progress tracking
   */
  runWithProgress(
    onProgress: (progress: PipelineProgress) => void
  ): Effect.Effect<PipelineResult<unknown>, E, R> {
    return Effect.gen(function* (this: StreamPipeline<A, E, R>) {
      const startedAt = Date.now()
      const results: unknown[] = []
      const errors: Array<{ item: unknown; error: string; stage: string }> = []
      let processed = 0
      let failed = 0

      const stream = this.toStream()

      yield* stream.pipe(
        Stream.tap((item) =>
          Effect.sync(() => {
            results.push(item)
            processed++

            const elapsed = Date.now() - startedAt
            onProgress(new PipelineProgress({
              stage: "processing",
              processed,
              failed,
              skipped: 0,
              startedAt,
              currentAt: Date.now(),
              rate: elapsed > 0 ? (processed / elapsed) * 1000 : 0
            }))
          })
        ),
        Stream.runDrain,
        Effect.catchAll((error) =>
          Effect.sync(() => {
            failed++
            errors.push({
              item: null,
              error: String(error),
              stage: "stream"
            })
          })
        )
      )

      return new PipelineResult(
        results,
        processed,
        failed,
        0,
        Date.now() - startedAt,
        errors
      )
    }.bind(this))
  }

  /**
   * Execute pipeline and discard results (for side effects)
   */
  runDrain(): Effect.Effect<void, E, R> {
    return this.toStream().pipe(Stream.runDrain)
  }

  /**
   * Execute pipeline and count items
   */
  runCount(): Effect.Effect<number, E, R> {
    return this.toStream().pipe(Stream.runCount)
  }

  /**
   * Execute pipeline for each item
   */
  runForEach<E2, R2>(
    fn: (item: unknown) => Effect.Effect<void, E2, R2>
  ): Effect.Effect<void, E | E2, R | R2> {
    return this.toStream().pipe(Stream.runForEach(fn))
  }
}

// =============================================================================
// Pre-built Pipeline Stages
// =============================================================================

/**
 * Common text processing stages
 */
export const TextStages = {
  /** Trim whitespace */
  trim: (): PipelineStage<string, string> => ({
    name: "trim",
    transform: (input) => Effect.succeed(input.trim())
  }),

  /** Convert to lowercase */
  lowercase: (): PipelineStage<string, string> => ({
    name: "lowercase",
    transform: (input) => Effect.succeed(input.toLowerCase())
  }),

  /** Convert to uppercase */
  uppercase: (): PipelineStage<string, string> => ({
    name: "uppercase",
    transform: (input) => Effect.succeed(input.toUpperCase())
  }),

  /** Remove punctuation */
  removePunctuation: (): PipelineStage<string, string> => ({
    name: "removePunctuation",
    transform: (input) => Effect.succeed(input.replace(/[^\w\s]/g, ""))
  }),

  /** Normalize whitespace */
  normalizeWhitespace: (): PipelineStage<string, string> => ({
    name: "normalizeWhitespace",
    transform: (input) => Effect.succeed(input.replace(/\s+/g, " ").trim())
  }),

  /** Split into words */
  tokenize: (): PipelineStage<string, ReadonlyArray<string>> => ({
    name: "tokenize",
    transform: (input) => Effect.succeed(input.split(/\s+/).filter((w) => w.length > 0))
  }),

  /** Split into sentences */
  sentencize: (): PipelineStage<string, ReadonlyArray<string>> => ({
    name: "sentencize",
    transform: (input) => Effect.succeed(
      input.split(/(?<=[.!?])\s+/).filter((s) => s.length > 0)
    )
  }),

  /** Filter by minimum length */
  minLength: (min: number): PipelineStage<string, string, Error> => ({
    name: `minLength(${min})`,
    transform: (input) =>
      input.length >= min
        ? Effect.succeed(input)
        : Effect.fail(new Error("Too short"))
  }),

  /** Filter by maximum length */
  maxLength: (max: number): PipelineStage<string, string> => ({
    name: `maxLength(${max})`,
    transform: (input) =>
      input.length <= max
        ? Effect.succeed(input)
        : Effect.succeed(input.slice(0, max))
  }),

  /** Replace pattern */
  replace: (pattern: RegExp | string, replacement: string): PipelineStage<string, string> => ({
    name: "replace",
    transform: (input) => Effect.succeed(input.replace(pattern, replacement))
  }),

  /** Match pattern */
  match: (pattern: RegExp): PipelineStage<string, ReadonlyArray<string>> => ({
    name: "match",
    transform: (input) => Effect.succeed(input.match(pattern) ?? [])
  }),

  /** Parse JSON */
  parseJson: <A>(): PipelineStage<string, A, Error> => ({
    name: "parseJson",
    transform: (input) => Effect.try({
      try: () => JSON.parse(input) as A,
      catch: (e) => e instanceof Error ? e : new Error(String(e))
    })
  }),

  /** Stringify JSON */
  stringifyJson: (): PipelineStage<unknown, string> => ({
    name: "stringifyJson",
    transform: (input) => Effect.succeed(JSON.stringify(input))
  })
}

/**
 * Composable pipeline operators
 */
export const PipelineOps = {
  /**
   * Compose two stages
   */
  compose: <A, B, C, E1, E2, R1, R2>(
    first: PipelineStage<A, B, E1, R1>,
    second: PipelineStage<B, C, E2, R2>
  ): PipelineStage<A, C, E1 | E2, R1 | R2> => ({
    name: `${first.name} → ${second.name}`,
    transform: (input) =>
      Effect.flatMap(first.transform(input), second.transform)
  }),

  /**
   * Run stages in parallel and combine results
   */
  parallel: <A, B, C, E1, E2, R1, R2>(
    first: PipelineStage<A, B, E1, R1>,
    second: PipelineStage<A, C, E2, R2>
  ): PipelineStage<A, [B, C], E1 | E2, R1 | R2> => ({
    name: `[${first.name} || ${second.name}]`,
    transform: (input) =>
      Effect.all([first.transform(input), second.transform(input)])
  }),

  /**
   * Try first stage, fallback to second on error
   */
  fallback: <A, B, E1, E2, R1, R2>(
    primary: PipelineStage<A, B, E1, R1>,
    fallback: PipelineStage<A, B, E2, R2>
  ): PipelineStage<A, B, E2, R1 | R2> => ({
    name: `${primary.name} ?? ${fallback.name}`,
    transform: (input) =>
      Effect.catchAll(primary.transform(input), () => fallback.transform(input))
  }),

  /**
   * Retry stage with exponential backoff
   */
  retry: <A, B, E, R>(
    stage: PipelineStage<A, B, E, R>,
    maxRetries: number
  ): PipelineStage<A, B, E, R> => ({
    name: `${stage.name} (retry ${maxRetries}x)`,
    transform: (input) =>
      Effect.retry(
        stage.transform(input),
        { times: maxRetries }
      )
  }),

  /**
   * Add timeout to stage
   */
  timeout: <A, B, E, R>(
    stage: PipelineStage<A, B, E, R>,
    ms: number
  ): PipelineStage<A, B, E, R> => ({
    name: `${stage.name} (${ms}ms timeout)`,
    transform: (input) =>
      Effect.timeoutFail(stage.transform(input), {
        duration: ms,
        onTimeout: () => new Error(`Timeout after ${ms}ms`) as any
      })
  }),

  /**
   * Log input/output of stage
   */
  tap: <A, B, E, R>(
    stage: PipelineStage<A, B, E, R>,
    onInput?: (input: A) => void,
    onOutput?: (output: B) => void
  ): PipelineStage<A, B, E, R> => ({
    name: `${stage.name} (tap)`,
    transform: (input) => {
      onInput?.(input)
      return Effect.tap(stage.transform(input), (output) =>
        Effect.sync(() => onOutput?.(output))
      )
    }
  })
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a simple pipeline stage
 */
export const stage = <A, B, E = never, R = never>(
  name: string,
  transform: (input: A) => Effect.Effect<B, E, R>
): PipelineStage<A, B, E, R> => ({
  name,
  transform
})

/**
 * Create a sync pipeline stage
 */
export const syncStage = <A, B>(
  name: string,
  transform: (input: A) => B
): PipelineStage<A, B> => ({
  name,
  transform: (input) => Effect.succeed(transform(input))
})

/**
 * Create a filter stage
 */
export const filterStage = <A>(
  name: string,
  predicate: (input: A) => boolean
): PipelineStage<A, A, Error> => ({
  name,
  transform: (input) =>
    predicate(input)
      ? Effect.succeed(input)
      : Effect.fail(new Error(`Filtered by ${name}`))
})
