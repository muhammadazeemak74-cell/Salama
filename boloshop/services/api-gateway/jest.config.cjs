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
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/__tests__/**'],
};
