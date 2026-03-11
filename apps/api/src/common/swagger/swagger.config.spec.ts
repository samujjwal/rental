import { setupSwagger } from './swagger.config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

jest.mock('@nestjs/swagger', () => {
  const mockBuilder = {
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setVersion: jest.fn().mockReturnThis(),
    addBearerAuth: jest.fn().mockReturnThis(),
    addTag: jest.fn().mockReturnThis(),
    addServer: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({ info: { title: 'Test' } }),
  };
  return {
    DocumentBuilder: jest.fn(() => mockBuilder),
    SwaggerModule: {
      createDocument: jest.fn().mockReturnValue({ paths: {} }),
      setup: jest.fn(),
    },
  };
});

describe('setupSwagger', () => {
  let app: any;

  beforeEach(() => {
    jest.clearAllMocks();
    app = {} as any;
  });

  it('creates a document builder with title, description, version', () => {
    setupSwagger(app);

    const builderInstance = (DocumentBuilder as jest.Mock).mock.results[0].value;
    expect(builderInstance.setTitle).toHaveBeenCalledWith('GharBatai Rentals API');
    expect(builderInstance.setDescription).toHaveBeenCalledWith(expect.stringContaining('rental'));
    expect(builderInstance.setVersion).toHaveBeenCalledWith('1.0');
  });

  it('adds JWT bearer auth', () => {
    setupSwagger(app);

    const builderInstance = (DocumentBuilder as jest.Mock).mock.results[0].value;
    expect(builderInstance.addBearerAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      }),
      'JWT-auth',
    );
  });

  it('registers all expected tags', () => {
    setupSwagger(app);

    const builderInstance = (DocumentBuilder as jest.Mock).mock.results[0].value;
    const tagCalls = builderInstance.addTag.mock.calls.map((c: any[]) => c[0]);
    expect(tagCalls).toEqual(
      expect.arrayContaining([
        'auth', 'users', 'categories', 'listings', 'bookings',
        'payments', 'search', 'reviews', 'notifications', 'messages',
        'disputes', 'admin', 'upload', 'webhooks', 'health',
      ]),
    );
    expect(builderInstance.addTag).toHaveBeenCalledTimes(15);
  });

  it('adds three servers (local, staging, production)', () => {
    setupSwagger(app);

    const builderInstance = (DocumentBuilder as jest.Mock).mock.results[0].value;
    expect(builderInstance.addServer).toHaveBeenCalledTimes(3);
    expect(builderInstance.addServer).toHaveBeenCalledWith(
      'http://localhost:3400',
      'Local development server',
    );
  });

  it('calls SwaggerModule.createDocument and setup', () => {
    setupSwagger(app);

    expect(SwaggerModule.createDocument).toHaveBeenCalledWith(app, expect.any(Object));
    expect(SwaggerModule.setup).toHaveBeenCalledWith(
      'api/docs',
      app,
      expect.any(Object),
      expect.objectContaining({
        swaggerOptions: expect.objectContaining({
          persistAuthorization: true,
        }),
        customSiteTitle: 'GharBatai Rentals API Documentation',
      }),
    );
  });
});
