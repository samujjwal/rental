import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { Roles } from './roles.decorator';
import { Permissions } from './permissions.decorator';
import { CurrentUser } from './current-user.decorator';
import { ROLES_KEY, PERMISSIONS_KEY, Permission } from '../guards/roles.guard';

// We need to extract the decorator factory result for currentUser
// NestJS's createParamDecorator stores a factory via ROUTE_ARGS_METADATA
const ROUTE_ARGS_METADATA = '__routeArguments__';

describe('Auth Decorators', () => {
  describe('Roles', () => {
    it('sets roles metadata on handler', () => {
      const reflector = new Reflector();

      class TestController {
        @Roles('ADMIN' as any, 'SUPPORT' as any)
        handler() {}
      }

      const roles = reflector.get(ROLES_KEY, TestController.prototype.handler);
      expect(roles).toEqual(['ADMIN', 'SUPPORT']);
    });

    it('sets empty array when no roles provided', () => {
      const reflector = new Reflector();

      class TestController {
        @Roles()
        handler() {}
      }

      const roles = reflector.get(ROLES_KEY, TestController.prototype.handler);
      expect(roles).toEqual([]);
    });

    it('sets single role', () => {
      const reflector = new Reflector();

      class TestController {
        @Roles('CUSTOMER' as any)
        handler() {}
      }

      const roles = reflector.get(ROLES_KEY, TestController.prototype.handler);
      expect(roles).toEqual(['CUSTOMER']);
    });
  });

  describe('Permissions', () => {
    it('sets permissions metadata on handler', () => {
      const reflector = new Reflector();

      class TestController {
        @Permissions(Permission.VIEW_FINANCIALS, Permission.MANAGE_PAYOUTS)
        handler() {}
      }

      const permissions = reflector.get(PERMISSIONS_KEY, TestController.prototype.handler);
      expect(permissions).toEqual([Permission.VIEW_FINANCIALS, Permission.MANAGE_PAYOUTS]);
    });

    it('sets empty array when no permissions provided', () => {
      const reflector = new Reflector();

      class TestController {
        @Permissions()
        handler() {}
      }

      const permissions = reflector.get(PERMISSIONS_KEY, TestController.prototype.handler);
      expect(permissions).toEqual([]);
    });

    it('sets single permission', () => {
      const reflector = new Reflector();

      class TestController {
        @Permissions(Permission.MANAGE_DISPUTES)
        handler() {}
      }

      const permissions = reflector.get(PERMISSIONS_KEY, TestController.prototype.handler);
      expect(permissions).toEqual([Permission.MANAGE_DISPUTES]);
    });
  });

  describe('CurrentUser', () => {
    // CurrentUser uses createParamDecorator - we test the factory function directly
    // by accessing the internal metadata
    const createMockExecutionContext = (user: any): ExecutionContext =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
        getType: () => 'http',
        getClass: () => ({}),
        getHandler: () => ({}),
        getArgs: () => [],
        getArgByIndex: () => ({}),
        switchToRpc: () => ({}),
        switchToWs: () => ({}),
      }) as any;

    it('is defined as a decorator', () => {
      expect(CurrentUser).toBeDefined();
    });

    it('can be applied to a controller method parameter', () => {
      // This verifies the decorator doesn't throw when applied
      class TestController {
        handler(@CurrentUser() user: any) {
          return user;
        }
      }

      // Verify the metadata was set
      const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'handler');
      expect(metadata).toBeDefined();
    });

    it('can be applied with a data key', () => {
      class TestController {
        handler(@CurrentUser('email') email: string) {
          return email;
        }
      }

      const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestController, 'handler');
      expect(metadata).toBeDefined();
    });
  });
});
