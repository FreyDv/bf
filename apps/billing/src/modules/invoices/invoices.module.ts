import { Module } from '@nestjs/common';

import { InvoicesRouter } from './invoices.router';

@Module({ providers: [InvoicesRouter] })
export class InvoicesModule {}
