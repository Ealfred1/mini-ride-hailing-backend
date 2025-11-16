import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { SeedService } from './seed.service';

async function bootstrap() {
  const appContext = await NestFactory.createApplicationContext(AppModule);
  try {
    const seedService = appContext.get(SeedService);
    await seedService.run();
  } finally {
    await appContext.close();
  }
}

bootstrap()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

