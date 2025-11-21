/**
 * GraphExecutor - Core execution engine for graph operations
 *
 * The GraphExecutor is responsible for:
 * - Executing operations on graphs
 * - Managing execution strategies (sequential, parallel)
 * - Caching results
 * - Collecting metrics
 * - Validating operations
 *
 * This is the heart of the graph operations system.
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Duration from "effect/Duration"
import type { EffectGraph, GraphNode } from "../EffectGraph.js"
import * as EG from "../EffectGraph.js"
import type { GraphOperation } from "./Operation.js"
import * as ResultStore from "./ResultStore.js"
import * as Types from "./Types.js"
import { ExecutionError, ValidationError } from "./Errors.js"

// =============================================================================
// GraphExecutor Interface
// =============================================================================

/**
 * GraphExecutor service
 */
export interface GraphExecutor {
  /**
   * Execute an operation on a graph
   *
   * Finds all leaf nodes and applies the operation to each,
   * adding resulting nodes as children.
   */
  readonly execute: <A, B, R, E>(
    graph: EffectGraph<A>,
    operation: GraphOperation<A, B, R, E>,
    options?: Partial<Types.ExecutionOptions>
  ) => Effect.Effect<
    Types.OperationResult<A, B, E>,
    ExecutionError | ValidationError,
    R | ResultStore.ResultStore
  >

  /**
   * Validate that an operation can be executed on a graph
   */
  readonly validate: <A, B, R, E>(
    graph: EffectGraph<A>,
    operation: GraphOperation<A, B, R, E>
  ) => Effect.Effect<Types.ValidationResult, never, never>

  /**
   * Estimate cost of executing an operation
   */
  readonly estimateCost: <A, B, R, E>(
    graph: EffectGraph<A>,
    operation: GraphOperation<A, B, R, E>
  ) => Effect.Effect<Types.OperationCost, never, never>
}

/**
 * Context tag for GraphExecutor
 */
export const GraphExecutor = Context.GenericTag<GraphExecutor>("GraphExecutor")

// =============================================================================
// Implementation
// =============================================================================

/**
 * Get leaf nodes (nodes with no children)
 */
const getLeafNodes = <A>(graph: EffectGraph<A>): ReadonlyArray<GraphNode<A>> => {
  const allNodes = EG.toArray(graph)
  return allNodes.filter((node) => EG.getChildren(graph, node.id).length === 0)
}

/**
 * Execute operation with sequential strategy
 */
const executeSequential = <A, B, R, E>(
  leafNodes: ReadonlyArray<GraphNode<A>>,
  operation: GraphOperation<A, B, R, E>,
  cache: boolean
): Effect.Effect<
  {
    readonly newNodes: ReadonlyArray<GraphNode<B>>
    readonly errors: ReadonlyArray<E>
    readonly metrics: Types.ExecutionMetrics
  },
  never,
  R | ResultStore.ResultStore
> =>
  Effect.gen(function* () {
    const store = yield* ResultStore.ResultStore
    const startTime = Date.now()

    let allNewNodes: GraphNode<B>[] = []
    let allErrors: E[] = []
    let cacheHits = 0
    let cacheMisses = 0

    for (const leafNode of leafNodes) {
      // Check cache if enabled
      if (cache) {
        const key = ResultStore.ResultKey.make(operation.name, leafNode.id)
        const cached = yield* store.get<A, B, E>(key)

        if (Option.isSome(cached)) {
          cacheHits++
          allNewNodes.push(...cached.value.newNodes)
          allErrors.push(...cached.value.errors)
          continue
        }

        cacheMisses++
      }

      // Apply operation
      const result = yield* Effect.either(operation.apply(leafNode))

      if (result._tag === "Left") {
        // Operation failed - collect error
        allErrors.push(result.left as E)
      } else {
        // Operation succeeded - collect new nodes
        const newNodes = result.right
        allNewNodes.push(...newNodes)

        // Cache result if enabled
        if (cache) {
          const key = ResultStore.ResultKey.make(operation.name, leafNode.id)
          const opResult = Types.OperationResult.make(
            Types.ExecutionId.generate(),
            null,
            newNodes,
            [],
            Types.ExecutionMetrics.empty()
          )
          yield* store.store(key, opResult)
        }
      }
    }

    const endTime = Date.now()
    const metrics: Types.ExecutionMetrics = {
      duration: Duration.millis(endTime - startTime),
      nodesProcessed: leafNodes.length,
      nodesCreated: allNewNodes.length,
      tokensConsumed: 0, // TODO: Track from LLM operations
      cacheHits,
      cacheMisses
    }

    return {
      newNodes: allNewNodes,
      errors: allErrors,
      metrics
    }
  })

/**
 * Execute operation with parallel strategy
 */
const executeParallel = <A, B, R, E>(
  leafNodes: ReadonlyArray<GraphNode<A>>,
  operation: GraphOperation<A, B, R, E>,
  concurrency: number,
  cache: boolean
): Effect.Effect<
  {
    readonly newNodes: ReadonlyArray<GraphNode<B>>
    readonly errors: ReadonlyArray<E>
    readonly metrics: Types.ExecutionMetrics
  },
  never,
  R | ResultStore.ResultStore
