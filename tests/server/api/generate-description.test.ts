import request from 'supertest';
import app from '../../../src/server/index';

describe('POST /api/generate-description', () => {
  it('should return 400 for missing fields', async () => {
    const res = await request(app).post('/api/generate-description').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
  // Add more tests for valid/invalid requests and error handling
});
