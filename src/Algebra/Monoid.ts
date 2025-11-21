/**
 * Algebra/Monoid - Algebraic structures for aggregation operations
 *
 * This module defines monoids and their laws, providing a mathematical
 * foundation for aggregation operations in the categorical NLP framework.
 *
 * A Monoid is an algebraic structure (M, ⊕, ∅) where:
 * - M is a set (the carrier type)
 * - ⊕ : M × M → M is an associative binary operation (combine)
 * - ∅ ∈ M is the identity element (empty)
 *
 * Laws:
 * 1. Associativity: (x ⊕ y) ⊕ z = x ⊕ (y ⊕ z)
 * 2. Left identity: ∅ ⊕ x = x
 * 3. Right identity: x ⊕ ∅ = x
 *
 * Category theory: Monoids can be viewed as categories with a single object,
 * where morphisms are elements of the monoid and composition is the monoid operation.
 *
 * For forgetful functors: The monoid structure determines how multiple nodes
 * are aggregated into a single parent node.
 */

import * as HashMap from "effect/HashMap"
import * as Equal from "effect/Equal"
import * as Hash from "effect/Hash"

// =============================================================================
// Core Monoid Type Class
// =============================================================================

/**
 * Monoid type class
 *
 * A monoid is an algebraic structure with:
 * - An identity element (empty)
 * - An associative binary operation (combine)
 *
 * @typeParam A - The carrier type
 */
export interface Monoid<A> {
  /**
   * The identity element
   * Must satisfy: combine(empty, x) = x = combine(x, empty)
   */
  readonly empty: A

  /**
   * Associative binary operation
   * Must satisfy: combine(combine(x, y), z) = combine(x, combine(y, z))
   */
  readonly combine: (x: A, y: A) => A
}

/**
 * Helper to create a Monoid instance
 */
export const make = <A>(empty: A, combine: (x: A, y: A) => A): Monoid<A> => ({
  empty,
  combine
})

/**
 * Fold a collection using a monoid
 * This is the fundamental aggregation operation.
 *
 * Category theory: This is a catamorphism from the list functor to the monoid.
 */
export const fold = <A>(monoid: Monoid<A>) => (values: Iterable<A>): A => {
  let result = monoid.empty
  for (const value of values) {
    result = monoid.combine(result, value)
  }
  return result
}

/**
 * Combine a non-empty collection
 * Returns None if the collection is empty
 */
export const combineAll = <A>(monoid: Monoid<A>) => (
  values: ReadonlyArray<A>
): A => values.reduce(monoid.combine, monoid.empty)

// =============================================================================
// String Monoids
// =============================================================================

/**
 * String concatenation monoid
 *
 * - Empty: ""
 * - Combine: (x, y) => x + y
 *
 * Example:
 *   fold(StringConcat)(["Hello", " ", "world"]) // "Hello world"
 */
export const StringConcat: Monoid<string> = {
  empty: "",
  combine: (x, y) => x + y
}

/**
 * String join with separator monoid
 *
 * Combines strings with a separator, intelligently handling empty strings.
 *
 * - Empty: ""
 * - Combine: intelligently joins with separator (skipping empties)
 *
 * Example:
 *   fold(StringJoin(" "))(["Hello", "world"]) // "Hello world"
 *   fold(StringJoin(", "))(["Alice", "Bob", "Carol"]) // "Alice, Bob, Carol"
 */
export const StringJoin = (separator: string): Monoid<string> => ({
  empty: "",
  combine: (x, y) => {
    if (x === "") return y
    if (y === "") return x
    return `${x}${separator}${y}`
  }
})

/**
 * String join with prefix and suffix
 * Useful for creating delimited lists.
 *
 * Example:
 *   fold(StringDelimited("[", "]", ", "))(["a", "b", "c"]) // "[a, b, c]"
 */
export const StringDelimited = (
  prefix: string,
  suffix: string,
  separator: string
): Monoid<string> => ({
  empty: "",
  combine: (x, y) => {
    if (x === "" && y === "") return ""
    if (x === "") return `${prefix}${y}${suffix}`
    if (y === "") return `${prefix}${x}${suffix}`
    const inner = `${x.slice(prefix.length, -suffix.length)}${separator}${y.slice(prefix.length, -suffix.length)}`
    return `${prefix}${inner}${suffix}`
  }
})

// =============================================================================
// Numeric Monoids
// =============================================================================

/**
 * Addition monoid for numbers
 *
 * - Empty: 0
 * - Combine: (x, y) => x + y
 */
export const NumberSum: Monoid<number> = {
  empty: 0,
  combine: (x, y) => x + y
}

