import { Module } from '@nestjs/common';
import { TRPCModule } from 'nestjs-trpc';

@Module({
  imports: [TRPCModule.forRoot({})],
})
export class AppModule {}
