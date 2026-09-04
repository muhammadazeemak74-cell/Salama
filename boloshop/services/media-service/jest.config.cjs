/**
 * Jest for the media service.
 *
 * The service is ESM at runtime, but ts-jest compiles the sources to CommonJS
 * for tests (see tsconfig.test.json). That avoids Jest's experimental ESM VM
 * modules entirely, and nothing here uses `import.meta`, which is the one
 * construct that would force the ESM path.
 *
 * @boloshop/db is mapped to a stub that re-exports the real Redis helpers and
 * fakes only the Postgres side: credit balances are the thing under test and
 * they live in Redis, while the seller lookup is a SQL query these tests have
 * no interest in.
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
