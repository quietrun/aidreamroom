import { SES } from '@aws-sdk/client-ses';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly transporter;
  private readonly fromName: string;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.fromName = this.configService.get<string>('app.emailFromName', 'AI梦之屋');
    this.fromAddress = this.configService.get<string>('app.emailFromAddress', '');

    const ses = new SES({
      region: this.configService.get<string>('app.sesRegion', 'us-west-1'),
      credentials: {
        accessKeyId: this.configService.get<string>('app.sesAccessKeyId', ''),
        secretAccessKey: this.configService.get<string>('app.sesSecretAccessKey', ''),
      },
    });

    this.transporter = nodemailer.createTransport({
      SES: { ses, aws: { SES } },
    });
  }

  async sendVerifyCode(email: string) {
    const code = String(Math.floor(Math.random() * 1000000)).padEnd(6, '0');
    await this.transporter.sendMail({
      from: `"${this.fromName}" <${this.fromAddress}>`,
      to: email,
      subject: '邮箱验证码',
      html: `
        <p>您好，</p>
        <p>您的验证码是：<strong style="color:red;">${code}</strong>，5分钟内有效。</p>
        <p>如果不是您本人操作，请忽略这封邮件。</p>
      `,
    });

    return code;
  }

  async sendRegisterNotice(email: string) {
    await this.transporter.sendMail({
      from: `"${this.fromName}" <${this.fromAddress}>`,
      to: email,
      subject: '恭喜，您已可以注册',
      html: `
        <p>您好，</p>
        <p>您的 AI 梦之屋注册资格已经开放，请使用排队时填写的账号完成注册。</p>
      `,
    });
  }
}
