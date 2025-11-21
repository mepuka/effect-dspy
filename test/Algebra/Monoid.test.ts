/**
 * Property-based tests for Monoid laws
 *
 * This test suite verifies that our monoid instances satisfy the monoid laws:
 * 1. Left identity: empty ⊕ x = x
 * 2. Right identity: x ⊕ empty = x
 * 3. Associativity: (x ⊕ y) ⊕ z = x ⊕ (y ⊕ z)
 *
 * We use fast-check for property-based testing, which generates random inputs
 * and verifies the laws hold for all of them.
 */

import { describe, expect, it } from "vitest"
import * as fc from "fast-check"
import * as M from "../../src/Algebra/Monoid.js"

/**
 * Generic property test for monoid laws
 */
const testMonoidLaws = <A>(
  name: string,
  monoid: M.Monoid<A>,
  arbitrary: fc.Arbitrary<A>,
  equals: (a: A, b: A) => boolean = (a, b) => a === b
) => {
  describe(`${name} Monoid Laws`, () => {
    it("should satisfy left identity: empty ⊕ x = x", () => {
      fc.assert(
        fc.property(arbitrary, (x) => {
          const result = monoid.combine(monoid.empty, x)
          return equals(result, x)
        })
      )
    })

    it("should satisfy right identity: x ⊕ empty = x", () => {
      fc.assert(
        fc.property(arbitrary, (x) => {
          const result = monoid.combine(x, monoid.empty)
          return equals(result, x)
        })
      )
    })

    it("should satisfy associativity: (x ⊕ y) ⊕ z = x ⊕ (y ⊕ z)", () => {
      fc.assert(
        fc.property(arbitrary, arbitrary, arbitrary, (x, y, z) => {
          const left = monoid.combine(monoid.combine(x, y), z)
          const right = monoid.combine(x, monoid.combine(y, z))
          return equals(left, right)
        })
      )
    })
  })
}

// =============================================================================
// String Monoids
// =============================================================================

testMonoidLaws("StringConcat", M.StringConcat, fc.string())

testMonoidLaws("StringJoin(' ')", M.StringJoin(" "), fc.string())

testMonoidLaws("StringJoin(', ')", M.StringJoin(", "), fc.string())

// =============================================================================
// Numeric Monoids
// =============================================================================

testMonoidLaws("NumberSum", M.NumberSum, fc.integer())

testMonoidLaws("NumberProduct", M.NumberProduct, fc.integer())

testMonoidLaws(
  "NumberMax",
  M.NumberMax,
  fc.integer({ min: -1000, max: 1000 }) // Avoid infinities in tests
)

testMonoidLaws(
  "NumberMin",
  M.NumberMin,
  fc.integer({ min: -1000, max: 1000 }) // Avoid infinities in tests
)

// =============================================================================
// Array Monoids
// =============================================================================

testMonoidLaws(
  "ArrayConcat<number>",
  M.ArrayConcat<number>(),
  fc.array(fc.integer()),
  (a, b) => JSON.stringify(a) === JSON.stringify(b)
)

// =============================================================================
// Boolean Monoids
// =============================================================================

testMonoidLaws("BooleanAll", M.BooleanAll, fc.boolean())

testMonoidLaws("BooleanAny", M.BooleanAny, fc.boolean())

// =============================================================================
// Product Monoids
// =============================================================================

describe("Product Monoid Laws", () => {
  const productMonoid = M.Product(M.NumberSum, M.StringConcat)
  const arbitrary = fc.tuple(fc.integer(), fc.string())

  const equals = (a: readonly [number, string], b: readonly [number, string]) =>
    a[0] === b[0] && a[1] === b[1]

  testMonoidLaws("Product(NumberSum, StringConcat)", productMonoid, arbitrary, equals)
})

// =============================================================================
// Endomorphism Monoid
// =============================================================================

describe("Endo<number> Monoid Laws", () => {
  const endoMonoid = M.Endo<number>()

  // Generate arbitrary functions number -> number
  const funcArbitrary = fc.func<[number], number>(fc.integer())

  // For functions, we test equality by applying to a sample input
  const equals = (f: (n: number) => number, g: (n: number) => number) => {
    const testInputs = [0, 1, -1, 42, 100]
    return testInputs.every((input) => f(input) === g(input))
  }

  testMonoidLaws("Endo<number>", endoMonoid, funcArbitrary, equals)
})

// =============================================================================
// Fold Tests
// =============================================================================

describe("Monoid.fold", () => {
  it("should fold empty array to identity", () => {
    const result = M.fold(M.NumberSum)([])
    expect(result).toBe(0)
  })

  it("should fold singleton array to that element", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        const result = M.fold(M.NumberSum)([n])
        return result === n
      })
    )
  })

  it("should fold multiple elements correctly", () => {
    const result = M.fold(M.NumberSum)([1, 2, 3, 4, 5])
    expect(result).toBe(15)
  })

  it("should fold strings with join", () => {
    const result = M.fold(M.StringJoin(" "))(["Hello", "world", "from", "Effect"])
    expect(result).toBe("Hello world from Effect")
  })
})

// =============================================================================
// Vector Monoids
// =============================================================================

describe("VectorAdd Monoid", () => {
  const vectorMonoid = M.VectorAdd(3)

  it("should have zero vector as identity", () => {
    expect(vectorMonoid.empty).toEqual([0, 0, 0])
  })

  it("should add vectors element-wise", () => {
    const v1 = [1, 2, 3]
    const v2 = [4, 5, 6]
    const result = vectorMonoid.combine(v1, v2)
    expect(result).toEqual([5, 7, 9])
  })

  it("should satisfy monoid laws", () => {
    const arbitrary = fc.array(fc.integer(), { minLength: 3, maxLength: 3 })
    const equals = (a: ReadonlyArray<number>, b: ReadonlyArray<number>) =>
      a.length === b.length && a.every((x, i) => x === b[i])

    testMonoidLaws("VectorAdd(3)", vectorMonoid, arbitrary, equals)
  })
})

// =============================================================================
// Dual Monoid
// =============================================================================

describe("Dual Monoid", () => {
  const dualConcat = M.Dual(M.StringConcat)

  it("should reverse combination order", () => {
    const result = dualConcat.combine("Hello", " world")
    expect(result).toBe(" worldHello")
  })

  it("should still satisfy monoid laws", () => {
    testMonoidLaws("Dual(StringConcat)", dualConcat, fc.string())
  })
})

// =============================================================================
// CombineAll Tests
// =============================================================================

describe("Monoid.combineAll", () => {
  it("should combine all elements", () => {
    const result = M.combineAll(M.NumberSum)([1, 2, 3, 4, 5])
    expect(result).toBe(15)
  })

  it("should handle empty array", () => {
    const result = M.combineAll(M.NumberSum)([])
    expect(result).toBe(0)
  })

  it("should work with complex monoids", () => {
    const productMonoid = M.Product(M.NumberSum, M.NumberProduct)
    const result = M.combineAll(productMonoid)([
      [1, 2],
      [3, 4],
      [5, 6]
    ])
    expect(result).toEqual([9, 48])
  })
})
