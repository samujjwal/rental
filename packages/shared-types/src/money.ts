/**
 * Money Value Object — Immutable representation of a monetary amount.
 *
 * All internal amounts are stored as **integer minor units** (e.g. cents for
 * USD, whole units for JPY) to avoid floating-point precision issues.
 *
 * Usage:
 *   const price = Money.fromMajor(15.50, 'USD');       // 1550 cents
 *   const tax   = price.multiply(0.13);                 // 201 cents ($2.01)
 *   const total = price.add(tax);                       // 1751 cents ($17.51)
 *   total.toMajor();                                    // 17.51
 *   total.toJSON();                                     // { amount: 1751, currency: 'USD' }
 *
 * Zero-decimal (JPY, KRW, etc.) and three-decimal (BHD, KWD, etc.) currencies
 * are handled automatically via getCurrencyDecimals().
 */

import { getCurrencyDecimals, toMinorUnits, fromMinorUnits } from './currency.utils';

export interface MoneyJSON {
  /** Amount in minor units (cents, pence, etc.) */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
}

export class Money {
  /** Amount in the smallest currency unit (integer). */
  readonly amount: number;
  /** ISO 4217 currency code (uppercase). */
  readonly currency: string;

  private constructor(minorAmount: number, currencyCode: string) {
    this.amount = Math.round(minorAmount);
    this.currency = currencyCode.toUpperCase();
  }

  // ─── Factory Methods ─────────────────────────────────────────────────────

  /**
   * Create Money from an amount already in minor units (e.g. cents).
   */
  static fromMinor(minorAmount: number, currency: string): Money {
    return new Money(minorAmount, currency);
  }

  /**
   * Create Money from a human-readable major amount (e.g. dollars).
   */
  static fromMajor(majorAmount: number, currency: string): Money {
    return new Money(toMinorUnits(majorAmount, currency), currency);
  }

  /**
   * Create a zero-value Money instance for a given currency.
   */
  static zero(currency: string): Money {
    return new Money(0, currency);
  }

  /**
   * Deserialize from a { amount, currency } JSON object.
   */
  static fromJSON(json: MoneyJSON): Money {
    return new Money(json.amount, json.currency);
  }

  // ─── Arithmetic (returns new Money — immutable) ──────────────────────────

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  /**
   * Multiply by a scalar (e.g. quantity, percentage as decimal).
   * The result is rounded to the nearest minor unit.
   */
  multiply(factor: number): Money {
    return new Money(Math.round(this.amount * factor), this.currency);
  }

  /**
   * Split this amount into `n` equal parts, distributing any remainder
   * to the first parts (penny-perfect splitting).
   */
  allocate(parts: number): Money[] {
    if (parts <= 0) throw new Error('Cannot allocate into zero or negative parts');
    const quotient = Math.floor(this.amount / parts);
    const remainder = this.amount - quotient * parts;
    return Array.from({ length: parts }, (_, i) =>
      new Money(quotient + (i < remainder ? 1 : 0), this.currency),
    );
  }

  negate(): Money {
    return new Money(-this.amount, this.currency);
  }

  abs(): Money {
    return new Money(Math.abs(this.amount), this.currency);
  }

  // ─── Comparison ──────────────────────────────────────────────────────────

  isZero(): boolean {
    return this.amount === 0;
  }

  isPositive(): boolean {
    return this.amount > 0;
  }

  isNegative(): boolean {
    return this.amount < 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount === other.amount;
  }

  greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount > other.amount;
  }

  lessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount < other.amount;
  }

  // ─── Conversion ──────────────────────────────────────────────────────────

  /**
   * Convert to human-readable major units (e.g. 1550 → 15.50 for USD).
   */
  toMajor(): number {
    return fromMinorUnits(this.amount, this.currency);
  }

  /**
   * Serializable JSON representation.
   */
  toJSON(): MoneyJSON {
    return { amount: this.amount, currency: this.currency };
  }

  /**
   * Human-readable string (e.g. "USD 15.50").
   */
  toString(): string {
    const decimals = getCurrencyDecimals(this.currency);
    const major = this.toMajor().toFixed(decimals);
    return `${this.currency} ${major}`;
  }

  // ─── Internals ───────────────────────────────────────────────────────────

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Currency mismatch: cannot combine ${this.currency} with ${other.currency}`,
      );
    }
  }
}