> =>
  Effect.gen(function* () {
    const store = yield* ResultStore.ResultStore
    const startTime = Date.now()

    // Process nodes in parallel with concurrency limit
    const results = yield* Effect.all(
      leafNodes.map((leafNode) =>
        Effect.gen(function* () {
          // Check cache
          if (cache) {
            const key = ResultStore.ResultKey.make(operation.name, leafNode.id)
            const cached = yield* store.get<A, B, E>(key)

            if (Option.isSome(cached)) {
              return {
                newNodes: cached.value.newNodes,
                errors: cached.value.errors,
                fromCache: true
              }
            }
          }

          // Apply operation
          const result = yield* Effect.either(operation.apply(leafNode))

          if (result._tag === "Left") {
            return {
              newNodes: [] as GraphNode<B>[],
              errors: [result.left as E],
              fromCache: false
            }
          } else {
            const newNodes = result.right

            // Cache result
            if (cache) {
              const key = ResultStore.ResultKey.make(operation.name, leafNode.id)
              const opResult = Types.OperationResult.make(
                Types.ExecutionId.generate(),
                null,
                newNodes,
                [],
                Types.ExecutionMetrics.empty()
              )
              yield* store.store(key, opResult)
            }

            return {
              newNodes,
              errors: [] as E[],
              fromCache: false
            }
          }
        })
      ),
      { concurrency }
    )

    const endTime = Date.now()

    // Aggregate results
    const allNewNodes = results.flatMap((r) => r.newNodes)
    const allErrors = results.flatMap((r) => r.errors)
    const cacheHits = results.filter((r) => r.fromCache).length
    const cacheMisses = results.filter((r) => !r.fromCache).length

    const metrics: Types.ExecutionMetrics = {
      duration: Duration.millis(endTime - startTime),
      nodesProcessed: leafNodes.length,
      nodesCreated: allNewNodes.length,
      tokensConsumed: 0,
      cacheHits,
      cacheMisses
    }

    return {
      newNodes: allNewNodes,
      errors: allErrors,
      metrics
    }
  })

/**
 * Create GraphExecutor implementation
 */
const makeGraphExecutor = Effect.sync(() =>
  GraphExecutor.of({
    execute: <A, B, R, E>(
      graph: EffectGraph<A>,
      operation: GraphOperation<A, B, R, E>,
      options: Partial<Types.ExecutionOptions> = {}
    ) =>
      Effect.gen(function* () {
        const opts = { ...Types.ExecutionOptions.default(), ...options }
        const executionId = Types.ExecutionId.generate()

        // Get leaf nodes
        const leafNodes = getLeafNodes(graph)

        if (leafNodes.length === 0) {
          // No leaf nodes - return empty result
          return Types.OperationResult.make(
            executionId,
            graph,
            [],
            [],
            Types.ExecutionMetrics.empty()
          )
        }

        // Execute based on strategy
        let result: {
          readonly newNodes: ReadonlyArray<GraphNode<B>>
          readonly errors: ReadonlyArray<E>
          readonly metrics: Types.ExecutionMetrics
        }

        switch (opts.strategy._tag) {
          case "Sequential":
            result = yield* executeSequential(
              leafNodes,
              operation,
              opts.cache
            )
            break

          case "Parallel":
            result = yield* executeParallel(
              leafNodes,
              operation,
              opts.strategy.concurrency,
              opts.cache
            )
            break

          case "Batch":
          case "Streaming":
            // TODO: Implement batch and streaming strategies
            result = yield* executeSequential(
              leafNodes,
              operation,
              opts.cache
            )
            break

          default:
            return yield* Effect.fail(
              new ExecutionError({
                message: `Unknown execution strategy: ${(opts.strategy as any)._tag}`
              })
            )
        }

        return Types.OperationResult.make(
          executionId,
          graph,
          result.newNodes,
          result.errors,
          result.metrics
        )
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            error instanceof ExecutionError || error instanceof ValidationError
              ? error
              : new ExecutionError({
                  message: "Execution failed",
                  cause: error
                })
          )
        )
      ),

    validate: <A, B, R, E>(
      graph: EffectGraph<A>,
      operation: GraphOperation<A, B, R, E>
    ) =>
      Effect.gen(function* () {
        const leafNodes = getLeafNodes(graph)

        if (leafNodes.length === 0) {
          return Types.ValidationResult.withWarnings(
            Types.ValidationResult.valid(),
            ["No leaf nodes to apply operation to"]
          )
        }

        // Validate operation can be applied to each leaf node
        const validations = yield* Effect.all(
          leafNodes.map((node) => operation.validate(node))
        )

        // Aggregate validation results
        const allErrors = validations.flatMap((v) => v.errors)
        const allWarnings = validations.flatMap((v) => v.warnings)

        if (allErrors.length > 0) {
          return {
            valid: false,
            errors: allErrors,
            warnings: allWarnings
          }
        }

        return {
          valid: true,
          errors: [],
          warnings: allWarnings
        }
      }),

    estimateCost: <A, B, R, E>(
      graph: EffectGraph<A>,
      operation: GraphOperation<A, B, R, E>
    ) =>
      Effect.gen(function* () {
        const leafNodes = getLeafNodes(graph)

        if (leafNodes.length === 0) {
          return Types.OperationCost.zero()
        }

        // Get cost estimate for one node
        const sampleCost = yield* operation.estimateCost(leafNodes[0]!)

        // Scale by number of nodes
        return Types.OperationCost.scale(sampleCost, leafNodes.length)
      })
  })
)

/**
 * Live layer for GraphExecutor
 */
export const GraphExecutorLive: Layer.Layer<
  GraphExecutor,
  never,
  ResultStore.ResultStore
> = Layer.effect(GraphExecutor, makeGraphExecutor)

/**
 * Test layer for GraphExecutor (with test result store)
 */
export const GraphExecutorTest: Layer.Layer<GraphExecutor, never, never> =
  GraphExecutorLive.pipe(Layer.provide(ResultStore.ResultStoreTest))
