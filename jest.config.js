module.exports = {
  // Mock environment variables for tests
  setupFiles: ['<rootDir>/tests/setup.js'],
  // Different environments for different test types
  projects: [
    {
      displayName: 'server',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/tests/server/**/*.test.ts'],
      transform: {
        '^.+\\.ts$': 'ts-jest'
      },
      moduleFileExtensions: ['ts', 'js', 'json'],
      transformIgnorePatterns: [
        'node_modules/(?!(@langchain|langchain)/)'
      ],
      setupFiles: ['<rootDir>/tests/setup.js']
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['**/tests/client/**/*.test.js'],
      transform: {
        '^.+\\.js$': 'babel-jest'
      }
    }
  ]
};
