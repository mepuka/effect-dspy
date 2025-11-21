# Categorical Improvements: Implementation Plan

**Date**: 2025-11-21
**Goal**: Strengthen mathematical rigor and expand the categorical NLP framework

## Executive Summary

This plan addresses the gaps identified in the graduate-level review by:
1. Making the categorical structure explicit through types
2. Providing mathematical guarantees via property tests
3. Expanding the repertoire of adjoint functor pairs
4. Formalizing algebraic structures for aggregation
5. Aligning the implementation with the theory

## Priority Ranking

### P0 - Critical (Mathematical Foundation)
1. **Type the ontology** - Make category boundaries explicit
2. **Adjunction law tests** - Verify mathematical correctness

### P1 - High Impact (Theoretical Expansion)
3. **Semiring/monoid structures** - Formalize aggregation
4. **Expand free/forgetful families** - More operation pairs

### P2 - Integration (Application Layer)
5. **UI alignment** - Use categorical API
6. **Enrichment and metrics** - Add weights and context

---

## 1. Type the Ontology (P0)

### Current State
- Node payloads are `string`
- Ontological strata (doc/para/sent/token) are informal
- Category boundaries enforced by convention only

### Goal
Make the object universe explicit through a kind system.

### Design

```typescript
// src/Ontology/Kind.ts

/**
 * Textual strata in the NLP category
 * Forms a poset under the "contains" relation:
 *   Document > Paragraph > Sentence > Token > Character
 */
export type TextKind =
  | "Document"
  | "Paragraph"
  | "Sentence"
  | "Token"
  | "Character"
  | "Entity"      // NER extraction
  | "Relation"    // Dependency arc
  | "Embedding"   // Vector representation

/**
 * Typed text payload
 * Pairs content with its ontological kind
 */
export interface TypedText<K extends TextKind> {
  readonly kind: K
  readonly content: string
  readonly metadata?: Record<string, unknown>
}

/**
 * Smart constructors for each kind
 */
export const Document = (content: string): TypedText<"Document"> => ({
  kind: "Document",
  content
})

export const Sentence = (content: string): TypedText<"Sentence"> => ({
  kind: "Sentence",
  content
})

export const Token = (content: string): TypedText<"Token"> => ({
  kind: "Token",
  content
})

// ... etc for other kinds
```

### Integration with EffectGraph

```typescript
// Update GraphNode to be kind-aware
export interface GraphNode<K extends TextKind> {
  readonly id: NodeId
  readonly data: TypedText<K>
  readonly parentId: Option.Option<NodeId>
  readonly metadata: NodeMetadata & { kind: K }
}

// Update EffectGraph to track kinds
export interface EffectGraph<K extends TextKind = TextKind> {
  readonly graph: Graph.DirectedGraph<GraphNode<K>, GraphEdge>
  readonly nodeIdToIndex: HashMap.HashMap<NodeId, Graph.NodeIndex>
  readonly indexToNodeId: HashMap.HashMap<Graph.NodeIndex, NodeId>
}
```

### Benefits
- Type-level enforcement of valid transformations
- Compile-time detection of kind mismatches
- Clear documentation of operation domains/codomains
- Foundation for comonad/enrichment extensions

### Implementation Tasks
- [ ] Define `TextKind` and `TypedText<K>`
- [ ] Update `GraphNode<K>` to include kind
- [ ] Refactor operations to specify domain/codomain kinds
- [ ] Add kind-checking helpers
- [ ] Update tests to use typed nodes

---

## 2. Adjunction Law Tests (P0)

### Current State
- Adjunctions defined but not verified
- No proof of unit/counit laws
- No naturality checks

### Goal
Property-based tests ensuring adjunction coherence.

### Theory

For an adjunction `F ⊣ G` with unit `η: A → GF(A)` and counit `ε: FG(A) → A`:

**Triangle Identities**:
1. `G(ε) ∘ η_G = id_G`  (right identity)
2. `ε_F ∘ F(η) = id_F`  (left identity)

**For sentencization adjunction**:
- `F = sentencize: Text → [Sentence]`
- `G = join: [Sentence] → Text`
- `η(text) = join(sentencize(text))` (should be identity up to whitespace)
- `ε(sentences) = sentencize(join(sentences))` (should be identity up to boundaries)

### Design

