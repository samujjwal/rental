import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

/**
 * Password validation constraint
 * Requires: uppercase, lowercase, number, and special character
 */
@ValidatorConstraint({ name: 'strongPassword', async: false })
export class StrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: string) {
    if (!password) return false;
    // At least 8 characters, uppercase, lowercase, number, special character
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
  }

  defaultMessage() {
    return 'Password must contain uppercase, lowercase, number and special character, and be at least 8 characters long';
  }
}

/**
 * Custom decorator for strong password validation
 */
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: StrongPasswordConstraint,
    });
  };
}

/**
 * Phone number validation constraint (E.164 format)
 */
@ValidatorConstraint({ name: 'e164Phone', async: false })
export class E164PhoneConstraint implements ValidatorConstraintInterface {
  validate(phone: string) {
    if (!phone) return false;
    // E.164 format: + followed by 10-15 digits
    const regex = /^\+[1-9]\d{1,14}$/;
    return regex.test(phone);
  }

  defaultMessage() {
    return 'Phone number must be in E.164 format (e.g., +12025551234)';
  }
}

/**
 * Custom decorator for E.164 phone number validation
 */
export function IsE164Phone(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: E164PhoneConstraint,
    });
  };
}

/**
 * URL validation constraint (https only)
 */
@ValidatorConstraint({ name: 'secureUrl', async: false })
export class SecureUrlConstraint implements ValidatorConstraintInterface {
  validate(url: string) {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  defaultMessage() {
    return 'URL must use HTTPS protocol';
  }
}

/**
 * Custom decorator for secure URL validation
 */
export function IsSecureUrl(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: SecureUrlConstraint,
    });
  };
}
