const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CUID_PATTERN = /^c[a-z0-9]{20,}$/i;

export const isAppEntityId = (value: string | undefined | null): value is string =>
  Boolean(
    value && (UUID_PATTERN.test(value) || CUID_PATTERN.test(value)),
  );