```typescript
// test/Adjunction.test.ts
import { fc, test } from "@fast-check/vitest"

describe("Sentencization Adjunction Laws", () => {
  test.prop([fc.string()])(
    "unit-counit composition (right triangle)",
    async (text) => {
      // text → sentencize → join → sentencize ≈ sentencize
      const sentences1 = await sentencize(text)
      const reconstructed = join(sentences1)
      const sentences2 = await sentencize(reconstructed)

      // Up to normalization (whitespace, punctuation)
      expect(normalize(sentences1)).toEqual(normalize(sentences2))
    }
  )

  test.prop([fc.array(fc.sentence())])(
    "counit-unit composition (left triangle)",
    async (sentences) => {
      // sentences → join → sentencize ≈ sentences
      const text = join(sentences)
      const sentencesReconstructed = await sentencize(text)

      expect(normalize(sentences)).toEqual(normalize(sentencesReconstructed))
    }
  )
})
```

### Normalization Strategy

Since natural language isn't perfectly bijective, we need equivalence up to normalization:

```typescript
function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+\s*/g, '. ')
}
```

### Implementation Tasks
- [ ] Add `@fast-check/vitest` dependency
- [ ] Implement normalization functions
- [ ] Write property tests for sentencization adjunction
- [ ] Write property tests for tokenization adjunction
- [ ] Add tests for naturality (if time permits)

---

## 3. Semiring/Monoid Structures (P1)

### Current State
- Aggregation operations are ad hoc
- No declared algebraic structure
- Unclear when `join` is the "right" aggregation

### Goal
Explicit monoid/semiring structures for aggregation targets.

### Theory

A **monoid** is `(M, ⊕, 0)` where:
- `⊕: M × M → M` is associative
- `0` is the identity: `0 ⊕ x = x = x ⊕ 0`

A **semiring** is `(M, ⊕, ⊗, 0, 1)` with two monoids linked by distributivity.

### Design

```typescript
// src/Algebra/Monoid.ts

/**
 * Monoid type class
 */
export interface Monoid<A> {
  readonly empty: A
  readonly combine: (x: A, y: A) => A
}

/**
 * String concatenation monoid
 */
export const StringConcat: Monoid<string> = {
  empty: "",
  combine: (x, y) => x + y
}

/**
 * String join with separator monoid
 */
export const StringJoin = (sep: string): Monoid<string> => ({
  empty: "",
  combine: (x, y) => x === "" ? y : y === "" ? x : `${x}${sep}${y}`
})

/**
 * Multiset union monoid (for bag-of-words)
 */
export const MultiSet = <A>(): Monoid<HashMap.HashMap<A, number>> => ({
  empty: HashMap.empty(),
  combine: (x, y) => HashMap.union(x, y, (a, b) => a + b)
})

/**
 * Vector addition monoid (for embeddings)
 */
export const VectorAdd = (dim: number): Monoid<ReadonlyArray<number>> => ({
  empty: Array(dim).fill(0),
  combine: (x, y) => x.map((xi, i) => xi + y[i]!)
})
```

### Forgetful Operations with Monoid Structure

```typescript
// Update ForgetfulOperation to specify its monoid
export interface ForgetfulOperation<A, B, R = never, E = never> {
  readonly name: string
  readonly monoid: Monoid<B>  // NEW: Declare algebraic structure
  readonly apply: (
    nodes: ReadonlyArray<GraphNode<A>>
  ) => Effect.Effect<GraphNode<B>, E, R>
}

// Derive apply from monoid
export const forgetfulFromMonoid = <A, B>(
  name: string,
  monoid: Monoid<B>,
  extract: (node: GraphNode<A>) => B
): ForgetfulOperation<A, B, never, never> => ({
  name,
  monoid,
  apply: (nodes) => {
    const combined = nodes
      .map(extract)
      .reduce(monoid.combine, monoid.empty)

    return Effect.succeed(
      EG.makeNode(
        combined,
        nodes[0] ? Option.some(nodes[0].id) : Option.none(),
        Option.some(name)
      )
    )
  }
})
```

### Benefits
- Mathematical guarantee of correctness
- Generic fold operations
- Clear semantics for aggregation
- Foundation for parallel/distributed processing

### Implementation Tasks
- [ ] Define `Monoid<A>` type class
- [ ] Implement standard monoids (String, MultiSet, Vector)
- [ ] Update `ForgetfulOperation` to declare monoid
- [ ] Refactor `join`/`concat` to use monoid structure
- [ ] Add property tests for monoid laws

---

## 4. Expand Free/Forgetful Families (P1)

### Current State
- Only sentencization and tokenization adjunctions
- No multi-level expansions
- No semantic extractions

### Goal
Rich library of adjoint functor pairs covering the NLP spectrum.

### Proposed Operations

#### 4.1 Paragraphization Adjunction

```typescript
// Free: Document → [Paragraph]
export const paragraphizeOperation: FreeOperation<
  TypedText<"Document">,
  TypedText<"Paragraph">
> = ...

// Forgetful: [Paragraph] → Document
export const paragraphJoinOperation: ForgetfulOperation<
  TypedText<"Paragraph">,
  TypedText<"Document">
> = forgetfulFromMonoid(
  "paragraph-join",
  StringJoin("\n\n"),
  (node) => node.data.content
)

export const paragraphizationAdjunction = makeAdjunction(
  paragraphizeOperation,
  paragraphJoinOperation
)
```

