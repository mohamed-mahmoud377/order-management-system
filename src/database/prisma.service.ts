import { INestApplication, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'event' },
        { level: 'warn', emit: 'event' },
      ],
    });

    (this as any).$on('query', (e: any) => {
      const duration = e.duration;
      const modelOp = e.query?.split(' ')[0] || 'QUERY';
      // Avoid logging raw params to reduce risk of sensitive data leakage
      this.logger.verbose?.(`Prisma ${modelOp} ${duration}ms`);
    });

    (this as any).$on('warn', (e: any) => {
      this.logger.warn(`Prisma warn: ${e.message}`);
    });

    (this as any).$on('error', (e: any) => {
      this.logger.error(`Prisma error: ${e.message}`);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }
}
