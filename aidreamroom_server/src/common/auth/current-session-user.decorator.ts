import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { SessionUser } from './session-user.interface';

export const CurrentSessionUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser | undefined => {
    const request = context.switchToHttp().getRequest();
    return request.sessionUser as SessionUser | undefined;
  },
);
