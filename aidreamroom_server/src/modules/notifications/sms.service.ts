import * as http from 'http';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  constructor(private readonly configService: ConfigService) {}

  async sendVerifyCode(mobile: string) {
    const code = String(Math.floor(Math.random() * 10000)).padEnd(4, '0');
    const content = `您的验证码是：${code}。请不要把验证码泄露给其他人。`;
    await this.sendSms(mobile, content);
    return code;
  }

  async sendRegisterNotice(mobile: string) {
    const content =
      '尊敬的无限星球用户您好，感谢您的等待，您已经获得注册资格，请尽快前往官网完成注册。';
    await this.sendSms(mobile, content);
  }

  private async sendSms(mobile: string, content: string) {
    const account = this.configService.get<string>('app.smsAccount', '');
    const password = this.configService.get<string>('app.smsPassword', '');
    const hostname = this.configService.get<string>('app.smsHost', '106.ihuyi.com');
    const port = this.configService.get<number>('app.smsPort', 80);
    const path = this.configService.get<string>('app.smsPath', '/webservice/sms.php?method=Submit');
    const payload = `account=${encodeURIComponent(account)}&password=${encodeURIComponent(password)}&mobile=${encodeURIComponent(mobile)}&content=${encodeURIComponent(content)}`;

    await new Promise<void>((resolve, reject) => {
      const request = http.request(
        {
          hostname,
          port,
          path,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (response) => {
          response.on('data', () => undefined);
          response.on('end', () => resolve());
        },
      );

      request.on('error', reject);
      request.write(payload);
      request.end();
    });
  }
}
