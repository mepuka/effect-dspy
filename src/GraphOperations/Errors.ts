/**
 * Error types for graph operations
 *
 * Defines all error types that can occur during graph operation execution.
 * Uses Effect's Data module for proper error handling.
 */

import * as Data from "effect/Data"
import type { NodeId } from "../EffectGraph.js"

/**
 * Validation error - operation cannot be applied to node
 */
export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly nodeId: NodeId
  readonly operationName: string
  readonly errors: ReadonlyArray<string>
}> {}

/**
 * Timeout error - operation exceeded time limit
 */
export class TimeoutError extends Data.TaggedError("TimeoutError")<{
  readonly operationName: string
  readonly nodeId: NodeId
  readonly timeoutMs: number
}> {}

/**
 * Operation error - operation failed during execution
 */
export class OperationError extends Data.TaggedError("OperationError")<{
  readonly operationName: string
  readonly nodeId: NodeId
  readonly cause: unknown
}> {}

/**
 * Graph error - invalid graph structure
 */
export class GraphError extends Data.TaggedError("GraphError")<{
  readonly message: string
  readonly nodeId?: NodeId
}> {}

/**
 * Storage error - failed to store or retrieve results
 */
export class StorageError extends Data.TaggedError("StorageError")<{
  readonly operation: "store" | "retrieve" | "delete" | "query"
  readonly cause: unknown
}> {}

/**
 * Execution error - general execution failure
 */
export class ExecutionError extends Data.TaggedError("ExecutionError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

/**
 * Union of all possible errors
 */
export type GraphOperationError =
  | ValidationError
  | TimeoutError
  | OperationError
  | GraphError
  | StorageError
  | ExecutionError
