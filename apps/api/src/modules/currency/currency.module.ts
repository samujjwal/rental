import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CurrencyRepository } from './repositories/currency.repository';
import { ExchangeRateRepository } from './repositories/exchange-rate.repository';
import { MultiCurrencyService } from './services/multi-currency.service';
import { CacheModule } from '../../../common/cache/cache.module';
import { PrismaModule } from '../../../common/prisma/prisma.module';
import { PaymentsModule } from '../../payments/payments.module';

@Module({
  imports: [ConfigModule, CacheModule, PrismaModule, PaymentsModule],
  providers: [CurrencyRepository, ExchangeRateRepository, MultiCurrencyService],
  exports: [CurrencyRepository, ExchangeRateRepository, MultiCurrencyService],
})
export class CurrencyModule {}