/**
 * Multiplication monoid for numbers
 *
 * - Empty: 1
 * - Combine: (x, y) => x * y
 */
export const NumberProduct: Monoid<number> = {
  empty: 1,
  combine: (x, y) => x * y
}

/**
 * Max monoid for numbers
 *
 * - Empty: -Infinity
 * - Combine: Math.max
 */
export const NumberMax: Monoid<number> = {
  empty: -Infinity,
  combine: Math.max
}

/**
 * Min monoid for numbers
 *
 * - Empty: Infinity
 * - Combine: Math.min
 */
export const NumberMin: Monoid<number> = {
  empty: Infinity,
  combine: Math.min
}

// =============================================================================
// Array Monoids
// =============================================================================

/**
 * Array concatenation monoid
 *
 * - Empty: []
 * - Combine: (x, y) => [...x, ...y]
 */
export const ArrayConcat = <A>(): Monoid<ReadonlyArray<A>> => ({
  empty: [],
  combine: (x, y) => [...x, ...y]
})

// =============================================================================
// Collection Monoids (Bag-of-Words, Multisets)
// =============================================================================

/**
 * Multiset (bag) union monoid
 *
 * A multiset is a collection where elements can appear multiple times.
 * Union adds the multiplicities.
 *
 * - Empty: {}
 * - Combine: Union with multiplicity addition
 *
 * Example (bag-of-words):
 *   const bag1 = HashMap.fromIterable([["the", 2], ["cat", 1]])
 *   const bag2 = HashMap.fromIterable([["the", 1], ["dog", 1]])
 *   combine(bag1, bag2) // { "the": 3, "cat": 1, "dog": 1 }
 */
export const MultiSet = <K>(): Monoid<HashMap.HashMap<K, number>> => ({
  empty: HashMap.empty(),
  combine: (x, y) =>
    HashMap.reduceWithIndex(y, x, (map, count, key) =>
      HashMap.modifyAt(map, key, (existing) => (existing ?? 0) + count)
    )
})

/**
 * Set union monoid
 *
 * - Empty: {}
 * - Combine: Set union
 */
export const SetUnion = <A>(): Monoid<Set<A>> => ({
  empty: new Set(),
  combine: (x, y) => new Set([...x, ...y])
})

/**
 * Set intersection monoid
 *
 * Note: This is NOT a true monoid because there's no universal identity element.
 * We use a convention where empty represents the "universal set".
 *
 * Only use when you know all elements come from a finite universe.
 */
export const SetIntersection = <A>(): Monoid<Set<A> | null> => ({
  empty: null, // Represents universal set
  combine: (x, y) => {
    if (x === null) return y
    if (y === null) return x
    const result = new Set<A>()
    for (const elem of x) {
      if (y.has(elem)) result.add(elem)
    }
    return result
  }
})

// =============================================================================
// Vector Monoids (for embeddings)
// =============================================================================

/**
 * Vector addition monoid
 *
 * Adds vectors element-wise. Useful for combining embeddings.
 *
 * - Empty: [0, 0, ..., 0]
 * - Combine: Element-wise addition
 *
 * Example:
 *   combine([1, 2, 3], [4, 5, 6]) // [5, 7, 9]
 */
export const VectorAdd = (dimension: number): Monoid<ReadonlyArray<number>> => ({
  empty: Array(dimension).fill(0),
  combine: (x, y) => x.map((xi, i) => xi + (y[i] ?? 0))
})

/**
 * Vector average monoid (with count tracking)
 *
 * Tracks both sum and count to compute running average.
 *
 * Example:
 *   For computing average embedding of multiple words
 */
export const VectorAverage = (
  dimension: number
): Monoid<{ sum: ReadonlyArray<number>; count: number }> => ({
  empty: { sum: Array(dimension).fill(0), count: 0 },
  combine: (x, y) => ({
    sum: x.sum.map((xi, i) => xi + (y.sum[i] ?? 0)),
    count: x.count + y.count
  })
})

/**
 * Extract the average from VectorAverage result
 */
export const getAverage = (result: {
  sum: ReadonlyArray<number>
  count: number
}): ReadonlyArray<number> => (result.count === 0 ? result.sum : result.sum.map((x) => x / result.count))

// =============================================================================
// Tuple Monoids (Product)
// =============================================================================

/**
 * Product monoid: Combine two monoids component-wise
 *
 * If (A, ⊕, ∅_A) and (B, ⊗, ∅_B) are monoids, then
 * (A × B, (⊕, ⊗), (∅_A, ∅_B)) is also a monoid.
 *
 * Example:
 *   Combine word count and character count:
 *   Product(NumberSum, NumberSum)
 */
