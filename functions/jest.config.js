/**
 * Three Jest projects, deliberately separated because they have very different requirements:
 *
 *   core      — pure unit tests. No network, no emulator, no Java. Runs anywhere, instantly.
 *   functions — callable handlers against the Firestore emulator. Needs Java + `firebase emulators:exec`.
 *   rules     — security rules via @firebase/rules-unit-testing. Also needs the emulator.
 *
 * `npm test` runs all three; `npm run test:core` is the fast inner loop used while building Phase D.
 */

/** @type {import('ts-jest').JestConfigWithTsJest} */
const base = {
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      ...base,
      displayName: 'core',
      testMatch: ['<rootDir>/__tests__/core/**/*.test.ts', '<rootDir>/__tests__/contract.test.ts'],
    },
    {
      ...base,
      displayName: 'functions',
      testMatch: ['<rootDir>/__tests__/functions/**/*.test.ts'],
    },
    {
      ...base,
      displayName: 'rules',
      testMatch: ['<rootDir>/__tests__/rules/**/*.test.ts'],
    },
  ],

  // Coverage is enforced ONLY on the pure core. That is the code where "0 errors" is an achievable
  // claim (see docs/ocr-receipt-validation-plan.md §2), so it is the code held to 100% branches.
  collectCoverageFrom: ['src/receipts/core/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '\\.d\\.ts$'],
  coverageThreshold: {
    './src/receipts/core/': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
