import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Client, * as $dysmsapi from '@alicloud/dysmsapi20170525';
import * as $OpenApi from '@alicloud/openapi-client';

@Injectable()
export class SmsService {
  private client: Client | null = null;

  constructor(private readonly configService: ConfigService) {}

  async sendVerifyCode(mobile: string) {
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    await this.sendSmsCode(mobile, code);
    return code;
  }

  async sendRegisterNotice(mobile: string) {
    await this.sendSmsCode(mobile, '0000');
  }

  private getClient() {
    if (!this.client) {
      const config = new $OpenApi.Config({
        accessKeyId: this.configService.get<string>('app.aliyunAccessKeyId', ''),
        accessKeySecret: this.configService.get<string>('app.aliyunAccessKeySecret', ''),
      });
      console.log({
        accessKeyId: this.configService.get<string>('app.aliyunAccessKeyId', ''),
        accessKeySecret: this.configService.get<string>('app.aliyunAccessKeySecret', ''),
      })
      config.endpoint = 'dysmsapi.aliyuncs.com'
      this.client = new Client(config);
    }

    return this.client;
  }

  private async sendSmsCode(mobile: string, code: string) {
    const request = new $dysmsapi.SendSmsRequest({
      phoneNumbers: mobile,
      signName: this.configService.get<string>('app.aliyunSmsSignName', '天津易比达教育科技'),
      templateCode: this.configService.get<string>('app.aliyunSmsTemplateCode', 'SMS_486090102'),
      templateParam: JSON.stringify({ code }),
    });
    console.log({
      phoneNumbers: mobile,
      signName: this.configService.get<string>('app.aliyunSmsSignName', '天津易比达教育科技'),
      templateCode: this.configService.get<string>('app.aliyunSmsTemplateCode', 'SMS_486090102'),
      templateParam: JSON.stringify({ code }),
    })
    await this.getClient().sendSms(request);
  }
}
