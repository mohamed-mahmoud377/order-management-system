import { PostgreSqlContainer, StartedPostgreSqlContainer } from 'testcontainers';
import { execaCommand } from 'execa';

let container: StartedPostgreSqlContainer;

module.exports = async () => {
  // Start ephemeral Postgres container
  container = await new PostgreSqlContainer('postgres:14')
    .withDatabase('test')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const url = `postgresql://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getPort()}/${container.getDatabase()}?schema=public`;
  process.env.DATABASE_URL = url;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

  // Generate client and apply migrations (deploy applies existing migrations)
  await execaCommand('npx prisma generate', { stdio: 'inherit' });
  // If there are no migrations yet, fall back to db push
  try {
    await execaCommand('npx prisma migrate deploy', { stdio: 'inherit' });
  } catch (e) {
    await execaCommand('npx prisma db push', { stdio: 'inherit' });
  }

  // Expose container for teardown
  (global as any).__PG_CONTAINER__ = container;
};
