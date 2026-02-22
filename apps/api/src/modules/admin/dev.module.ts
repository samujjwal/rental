import { Module } from '@nestjs/common';

/**
 * @deprecated DevModule removed for security — admin creation now via seed scripts only.
 * Kept as empty module to avoid import errors during transition.
 */
@Module({})
export class DevModule {}
