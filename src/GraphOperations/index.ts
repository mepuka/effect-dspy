/**
 * GraphOperations - Core graph operations engine
 *
 * This module provides the foundation for executing operations on graphs:
 * - GraphOperation: Core operation abstraction
 * - GraphExecutor: Execution engine with strategies
 * - ResultStore: Result caching
 * - Error types: Comprehensive error handling
 *
 * Mathematical foundations:
 * - Operations are morphisms in the category of graphs
 * - Execution follows categorical composition laws
 * - Caching preserves idempotence
 */

// Core types
export * from "./Types.js"
export * from "./Errors.js"

// Operation abstraction
export * from "./Operation.js"

// Execution engine
export * from "./Executor.js"

// Result storage
export * from "./ResultStore.js"
