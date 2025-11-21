/**
 * Type declarations for wink-nlp-utils
 *
 * This module doesn't have official TypeScript types,
 * so we declare the subset of the API we use.
 */

declare module "wink-nlp-utils" {
  export namespace string {
    export function isStopWord(word: string): boolean
    export function removePunctuation(text: string): string
    export function removeExtraSpaces(text: string): string
    export function stem(word: string): string
    export namespace similarity {
      export function jaro(s1: string, s2: string): number
    }
  }

  export namespace tokens {
    export function bagOfWords(tokens: ReadonlyArray<string>): Record<string, number>
  }
}
