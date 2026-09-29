const os = require('node:os');
const path = require('node:path');

/**
 * Config locale en CommonJS.
 * `npx vitest` charge ce fichier sans `package.json` du dépôt : un import ESM
 * de `vitest/config` ne se résout pas, et la syntaxe `import` déclenche
 * l'avertissement du chargeur natif de Vite.
 * Le cache Vite est hors du dépôt pour ne pas créer `node_modules` ici.
 * Le script npm viendra après fusion ; ne pas ajouter de dépendance ici.
 */
module.exports = {
  root: path.dirname(__filename),
  cacheDir: path.join(os.tmpdir(), 'plateforme-scolaire-grading-vitest'),
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    passWithNoTests: false,
  },
};
