/**
 * Jest for the API gateway.
 *
 * The service is ESM at runtime, but ts-jest compiles the sources to CommonJS
 * for tests (see tsconfig.test.json). That avoids Jest's experimental ESM VM
 * modules entirely, and nothing here uses `import.meta`, which is the one
 * construct that would force the ESM path.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  // JWT_SECRET has to exist before config.ts is imported, and config.ts is
  // imported transitively by nearly everything.
  setupFiles: ['<rootDir>/src/__tests__/setup-env.ts'],
  moduleNameMapper: {
    // @boloshop/db ships ESM, which Jest's CommonJS runtime cannot require.
    // Pointing at its sources lets the same ts-jest transform handle it, and
    // has the side benefit that these tests run against the real helper
    // rather than a double.
    '^@boloshop/db$': '<rootDir>/../../packages/db/src/index.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/__tests__/**'],
};
