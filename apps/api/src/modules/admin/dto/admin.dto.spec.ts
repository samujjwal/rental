import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  UpdateUserRoleDto,
  UpdateEntityStatusDto,
  AdminQueryDto,
  SuspendUserDto,
  AdminActionDto,
} from './admin.dto';
import { UserRole } from '@rental-portal/database';

describe('Admin DTOs', () => {
  describe('UpdateUserRoleDto', () => {
    it('passes with valid role', async () => {
      const role = Object.values(UserRole)[0];
      const dto = plainToInstance(UpdateUserRoleDto, { role });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when role is missing', async () => {
      const dto = plainToInstance(UpdateUserRoleDto, {});
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'role')).toBe(true);
    });

    it('fails when role is invalid', async () => {
      const dto = plainToInstance(UpdateUserRoleDto, { role: 'INVALID_ROLE' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'role')).toBe(true);
    });

    it('passes with each UserRole value', async () => {
      for (const role of Object.values(UserRole)) {
        const dto = plainToInstance(UpdateUserRoleDto, { role });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('UpdateEntityStatusDto', () => {
    it('passes with valid data', async () => {
      const dto = plainToInstance(UpdateEntityStatusDto, { status: 'ACTIVE' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with optional reason', async () => {
      const dto = plainToInstance(UpdateEntityStatusDto, {
        status: 'SUSPENDED',
        reason: 'Policy violation',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when status is missing', async () => {
      const dto = plainToInstance(UpdateEntityStatusDto, {});
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('fails when status exceeds 50 chars', async () => {
      const dto = plainToInstance(UpdateEntityStatusDto, { status: 'S'.repeat(51) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('fails when reason exceeds 1000 chars', async () => {
      const dto = plainToInstance(UpdateEntityStatusDto, {
        status: 'SUSPENDED',
        reason: 'R'.repeat(1001),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reason')).toBe(true);
    });
  });

  describe('AdminQueryDto', () => {
    it('passes with empty object (all optional)', async () => {
      const dto = plainToInstance(AdminQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with all fields', async () => {
      const dto = plainToInstance(AdminQueryDto, {
        page: 1,
        limit: 20,
        search: 'test query',
        sortBy: 'createdAt',
        sortOrder: 'desc',
        filters: { status: 'ACTIVE' },
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when page is 0', async () => {
      const dto = plainToInstance(AdminQueryDto, { page: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });

    it('fails when page is negative', async () => {
      const dto = plainToInstance(AdminQueryDto, { page: -1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'page')).toBe(true);
    });

    it('passes when page is 1', async () => {
      const dto = plainToInstance(AdminQueryDto, { page: 1 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when limit is 0', async () => {
      const dto = plainToInstance(AdminQueryDto, { limit: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });

    it('fails when limit exceeds 100', async () => {
      const dto = plainToInstance(AdminQueryDto, { limit: 101 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });

    it('passes when limit is 100', async () => {
      const dto = plainToInstance(AdminQueryDto, { limit: 100 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes when limit is 1', async () => {
      const dto = plainToInstance(AdminQueryDto, { limit: 1 });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when search exceeds 200 chars', async () => {
      const dto = plainToInstance(AdminQueryDto, { search: 'S'.repeat(201) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'search')).toBe(true);
    });

    it('fails when sortBy exceeds 50 chars', async () => {
      const dto = plainToInstance(AdminQueryDto, { sortBy: 'S'.repeat(51) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'sortBy')).toBe(true);
    });

    it('fails when sortOrder is invalid', async () => {
      const dto = plainToInstance(AdminQueryDto, { sortOrder: 'up' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
    });

    it('passes with sortOrder asc', async () => {
      const dto = plainToInstance(AdminQueryDto, { sortOrder: 'asc' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with sortOrder desc', async () => {
      const dto = plainToInstance(AdminQueryDto, { sortOrder: 'desc' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('SuspendUserDto', () => {
    it('passes with valid reason', async () => {
      const dto = plainToInstance(SuspendUserDto, { reason: 'Repeated policy violations' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when reason is missing', async () => {
      const dto = plainToInstance(SuspendUserDto, {});
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reason')).toBe(true);
    });

    it('fails when reason exceeds 1000 chars', async () => {
      const dto = plainToInstance(SuspendUserDto, { reason: 'R'.repeat(1001) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reason')).toBe(true);
    });
  });

  describe('AdminActionDto', () => {
    it('passes with required fields', async () => {
      const dto = plainToInstance(AdminActionDto, { action: 'APPROVE' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with all fields', async () => {
      const dto = plainToInstance(AdminActionDto, {
        action: 'REJECT',
        reason: 'Missing documentation',
        metadata: { reviewedBy: 'admin-1' },
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when action is missing', async () => {
      const dto = plainToInstance(AdminActionDto, {});
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'action')).toBe(true);
    });

    it('fails when action exceeds 50 chars', async () => {
      const dto = plainToInstance(AdminActionDto, { action: 'A'.repeat(51) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'action')).toBe(true);
    });

    it('fails when reason exceeds 1000 chars', async () => {
      const dto = plainToInstance(AdminActionDto, {
        action: 'REJECT',
        reason: 'R'.repeat(1001),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reason')).toBe(true);
    });
  });
});