#### 4.2 Character Adjunction

```typescript
// Free: Token → [Character]
export const characterizeOperation: FreeOperation<
  TypedText<"Token">,
  TypedText<"Character">
> = ...

// Forgetful: [Character] → Token
export const characterJoinOperation: ForgetfulOperation<
  TypedText<"Character">,
  TypedText<"Token">
> = forgetfulFromMonoid(
  "char-join",
  StringConcat,
  (node) => node.data.content
)
```

#### 4.3 Entity Extraction Adjunction

```typescript
// Free: Sentence → [Entity]
// Uses NER to extract named entities
export const extractEntitiesOperation: FreeOperation<
  TypedText<"Sentence">,
  TypedText<"Entity">,
  NLPService
> = ...

// Forgetful: [Entity] → Sentence
// Reconstitute sentence from entity mentions
export const entitiesBackToSentence: ForgetfulOperation<
  TypedText<"Entity">,
  TypedText<"Sentence">
> = ...
```

#### 4.4 Dependency Tree Adjunction

```typescript
// Free: Sentence → DependencyTree
// Parse to dependency structure
export const parseDependenciesOperation: FreeOperation<
  TypedText<"Sentence">,
  DependencyTree
> = ...

// Forgetful: DependencyTree → Sentence
// Linearize tree back to sentence
export const linearizeDependencies: ForgetfulOperation<
  DependencyTree,
  TypedText<"Sentence">
> = ...
```

#### 4.5 Embedding Projection Adjunction

```typescript
// Free: Token → Embedding
// Project to vector space
export const embedOperation: FreeOperation<
  TypedText<"Token">,
  TypedText<"Embedding">,
  EmbeddingService
> = ...

// Forgetful: Embedding → Token
// Nearest neighbor decode
export const decodeEmbedding: ForgetfulOperation<
  TypedText<"Embedding">,
  TypedText<"Token">,
  EmbeddingService
> = ...
```

### Implementation Tasks
- [ ] Implement paragraphization adjunction
- [ ] Implement character adjunction
- [ ] Implement entity extraction (requires NER)
- [ ] Implement dependency parsing (requires parser)
- [ ] Implement embedding projection (requires embeddings)
- [ ] Write tests for each adjunction
- [ ] Document categorical properties

---

## 5. Align UI with Theory (P2)

### Current State
- Web UI uses `simpleSentencize`/`simpleTokenize`
- Bypasses the `TextOperation` abstraction
- Users can't see both sides of adjunctions

### Goal
Drive the workbench through categorical API, exposing expand/aggregate duality.

### Design

#### 5.1 Operation Palette

```typescript
// web/src/components/OperationPalette.tsx

type OperationCard = {
  name: string
  category: "free" | "forgetful"
  description: string
  operation: TextOperation<any, any> | ForgetfulOperation<any, any>
}

const operations: OperationCard[] = [
  {
    name: "Sentencize",
    category: "free",
    description: "Expand text into sentences",
    operation: sentencizeOperation
  },
  {
    name: "Join Sentences",
    category: "forgetful",
    description: "Aggregate sentences back to text",
    operation: joinOperation(" ")
  },
  // ... etc
]
```

#### 5.2 Adjunction Visualization

```typescript
// web/src/components/AdjunctionView.tsx

// Show unit: text → join(sentencize(text))
// Show counit: sentencize(join(sentences)) → sentences
// Visualize triangle identities
```

#### 5.3 Replace Graph Operations

```typescript
// web/src/state/graphOperations.ts

// Replace simpleTokenize with:
export const executeOperationMutation = atomRuntime.fn(
  (params: {
    text: string
    operation: TextOperation<string, string, NLPService>
  }) => Effect.gen(function*() {
    const graph = EG.singleton(params.text)
    const newGraph = yield* TC.executeOperation(graph, params.operation)
    yield* Atom.set(graphAtom, newGraph)
  }).pipe(Effect.provide(NLPService.Live))
)
```

### Benefits
- Users experience the categorical structure
- Live demonstration of adjunction properties
- Educational value for theory/practice alignment

### Implementation Tasks
- [ ] Create OperationPalette component
- [ ] Refactor graphOperations to use TextOperation API
- [ ] Add expand/aggregate toggle
- [ ] Visualize unit/counit compositions
- [ ] Add tutorial explaining adjunctions

---

## 6. Enrichment and Metrics (P2)

### Current State
- Edges have no weights
- Nodes lack metrics
- No support for probabilistic/weighted operations

