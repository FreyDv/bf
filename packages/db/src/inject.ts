import { Inject } from '@nestjs/common';

import { DRIZZLE } from './drizzle.provider';

export const InjectDrizzle = () => Inject(DRIZZLE);
