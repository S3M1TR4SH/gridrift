/**
 * Genre code. A new game replaces this file.
 * Keep boot, ads, consent, and config in shell.js.
 */
export function createGenre() {
  return {
    id: 'sample',
    title: 'Sample genre',
    step({ score = 0 } = {}) {
      return { score: score + 1, over: false };
    }
  };
}
