import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Ride Hailing API')
    .setDescription('Ride management and driver assignment service')
    .setVersion('1.0.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  app.use(
    '/api/docs',
    apiReference({
      theme: 'saturn',
      layout: 'modern',
      pageTitle: 'Ride Hailing API',
      sources: [
        {
          content: document as Record<string, any>,
        },
      ],
    }),
  );

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}

bootstrap();
