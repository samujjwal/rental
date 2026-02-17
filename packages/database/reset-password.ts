import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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
