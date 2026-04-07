import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
const md5 = require('js-md5');
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

import { CurrentUserId } from '../../common/auth/current-user-id.decorator';
import { SessionAuthGuard } from '../../common/auth/session-auth.guard';
import { UsersService } from './users.service';

class EmailCodeQuery {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  type?: string | number;

  @IsOptional()
  accountType?: string | number;
}

class EmailCheckDto {
  @IsString()
  @IsNotEmpty()
  email!: string;
}

class LoginDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsOptional()
  recordUser?: boolean;
}

class RegisterDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  accountType?: string | number;
}

class EditPasswordDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}

class LikeDto {
  @IsString()
  @IsOptional()
  itemId?: string;

  @IsOptional()
  itemType?: number;
}

class ApplyRegisterDto {
  @IsString()
  @IsNotEmpty()
  account!: string;
}

class QueryUserNameDto {
  @IsString()
  @IsNotEmpty()
  user_name!: string;
}

class UpdateInfoDto {
  [key: string]: unknown;
}

class AddFriendDto {
  @IsString()
  @IsNotEmpty()
  target_user_id!: string;
}

class UpdateFriendDto {
  @IsString()
  @IsNotEmpty()
  user_id!: string;

  @IsBoolean()
  approval!: boolean;
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('email')
  email() {
    return 'respond with a resource';
  }

  @Get('email/get/code')
  async getEmailCode(@Query() query: EmailCodeQuery) {
    return this.usersService.sendEmailCode(query.email, Number(query.type ?? 0), Number(query.accountType ?? 0));
  }

  @Post('email/check')
  async checkEmail(@Body() body: EmailCheckDto) {
    const exists = await this.usersService.checkEmailExists(body.email);
    return { result: 0, exists };
  }

  @Post('email/login')
  async login(@Body() body: LoginDto) {
    return this.usersService.login(body.email, body.password, Boolean(body.recordUser));
  }

  @Post('email/register')
  async register(@Body() body: RegisterDto) {
    return this.usersService.register(body.email, body.password, body.code, Number(body.accountType ?? 0));
  }

  @Post('email/edit/password')
  async editPassword(@Body() body: EditPasswordDto) {
    return this.usersService.editPassword(body.email, body.password, body.code);
  }

  @Get('token/check')
  async tokenCheck(@Headers('session_token') token?: string) {
    const result = await this.usersService.checkToken(token);
    return { result: result.valid ? 0 : -1, id: result.id };
  }

  @Post('add/liked')
  @UseGuards(SessionAuthGuard)
  async addLiked(@CurrentUserId() userId: string, @Body() body: LikeDto) {
    await this.usersService.addLiked(userId, body.itemId ?? '', Number(body.itemType ?? 0));
    return { result: 0 };
  }

  @Post('remove/liked')
  @UseGuards(SessionAuthGuard)
  async removeLiked(@CurrentUserId() userId: string, @Body() body: LikeDto) {
    await this.usersService.removeLiked(userId, body.itemId ?? '');
    return { result: 0 };
  }

  @Get('liked/list')
  @UseGuards(SessionAuthGuard)
  async likedList(@CurrentUserId() userId: string) {
    return { result: 0, list: await this.usersService.queryLikedList(userId) };
  }

  @Get('query/userid')
  @UseGuards(SessionAuthGuard)
  async queryUserId(@CurrentUserId() userId: string) {
    return { result: 0, userId };
  }

  @Get('liked/list/detail')
  @UseGuards(SessionAuthGuard)
  async likedListDetail(@CurrentUserId() userId: string) {
    return { result: 0, ...(await this.usersService.queryLikedListDetail(userId)) };
  }

  @Post('wxlogin')
  wxLogin() {
    return { result: 0 };
  }

  @Post('apply/reigset')
  async applyRegister(@Body() body: ApplyRegisterDto) {
    return this.usersService.applyRegister(body.account);
  }

  @Get('check/in/registerlist')
  async checkRegisterList(@Query('account') account: string) {
    return this.usersService.checkInRegisterList(account);
  }

  @Get('release/register')
  async releaseRegister(@Query('count') count?: string) {
    return this.usersService.releaseRegister(Number(count ?? 0));
  }

  @Get('check/has/info')
  @UseGuards(SessionAuthGuard)
  async checkHasInfo(@CurrentUserId() userId: string) {
    return { hasUserInfo: await this.usersService.checkHasUserInfo(userId) };
  }

  @Get('query/info')
  @UseGuards(SessionAuthGuard)
  async queryInfo(@CurrentUserId() userId: string) {
    const result = await this.usersService.queryOrCreateUserInfo(userId);
    return { result, status: 0 };
  }

  @Get('query/more/detail')
  @UseGuards(SessionAuthGuard)
  async queryMoreDetail(@CurrentUserId() userId: string) {
    return { result: 0, ...(await this.usersService.queryMoreDetail(userId, true)) };
  }

  @Post('query/user_name/repeat')
  async queryUserNameRepeat(@Body() body: QueryUserNameDto) {
    return { enable: await this.usersService.checkUserNameRepeat(body.user_name) };
  }

  @Get('query/friends')
  @UseGuards(SessionAuthGuard)
  async queryFriends(@CurrentUserId() userId: string) {
    return { status: 0, list: await this.usersService.queryFriends(userId) };
  }

  @Post('update/info')
  async updateInfo(@Body() body: UpdateInfoDto) {
    await this.usersService.updateInfo(body);
    return { status: 0 };
  }

  @Post('add/friend')
  @UseGuards(SessionAuthGuard)
  async addFriend(@CurrentUserId() userId: string, @Body() body: AddFriendDto) {
    await this.usersService.addFriend(userId, body.target_user_id);
    return { status: 0 };
  }

  @Get('read/all/notes')
  @UseGuards(SessionAuthGuard)
  async readAllNotes(@CurrentUserId() userId: string) {
    await this.usersService.readAllNotes(userId);
    return { status: 0 };
  }

  @Post('update/friend')
  @UseGuards(SessionAuthGuard)
  async updateFriend(@CurrentUserId() userId: string, @Body() body: UpdateFriendDto) {
    await this.usersService.updateFriend(userId, body.user_id, body.approval);
    return { status: 0 };
  }

  @Post('query/user/byname')
  async queryUserByName(@Body() body: QueryUserNameDto) {
    return { stauts: 0, list: await this.usersService.queryUserByName(body.user_name) };
  }

  @Get('query/info/by/userid')
  async queryInfoByUserId(@Query('user_id') userId: string) {
    return { stauts: 0, result: await this.usersService.queryInfoByUserId(userId) };
  }

  @Get('query/more/detail/by/userid')
  async queryMoreDetailByUserId(@Query('user_id') userId: string) {
    return { result: 0, ...(await this.usersService.queryMoreDetail(userId, true)) };
  }

  @Get('query/full/detail/by/userid')
  async queryFullDetailByUserId(
    @Query('user_id') userId: string | undefined,
    @Headers('session_token') token?: string,
  ) {
    const targetUserId = userId || (await this.usersService.getUserIdByToken(token)) || '';
    return { result: 0, ...(await this.usersService.queryMoreDetail(targetUserId, false)) };
  }

  @Get('get/verify/code')
  async getVerifyCode(@Query('account') account: string) {
    const code = await this.usersService.sendAccountVerifyCode(account);
    return { result: 0, code: md5(code) };
  }
}


