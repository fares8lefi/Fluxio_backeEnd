const request = require('supertest');

// Mock prisma BEFORE requiring app — Jest hoists jest.mock() calls
jest.mock('../config/db', () => ({
  $queryRaw: jest.fn(),
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
}));

const app = require('../app');
const prisma = require('../config/db');

describe('Health Check API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('devrait retourner 200 et status healthy si la DB fonctionne', async () => {
    prisma.$queryRaw.mockResolvedValue([1]);

    const res = await request(app).get('/health');

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('healthy');
    expect(res.body.services.database).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
  });

  it('devrait retourner 503 et status unhealthy si la DB est down', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('DB Down'));

    const res = await request(app).get('/health');

    expect(res.statusCode).toEqual(503);
    expect(res.body.success).toBe(false);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.services.database).toBe('error');
  });
});