export const Product = <A, B>(
  ma: Monoid<A>,
  mb: Monoid<B>
): Monoid<readonly [A, B]> => ({
  empty: [ma.empty, mb.empty],
  combine: ([xa, xb], [ya, yb]) => [ma.combine(xa, ya), mb.combine(xb, yb)]
})

/**
 * Triple product monoid
 */
export const Product3 = <A, B, C>(
  ma: Monoid<A>,
  mb: Monoid<B>,
  mc: Monoid<C>
): Monoid<readonly [A, B, C]> => ({
  empty: [ma.empty, mb.empty, mc.empty],
  combine: ([xa, xb, xc], [ya, yb, yc]) => [
    ma.combine(xa, ya),
    mb.combine(xb, yb),
    mc.combine(xc, yc)
  ]
})

// =============================================================================
// Functor Monoids
// =============================================================================

/**
 * Lift a monoid through a functor
 *
 * If we have Monoid<A>, we can create Monoid<F<A>> for any functor F,
 * by applying the monoid operation point-wise.
 *
 * Example: Monoid<Option<number>> from Monoid<number>
 */
export const Option = <A>(monoid: Monoid<A>): Monoid<A | undefined> => ({
  empty: undefined,
  combine: (x, y) => {
    if (x === undefined) return y
    if (y === undefined) return x
    return monoid.combine(x, y)
  }
})

// =============================================================================
// Endomorphism Monoid
// =============================================================================

/**
 * Endomorphism monoid: Functions from A to A
 *
 * - Empty: identity function
 * - Combine: function composition
 *
 * This is useful for composing transformations.
 *
 * Example:
 *   const normalize = StringJoin(" ")
 *   const lowercase = (s: string) => s.toLowerCase()
 *   const trim = (s: string) => s.trim()
 *   const pipeline = combineAll(Endo<string>())([normalize, lowercase, trim])
 */
export const Endo = <A>(): Monoid<(a: A) => A> => ({
  empty: (a) => a,
  combine: (f, g) => (a) => f(g(a))
})

// =============================================================================
// Dual Monoid
// =============================================================================

/**
 * Dual monoid: Reverse the order of combination
 *
 * If (M, ⊕, ∅) is a monoid, then (M, ⊕', ∅) is also a monoid where
 * x ⊕' y = y ⊕ x
 *
 * Example:
 *   Dual(StringConcat) combines strings right-to-left instead of left-to-right
 */
export const Dual = <A>(monoid: Monoid<A>): Monoid<A> => ({
  empty: monoid.empty,
  combine: (x, y) => monoid.combine(y, x)
})

// =============================================================================
// Boolean Monoids
// =============================================================================

/**
 * Logical AND monoid
 *
 * - Empty: true
 * - Combine: (x, y) => x && y
 */
export const BooleanAll: Monoid<boolean> = {
  empty: true,
  combine: (x, y) => x && y
}

/**
 * Logical OR monoid
 *
 * - Empty: false
 * - Combine: (x, y) => x || y
 */
export const BooleanAny: Monoid<boolean> = {
  empty: false,
  combine: (x, y) => x || y
}

// =============================================================================
// Monoid Laws (for testing)
// =============================================================================

/**
 * Check left identity law: empty ⊕ x = x
 */
export const checkLeftIdentity = <A>(
  monoid: Monoid<A>,
  x: A,
  equals: (a: A, b: A) => boolean = (a, b) => a === b
): boolean => equals(monoid.combine(monoid.empty, x), x)

/**
 * Check right identity law: x ⊕ empty = x
 */
export const checkRightIdentity = <A>(
  monoid: Monoid<A>,
  x: A,
  equals: (a: A, b: A) => boolean = (a, b) => a === b
): boolean => equals(monoid.combine(x, monoid.empty), x)

/**
 * Check associativity law: (x ⊕ y) ⊕ z = x ⊕ (y ⊕ z)
 */
export const checkAssociativity = <A>(
  monoid: Monoid<A>,
  x: A,
  y: A,
  z: A,
  equals: (a: A, b: A) => boolean = (a, b) => a === b
): boolean => {
  const left = monoid.combine(monoid.combine(x, y), z)
  const right = monoid.combine(x, monoid.combine(y, z))
  return equals(left, right)
}

/**
 * Check all monoid laws
 */
export const checkLaws = <A>(
  monoid: Monoid<A>,
  values: readonly [A, A, A],
  equals: (a: A, b: A) => boolean = (a, b) => a === b
): boolean => {
  const [x, y, z] = values
  return (
    checkLeftIdentity(monoid, x, equals) &&
    checkRightIdentity(monoid, x, equals) &&
    checkAssociativity(monoid, x, y, z, equals)
  )
}
