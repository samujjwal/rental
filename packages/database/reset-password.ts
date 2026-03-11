import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

config({ path: '../../.env' });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const result = await prisma.user.updateMany({
    where: { 
      email: { 
        in: [
          'owner@test.com', 
          'renter@test.com', 
          'admin@test.com'
        ] 
      } 
    },
    data: { passwordHash: passwordHash },
  });
  
  console.log(`Updated passwords for ${result.count} test users to: password123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
