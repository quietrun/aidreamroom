import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { SessionAuthService } from './session-auth.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessionAuthService: SessionAuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['session_token'] as string | undefined;
    const user = await this.sessionAuthService.requireUserByToken(token);

    const expired = Date.now() - Number(user.updateTime || 0) >= 15 * 24 * 60 * 60 * 1000;
    if (expired) {
      throw new UnauthorizedException('登录状态已过期');
    }

    request.sessionUser = user;
    return true;
  }
}
