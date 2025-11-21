/**
 * WinkBackend - Lightweight NLP backend using wink-nlp
 *
 * This backend uses wink-eng-lite-web-model for browser-compatible,
 * lightweight NLP operations. It supports:
 * - Tokenization
 * - Sentencization
 * - POS tagging
 * - Lemmatization
 * - Basic NER (limited)
 *
 * Does NOT support:
 * - Dependency parsing
 * - Relation extraction
 * - Coreference resolution
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import model from "wink-eng-lite-web-model"
import winkNLP from "wink-nlp"
import * as Backend from "../NLPBackend.js"
import * as S from "../Schema.js"

// =============================================================================
// Wink NLP Types
// =============================================================================

interface WinkDocument {
  sentences(): WinkCollection
  tokens(): WinkCollection
  out(): string
}

interface WinkCollection {
  out(): Array<string>
  length(): number
  each(fn: (item: any) => void): void
  itemAt(index: number): any
}

interface WinkNLPInstance {
  readDoc(text: string): WinkDocument
}

// =============================================================================
// Wink Backend Implementation
// =============================================================================

// Cache wink instance to avoid repeatedly loading large model
let cachedNlp: WinkNLPInstance | null = null

const getNlpInstance = (): WinkNLPInstance => {
  if (cachedNlp) return cachedNlp
  cachedNlp = winkNLP(model) as WinkNLPInstance
  return cachedNlp
}

/**
 * Create WinkBackend implementation
 */
const makeWinkBackend = Effect.sync(() => {
  const nlp = getNlpInstance()

  // =========================================================================
  // Core Operations
  // =========================================================================

  const tokenizeImpl = (text: string): ReadonlyArray<string> => {
    if (text.trim() === "") return []
    const doc = nlp.readDoc(text)
    return doc.tokens().out()
  }

  const sentencizeImpl = (text: string): ReadonlyArray<string> => {
    if (text.trim() === "") return []
    const doc = nlp.readDoc(text)
    return doc.sentences().out()
  }

  // =========================================================================
  // Linguistic Annotation Operations
  // =========================================================================

  const posTagImpl = (text: string): ReadonlyArray<S.POSNode> => {
    if (text.trim() === "") return []

    const doc = nlp.readDoc(text)
    const tokens = doc.tokens()
    const result: Array<S.POSNode> = []

    let index = 0
    tokens.each((token: any) => {
      result.push(
        new S.POSNode({
          text: token.out(),
          tag: token.out("pos") || "UNKNOWN",
          description: token.out("detail"),
          position: index,
          timestamp: Date.now()
        })
      )
      index++
    })

    return result
  }

  const lemmatizeImpl = (text: string): ReadonlyArray<S.LemmaNode> => {
    if (text.trim() === "") return []

    const doc = nlp.readDoc(text)
    const tokens = doc.tokens()
    const result: Array<S.LemmaNode> = []

    let index = 0
    tokens.each((token: any) => {
      const tokenText = token.out()
      const lemma = token.out("lemma") || tokenText // Fallback to original
      const pos = token.out("pos")

      result.push(
        new S.LemmaNode({
          token: tokenText,
          lemma,
          pos,
          position: index,
          timestamp: Date.now()
        })
      )
      index++
    })

    return result
  }

  const extractEntitiesImpl = (text: string): ReadonlyArray<S.EntityNode> => {
    if (text.trim() === "") return []

    // Wink NLP lite doesn't support full NER
    // Use simple heuristic: capitalized words might be entities
    const result: Array<S.EntityNode> = []
    const words = text.split(/\s+/)
    let charOffset = 0

    for (const word of words) {
      if (word.length > 0 && /^[A-Z]/.test(word)) {
        const cleanWord = word.replace(/[^\w]/g, "")
        if (cleanWord.length > 2) {
          const start = text.indexOf(word, charOffset)
          const end = start + word.length

          result.push(
            new S.EntityNode({
              text: cleanWord,
              entityType: "UNKNOWN", // Real NER would classify as PERSON, ORG, etc.
              span: { start, end },
              timestamp: Date.now()
            })
          )
        }
      }
      charOffset += word.length + 1
    }

    return result
  }

  // =========================================================================
  // Backend Interface Implementation
  // =========================================================================

  return {
    name: "wink-nlp",

    capabilities: {
      tokenization: true,
      sentencization: true,
      posTagging: true,
      lemmatization: true,
      ner: true, // Limited - basic heuristics only
      dependencyParsing: false,
      relationExtraction: false,
      coreferenceResolution: false,
      constituencyParsing: false
    },

    // Core operations
    tokenize: (text: string) =>
      Effect.try({
        try: () => tokenizeImpl(text),
        catch: (error) => Backend.operationError("wink-nlp", "tokenize", error)
      }),

    sentencize: (text: string) =>
      Effect.try({
        try: () => sentencizeImpl(text),
        catch: (error) => Backend.operationError("wink-nlp", "sentencize", error)
      }),

    // Linguistic annotations
    posTag: (text: string) =>
      Effect.try({
        try: () => posTagImpl(text),
        catch: (error) => Backend.operationError("wink-nlp", "posTag", error)
      }),

    lemmatize: (text: string) =>
      Effect.try({
        try: () => lemmatizeImpl(text),
        catch: (error) => Backend.operationError("wink-nlp", "lemmatize", error)
      }),

    extractEntities: (text: string) =>
      Effect.try({
        try: () => extractEntitiesImpl(text),
        catch: (error) => Backend.operationError("wink-nlp", "extractEntities", error)
      }),

    // Advanced operations - not supported
    parseDependencies: (_sentence: string) =>
      Effect.fail(
        Backend.notSupported(
          "wink-nlp",
          "parseDependencies",
          "Wink NLP lite does not support dependency parsing. Use Stanford CoreNLP or spaCy instead."
        )
      ),

    extractRelations: (_text: string) =>
      Effect.fail(
        Backend.notSupported(
          "wink-nlp",
          "extractRelations",
          "Wink NLP lite does not support relation extraction."
        )
      )
  } satisfies Backend.NLPBackend
})

/**
 * Live layer for WinkBackend
 */
export const WinkBackendLive: Layer.Layer<Backend.NLPBackend, Backend.BackendInitError, never> =
  Layer.effect(
    Backend.NLPBackend,
    makeWinkBackend.pipe(
      Effect.mapError((error) => Backend.initError("wink-nlp", error))
    )
  )
