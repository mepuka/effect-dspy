/**
 * Type declarations for wink-nlp-utils
 *
 * This module doesn't have official TypeScript types,
 * so we declare the subset of the API we use.
 */

declare module "wink-nlp-utils" {
  export namespace string {
    export function removePunctuations(text: string): string
    export function removeExtraSpaces(text: string): string
    export function stem(word: string): string
    export function lowerCase(text: string): string
  }

  export namespace tokens {
    export function bagOfWords(tokens: ReadonlyArray<string>): Record<string, number>
  }

  export namespace helper {
    export function words(
      words: ReadonlyArray<string>,
      transforms: ReadonlyArray<(word: string) => string>
    ): {
      set(): Set<string>
    }
  }
}
