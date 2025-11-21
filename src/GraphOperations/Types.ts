/**
 * Core types for graph operations
 *
 * Defines execution strategies, metrics, costs, and other foundational types
 * for the graph operations engine.
 */

import * as Duration from "effect/Duration"
import type { GraphNode, NodeId } from "../EffectGraph.js"

// =============================================================================
// Execution Strategy
// =============================================================================

/**
 * Execution strategy determines how operations are executed
 */
export type ExecutionStrategy =
  | { readonly _tag: "Sequential" }
  | { readonly _tag: "Parallel"; readonly concurrency: number }
  | { readonly _tag: "Batch"; readonly batchSize: number }
  | { readonly _tag: "Streaming" }

export const ExecutionStrategy = {
  Sequential: { _tag: "Sequential" } as const,
  Parallel: (concurrency: number): ExecutionStrategy => ({
    _tag: "Parallel",
    concurrency
  }),
  Batch: (batchSize: number): ExecutionStrategy => ({
    _tag: "Batch",
    batchSize
  }),
  Streaming: { _tag: "Streaming" } as const
}

// =============================================================================
// Operation Metrics
// =============================================================================

/**
 * Metrics collected during operation execution
 */
export interface ExecutionMetrics {
  readonly duration: Duration.Duration
  readonly nodesProcessed: number
  readonly nodesCreated: number
  readonly tokensConsumed: number // For LLM operations
  readonly cacheHits: number
  readonly cacheMisses: number
}

export const ExecutionMetrics = {
  empty: (): ExecutionMetrics => ({
    duration: Duration.zero,
    nodesProcessed: 0,
    nodesCreated: 0,
    tokensConsumed: 0,
    cacheHits: 0,
    cacheMisses: 0
  }),

  /**
   * Combine metrics (monoid)
   */
  combine: (m1: ExecutionMetrics, m2: ExecutionMetrics): ExecutionMetrics => ({
    duration: Duration.sum(m1.duration, m2.duration),
    nodesProcessed: m1.nodesProcessed + m2.nodesProcessed,
    nodesCreated: m1.nodesCreated + m2.nodesCreated,
    tokensConsumed: m1.tokensConsumed + m2.tokensConsumed,
    cacheHits: m1.cacheHits + m2.cacheHits,
    cacheMisses: m1.cacheMisses + m2.cacheMisses
  })
}

// =============================================================================
// Operation Cost Estimation
// =============================================================================

/**
 * Estimated cost of an operation
 */
export interface OperationCost {
  readonly estimatedTime: Duration.Duration
  readonly tokenCost: number // LLM tokens
  readonly memoryCost: number // Bytes
  readonly complexity: "O(1)" | "O(n)" | "O(n log n)" | "O(n²)"
}

export const OperationCost = {
  zero: (): OperationCost => ({
    estimatedTime: Duration.zero,
    tokenCost: 0,
    memoryCost: 0,
    complexity: "O(1)"
  }),

  /**
   * Estimate cost for multiple nodes
   */
  scale: (cost: OperationCost, nodeCount: number): OperationCost => {
    const timeMultiplier =
      cost.complexity === "O(1)"
        ? 1
        : cost.complexity === "O(n)"
          ? nodeCount
          : cost.complexity === "O(n log n)"
            ? nodeCount * Math.log2(nodeCount)
            : nodeCount * nodeCount

    return {
      estimatedTime: Duration.times(cost.estimatedTime, timeMultiplier),
      tokenCost: cost.tokenCost * nodeCount,
      memoryCost: cost.memoryCost * nodeCount,
      complexity: cost.complexity
    }
  }
}

// =============================================================================
// Validation Result
// =============================================================================

/**
 * Result of validating an operation
 */
export interface ValidationResult {
  readonly valid: boolean
  readonly errors: ReadonlyArray<string>
  readonly warnings: ReadonlyArray<string>
}

export const ValidationResult = {
  valid: (): ValidationResult => ({
    valid: true,
    errors: [],
    warnings: []
  }),

  invalid: (errors: ReadonlyArray<string>): ValidationResult => ({
    valid: false,
    errors,
    warnings: []
  }),

  withWarnings: (
    result: ValidationResult,
    warnings: ReadonlyArray<string>
  ): ValidationResult => ({
    ...result,
    warnings: [...result.warnings, ...warnings]
  })
}

// =============================================================================
// Operation Category
// =============================================================================

/**
 * Category of operation
 */
export type OperationCategory =
  | "transformation" // A → B (map-like)
  | "expansion" // A → [B] (one-to-many)
  | "aggregation" // [A] → B (many-to-one)
  | "filtering" // A → Option<A> (predicate)
  | "composition" // Multiple operations
  | "llm" // LLM-powered

// =============================================================================
// Execution Options
// =============================================================================

/**
 * Options for executing operations
 */
export interface ExecutionOptions {
  readonly strategy: ExecutionStrategy
  readonly cache: boolean
  readonly trace: boolean
  readonly timeout: Duration.Duration | null
}

export const ExecutionOptions = {
  default: (): ExecutionOptions => ({
    strategy: ExecutionStrategy.Sequential,
    cache: true,
    trace: false,
    timeout: null
  }),

  sequential: (): ExecutionOptions => ({
    ...ExecutionOptions.default(),
    strategy: ExecutionStrategy.Sequential
  }),

  parallel: (concurrency: number = 4): ExecutionOptions => ({
    ...ExecutionOptions.default(),
    strategy: ExecutionStrategy.Parallel(concurrency)
  })
}

// =============================================================================
// Execution ID
// =============================================================================

/**
 * Unique identifier for an execution
 */
export type ExecutionId = string & { readonly _brand: "ExecutionId" }

export const ExecutionId = {
  make: (id: string): ExecutionId => id as ExecutionId,
  generate: (): ExecutionId => ExecutionId.make(crypto.randomUUID())
}

// =============================================================================
// Operation Result
// =============================================================================

/**
 * Result of executing an operation on a graph
 */
export interface OperationResult<A, B, E> {
  readonly executionId: ExecutionId
  readonly originalGraph: unknown // Store original graph reference
  readonly newNodes: ReadonlyArray<GraphNode<B>>
  readonly errors: ReadonlyArray<E>
  readonly metrics: ExecutionMetrics
  readonly timestamp: number
}

export const OperationResult = {
  make: <A, B, E>(
    executionId: ExecutionId,
    originalGraph: unknown,
    newNodes: ReadonlyArray<GraphNode<B>>,
    errors: ReadonlyArray<E>,
    metrics: ExecutionMetrics
  ): OperationResult<A, B, E> => ({
    executionId,
    originalGraph,
    newNodes,
    errors,
    metrics,
    timestamp: Date.now()
  })
}
