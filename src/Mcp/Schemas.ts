/**
 * MCP Tool Schemas
 *
 * Effect Schema definitions for MCP tool inputs and outputs.
 * These schemas define the contract for NLP tool interactions.
 */

import * as Schema from "effect/Schema"
import * as JSONSchema from "effect/JSONSchema"

// =============================================================================
// Common Input Schemas
// =============================================================================

/**
 * Basic text input for most NLP operations
 */
export class TextInput extends Schema.Class<TextInput>("TextInput")({
  text: Schema.String.pipe(Schema.minLength(1))
}) {}

/**
 * N-gram extraction input
 */
export class NgramInput extends Schema.Class<NgramInput>("NgramInput")({
  text: Schema.String.pipe(Schema.minLength(1)),
  n: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0), Schema.lessThanOrEqualTo(10))
}) {}

/**
 * Tokens input for operations that work on token arrays
 */
export class TokensInput extends Schema.Class<TokensInput>("TokensInput")({
  tokens: Schema.Array(Schema.String)
}) {}

/**
 * String similarity input
 */
export class SimilarityInput extends Schema.Class<SimilarityInput>("SimilarityInput")({
  text1: Schema.String,
  text2: Schema.String
}) {}

/**
 * Text normalization pipeline options
 */
export class NormalizeInput extends Schema.Class<NormalizeInput>("NormalizeInput")({
  text: Schema.String,
  options: Schema.optional(
    Schema.Struct({
      removeWhitespace: Schema.optional(Schema.Boolean),
      removePunctuation: Schema.optional(Schema.Boolean),
      lowercase: Schema.optional(Schema.Boolean)
    })
  )
}) {}

/**
 * Full NLP analysis input with options
 */
export class AnalyzeInput extends Schema.Class<AnalyzeInput>("AnalyzeInput")({
  text: Schema.String.pipe(Schema.minLength(1)),
  options: Schema.optional(
    Schema.Struct({
      sentences: Schema.optional(Schema.Boolean),
      tokens: Schema.optional(Schema.Boolean),
      pos: Schema.optional(Schema.Boolean),
      lemmas: Schema.optional(Schema.Boolean),
      entities: Schema.optional(Schema.Boolean),
      ngrams: Schema.optional(Schema.Number)
    })
  )
}) {}

// =============================================================================
// Output Schemas
// =============================================================================

/**
 * Generic text array output
 */
export class TextArrayOutput extends Schema.Class<TextArrayOutput>("TextArrayOutput")({
  result: Schema.Array(Schema.String),
  count: Schema.Number
}) {}

/**
 * Single text output
 */
export class TextOutput extends Schema.Class<TextOutput>("TextOutput")({
  result: Schema.String
}) {}

/**
 * Number output
 */
export class NumberOutput extends Schema.Class<NumberOutput>("NumberOutput")({
  result: Schema.Number
}) {}

/**
 * POS tagging output
 */
export class POSOutput extends Schema.Class<POSOutput>("POSOutput")({
  result: Schema.Array(
    Schema.Struct({
      text: Schema.String,
      tag: Schema.String,
      description: Schema.optional(Schema.String),
      position: Schema.Number
    })
  ),
  count: Schema.Number
}) {}

/**
 * Entity extraction output
 */
export class EntityOutput extends Schema.Class<EntityOutput>("EntityOutput")({
  result: Schema.Array(
    Schema.Struct({
      text: Schema.String,
      entityType: Schema.String,
      span: Schema.Struct({
        start: Schema.Number,
        end: Schema.Number
      }),
      confidence: Schema.optional(Schema.Number)
    })
  ),
  count: Schema.Number
}) {}

/**
 * Lemmatization output
 */
export class LemmaOutput extends Schema.Class<LemmaOutput>("LemmaOutput")({
  result: Schema.Array(
    Schema.Struct({
      token: Schema.String,
      lemma: Schema.String,
      pos: Schema.optional(Schema.String),
      position: Schema.Number
    })
  ),
  count: Schema.Number
}) {}

/**
 * Bag of words output
 */
export class BagOfWordsOutput extends Schema.Class<BagOfWordsOutput>("BagOfWordsOutput")({
  result: Schema.Record({ key: Schema.String, value: Schema.Number }),
  uniqueTerms: Schema.Number,
  totalTerms: Schema.Number
}) {}

/**
 * Full NLP analysis output
 */
export class AnalysisOutput extends Schema.Class<AnalysisOutput>("AnalysisOutput")({
  text: Schema.String,
  sentences: Schema.optional(Schema.Array(Schema.String)),
  tokens: Schema.optional(Schema.Array(Schema.String)),
  pos: Schema.optional(
    Schema.Array(
      Schema.Struct({
        text: Schema.String,
        tag: Schema.String,
        position: Schema.Number
      })
    )
  ),
  lemmas: Schema.optional(
    Schema.Array(
      Schema.Struct({
        token: Schema.String,
        lemma: Schema.String,
        position: Schema.Number
      })
    )
  ),
  entities: Schema.optional(
    Schema.Array(
      Schema.Struct({
        text: Schema.String,
        entityType: Schema.String,
        span: Schema.Struct({
          start: Schema.Number,
          end: Schema.Number
        })
      })
    )
  ),
  ngrams: Schema.optional(Schema.Array(Schema.String)),
  wordCount: Schema.Number
}) {}

// =============================================================================
// Graph Schemas
// =============================================================================

/**
 * Graph creation input
 */
export class GraphCreateInput extends Schema.Class<GraphCreateInput>("GraphCreateInput")({
  text: Schema.String.pipe(Schema.minLength(1)),
  operations: Schema.optional(
    Schema.Array(
      Schema.Literal("sentencize", "tokenize", "posTag", "lemmatize", "entities")
    )
  )
}) {}

/**
 * Graph node output (simplified for MCP)
 */
export class GraphNodeOutput extends Schema.Class<GraphNodeOutput>("GraphNodeOutput")({
  id: Schema.String,
  data: Schema.Unknown,
  parentId: Schema.optional(Schema.String),
  operation: Schema.optional(Schema.String)
}) {}

/**
 * Graph output
 */
export class GraphOutput extends Schema.Class<GraphOutput>("GraphOutput")({
  nodes: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      data: Schema.Unknown,
      parentId: Schema.optional(Schema.String),
      operation: Schema.optional(Schema.String)
    })
  ),
  rootIds: Schema.Array(Schema.String),
  nodeCount: Schema.Number
}) {}

// =============================================================================
// Error Schema
// =============================================================================

/**
 * MCP error output
 */
export class McpError extends Schema.Class<McpError>("McpError")({
  code: Schema.String,
  message: Schema.String,
  details: Schema.optional(Schema.Unknown)
}) {}

// =============================================================================
// JSON Schema Exports (for MCP tool definitions)
// =============================================================================

/**
 * Convert Effect Schema to JSON Schema for MCP tool registration
 */
export const toJsonSchema = <A, I, R>(schema: Schema.Schema<A, I, R>): object => {
  return JSONSchema.make(schema) as object
}
