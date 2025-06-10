const { validateRepo, validatePRNumber } = require('../../src/client/js/formHandler');

describe('Form Validation', () => {
  test('invalid repo format', () => {
    expect(validateRepo('badformat')).toBe(false);
  });
  test('invalid PR number', () => {
    expect(validatePRNumber('abc')).toBe(false);
  });
  // Add more tests for valid/invalid input
});
