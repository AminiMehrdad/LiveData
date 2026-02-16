import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UploadController } from '../src/controllers/upload.controller'; 
describe('UploadController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        controllers: [UploadController],
      }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ✅ GET test
  it('GET /files should return list of files', async () => {
    const response = await request(app.getHttpServer())
      .get('/upload')
      .expect(200);

    expect(response.text).toEqual('Hello World!');
  });

  // ✅ POST upload test (Multer)
  it('POST /files/upload should upload file', async () => {
    const response = await request(app.getHttpServer())
      .post('/upload')
      .attach(
        'file',
        Buffer.from('test file content'),
        'test.txt',
      )
      .expect(201);

    expect(response.body).toHaveProperty('originalname', 'test.txt');
    expect(response.body).toHaveProperty('size');
  });
});