### Goal
Enrich the category with metrics for optimization and enriched folds.

### Theory

An **enriched category** replaces hom-sets with objects from a monoidal category `(V, ⊗, I)`.

For NLP:
- `V = ℝ⁺` (non-negative reals with addition)
- Edge weight = confidence, cost, or probability
- Enriched composition: add weights along paths

### Design

```typescript
// src/EffectGraph.ts

export interface GraphEdge {
  readonly relation: "child" | "derived" | "similar"
  readonly weight: number  // NEW: Edge weight
  readonly confidence?: number  // Confidence score
  readonly timestamp?: number  // Temporal ordering
}

export interface EnrichedMetadata extends NodeMetadata {
  readonly cost: number  // Processing cost
  readonly confidence: number  // Confidence in extraction
  readonly embedding?: ReadonlyArray<number>  // Vector representation
}
```

#### Enriched Operations

```typescript
// Operations produce confidence-weighted results
export interface EnrichedOperation<A, B, R = never, E = never> {
  readonly name: string
  readonly apply: (
    node: GraphNode<A>
  ) => Effect.Effect<
    ReadonlyArray<{ node: GraphNode<B>; confidence: number }>,
    E,
    R
  >
}
```

#### Weighted Aggregation

```typescript
// Aggregate with confidence weighting
export const weightedJoin = (
  separator: string
): ForgetfulOperation<string, string> => ({
  name: "weighted-join",
  monoid: StringJoin(separator),
  apply: (nodes) => {
    const weighted = nodes
      .map((n) => ({
        text: n.data,
        weight: n.metadata.confidence ?? 1.0
      }))
      .sort((a, b) => b.weight - a.weight)
      .map((x) => x.text)
      .join(separator)

    return Effect.succeed(EG.makeNode(weighted, ...))
  }
})
```

### Benefits
- Support for fuzzy/probabilistic NLP
- Optimal path finding in graph
- Confidence-based pruning
- Foundation for neural/vector operations

### Implementation Tasks
- [ ] Add `weight` field to `GraphEdge`
- [ ] Add enriched metadata to `GraphNode`
- [ ] Implement weighted aggregation operations
- [ ] Add path optimization algorithms
- [ ] Integrate with embedding operations

---

## Testing Strategy

### Unit Tests (Vitest)
- Type-level tests for kind system
- Monoid law verification
- Operation composition

### Property Tests (@fast-check/vitest)
- Adjunction triangle identities
- Monoid associativity/identity
- Functor composition laws

### Integration Tests
- End-to-end pipelines
- Multi-level transformations
- UI operation execution

---

## Migration Path

### Phase 1: Foundation (Week 1)
1. Add kind system types
2. Implement monoid structures
3. Write adjunction law tests

### Phase 2: Expansion (Week 2)
4. Expand operation families
5. Refactor existing operations to use new types

### Phase 3: Integration (Week 3)
6. Update UI to use categorical API
7. Add enrichment support
8. Documentation and examples

---

## Success Metrics

### Mathematical Rigor
- [ ] All adjunctions have verified triangle identities
- [ ] All aggregations declare their monoid structure
- [ ] Kind system enforces valid transformations

### Theoretical Coverage
- [ ] 5+ adjoint functor pairs implemented
- [ ] Support for at least 6 text kinds
- [ ] Enriched category with weighted edges

### User Experience
- [ ] UI exposes both sides of adjunctions
- [ ] Interactive demonstration of unit/counit
- [ ] Clear documentation with category theory background

---

## References

### Category Theory
- Awodey, S. (2010). *Category Theory* (2nd ed.)
- Mac Lane, S. (1978). *Categories for the Working Mathematician*
- Riehl, E. (2017). *Category Theory in Context*

### Effect-TS
- Effect documentation: https://effect.website/
- Effect GitHub: https://github.com/Effect-TS/effect

### NLP + Category Theory
- Coecke, B., et al. (2010). "Mathematical Foundations for a Compositional Distributional Model of Meaning"
- Bolt, J., et al. (2017). "Interacting Conceptual Spaces"

---

## Appendix: Type Signatures

### Before (Current)
```typescript
type GraphNode<A> = { data: A, ... }
type TextOperation<A, B> = (node: GraphNode<A>) => Effect<[GraphNode<B>]>
```

### After (With Kinds)
```typescript
type GraphNode<K extends TextKind> = {
  data: TypedText<K>,
  metadata: { kind: K, ... }
}
type TextOperation<K1, K2> = (
  node: GraphNode<K1>
) => Effect<[GraphNode<K2>]>

// Example: Sentencize must go from Document/Sentence to Sentence
const sentencize: TextOperation<"Document" | "Sentence", "Sentence">
```

This ensures type-level guarantees about valid transformations in the category.
