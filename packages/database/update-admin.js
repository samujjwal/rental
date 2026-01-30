const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateAdminRole() {
  try {
    const result = await prisma.user.update({
      where: { email: 'admin@example.com' },
      data: { role: 'ADMIN' },
    });

    console.log('User updated to ADMIN:', result);
  } catch (error) {
    console.error('Error updating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminRole();
