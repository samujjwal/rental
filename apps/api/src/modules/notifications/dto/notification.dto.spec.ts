import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  UpdatePreferencesDto,
  DevicePlatform,
  RegisterDeviceDto,
  UnregisterDeviceDto,
} from './notification.dto';

describe('Notification DTOs', () => {
  describe('DevicePlatform enum', () => {
    it('has expected values', () => {
      expect(DevicePlatform.IOS).toBe('ios');
      expect(DevicePlatform.ANDROID).toBe('android');
      expect(DevicePlatform.WEB).toBe('web');
    });
  });

  describe('UpdatePreferencesDto', () => {
    it('passes with empty object (all optional)', async () => {
      const dto = plainToInstance(UpdatePreferencesDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with all boolean preferences', async () => {
      const dto = plainToInstance(UpdatePreferencesDto, {
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: false,
        inAppNotifications: true,
        marketingEmails: false,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with type preferences', async () => {
      const dto = plainToInstance(UpdatePreferencesDto, {
        types: {
          booking: true,
          payment: true,
          review: false,
          message: true,
          system: true,
          organization: false,
        },
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when emailNotifications is not boolean', async () => {
      const dto = plainToInstance(UpdatePreferencesDto, { emailNotifications: 'yes' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'emailNotifications')).toBe(true);
    });

    it('fails when pushNotifications is not boolean', async () => {
      const dto = plainToInstance(UpdatePreferencesDto, { pushNotifications: 1 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'pushNotifications')).toBe(true);
    });

    it('fails when smsNotifications is not boolean', async () => {
      const dto = plainToInstance(UpdatePreferencesDto, { smsNotifications: 'false' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'smsNotifications')).toBe(true);
    });

    it('fails when inAppNotifications is not boolean', async () => {
      const dto = plainToInstance(UpdatePreferencesDto, { inAppNotifications: 0 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'inAppNotifications')).toBe(true);
    });

    it('fails when marketingEmails is not boolean', async () => {
      const dto = plainToInstance(UpdatePreferencesDto, { marketingEmails: 'true' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'marketingEmails')).toBe(true);
    });
  });

  describe('RegisterDeviceDto', () => {
    it('passes with valid data', async () => {
      const dto = plainToInstance(RegisterDeviceDto, {
        token: 'expo-push-token-abc123',
        platform: DevicePlatform.IOS,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('passes with optional deviceName', async () => {
      const dto = plainToInstance(RegisterDeviceDto, {
        token: 'fcm-token-xyz',
        platform: DevicePlatform.ANDROID,
        deviceName: 'Samsung Galaxy S24',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when token is missing', async () => {
      const dto = plainToInstance(RegisterDeviceDto, { platform: DevicePlatform.IOS });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'token')).toBe(true);
    });

    it('fails when platform is missing', async () => {
      const dto = plainToInstance(RegisterDeviceDto, { token: 'some-token' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'platform')).toBe(true);
    });

    it('fails when platform is invalid', async () => {
      const dto = plainToInstance(RegisterDeviceDto, {
        token: 'some-token',
        platform: 'windows',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'platform')).toBe(true);
    });

    it('fails when token exceeds 500 chars', async () => {
      const dto = plainToInstance(RegisterDeviceDto, {
        token: 'T'.repeat(501),
        platform: DevicePlatform.WEB,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'token')).toBe(true);
    });

    it('fails when deviceName exceeds 200 chars', async () => {
      const dto = plainToInstance(RegisterDeviceDto, {
        token: 'some-token',
        platform: DevicePlatform.IOS,
        deviceName: 'D'.repeat(201),
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'deviceName')).toBe(true);
    });

    it('passes with each DevicePlatform value', async () => {
      for (const platform of Object.values(DevicePlatform)) {
        const dto = plainToInstance(RegisterDeviceDto, { token: 'tok', platform });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
      }
    });
  });

  describe('UnregisterDeviceDto', () => {
    it('passes with valid token', async () => {
      const dto = plainToInstance(UnregisterDeviceDto, { token: 'expo-push-token' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('fails when token is missing', async () => {
      const dto = plainToInstance(UnregisterDeviceDto, {});
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'token')).toBe(true);
    });

    it('fails when token exceeds 500 chars', async () => {
      const dto = plainToInstance(UnregisterDeviceDto, { token: 'T'.repeat(501) });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'token')).toBe(true);
    });
  });
});
