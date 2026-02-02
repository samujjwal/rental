import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '@/common/prisma/prisma.service';
import { UserRole, UserStatus } from '@rental-portal/database';
import * as bcrypt from 'bcrypt';

@Controller('admin/dev')
export class DevController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('create-admin')
  @ApiOperation({ summary: 'Create admin user (development only)' })
  async createDevAdmin() {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Development only endpoint');
    }

    // Check if admin user already exists
    const existingAdmin = await this.prisma.user.findFirst({
      where: { email: 'admin@dev.local' },
    });

    if (existingAdmin) {
      return { message: 'Admin user already exists', userId: existingAdmin.id };
    }

    // Create admin user with properly hashed password
    const passwordHash = await bcrypt.hash('admin123', 10);
    const adminUser = await this.prisma.user.create({
      data: {
        email: 'admin@dev.local',
        username: 'admin',
        firstName: 'Dev',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
    });

    return {
      message: 'Admin user created',
      userId: adminUser.id,
      email: 'admin@dev.local',
      note: 'User created without password - use auth endpoints to set up authentication',
    };
  }
}
