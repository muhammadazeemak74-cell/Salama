/**
 * Jest for the media service.
 *
 * The service is ESM at runtime, but ts-jest compiles the sources to CommonJS
 * for tests (see tsconfig.test.json). That avoids Jest's experimental ESM VM
 * modules entirely, and nothing here uses `import.meta`, which is the one
 * construct that would force the ESM path.
 *
 * @boloshop/db is mapped to a stub. credits.ts imports it for the seller
 * lookup, and requiring the real package would mean these unit tests could
 * only run after `npm run build --workspace @boloshop/db`.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/src/__tests__/setup-env.ts'],
  moduleNameMapper: {
    '^@boloshop/db$': '<rootDir>/src/__tests__/mocks/boloshop-db.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/__tests__/**'],
};
