const request = require('supertest');
const app = require('../app');
const prisma = require('../config/db');

// Mock de Prisma pour éviter de toucher à la vraie base de données pendant les tests unitaires
jest.mock('../config/db', () => ({
  $queryRaw: jest.fn(),
  $connect: jest.fn().mockResolvedValue(),
  $disconnect: jest.fn().mockResolvedValue(),
}));

describe('Health Check API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('devrait retourner 200 et status healthy si la DB fonctionne', async () => {
    // Simuler une réponse positive de la base de données
    prisma.$queryRaw.mockResolvedValue([1]);

    const res = await request(app).get('/health');

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe('healthy');
    expect(res.body.services.database).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
  });

  it('devrait retourner 503 et status unhealthy si la DB est down', async () => {
    // Simuler une erreur de la base de données
    prisma.$queryRaw.mockRejectedValue(new Error('DB Down'));

    const res = await request(app).get('/health');

    expect(res.statusCode).toEqual(503);
    expect(res.body.success).toBe(false);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.services.database).toBe('error');
  });
});
