import { registerAs } from '@nestjs/config';

const readBoolean = (value: string | undefined, defaultValue = false) => {
  if (value === undefined) {
    return defaultValue;
  }

  return value === 'true' || value === '1';
};

const readNumber = (value: string | undefined, defaultValue: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

export default registerAs('app', () => ({
  port: readNumber(process.env.PORT, 8380),
  legacyWsPort: readNumber(process.env.LEGACY_WS_PORT, 3300),
  enableDailyAnalytics: readBoolean(process.env.ENABLE_DAILY_ANALYTICS, false),
  databaseUrl: process.env.DATABASE_URL ?? '',
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? '',
  autoCharacterModel: process.env.AUTO_CHARACTER_MODEL ?? 'gpt-4o-mini',
  legacyAutoGptEndpoint: process.env.LEGACY_AUTO_GPT_ENDPOINT ?? '',
  bedrockRegion: process.env.BEDROCK_REGION ?? 'us-west-2',
  bedrockAccessKeyId: process.env.BEDROCK_ACCESS_KEY_ID ?? '',
  bedrockSecretAccessKey: process.env.BEDROCK_SECRET_ACCESS_KEY ?? '',
  bedrockModelId:
    process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-3-haiku-20240307-v1:0',
  sesRegion: process.env.SES_REGION ?? 'us-west-1',
  sesAccessKeyId: process.env.SES_ACCESS_KEY_ID ?? '',
  sesSecretAccessKey: process.env.SES_SECRET_ACCESS_KEY ?? '',
  emailFromName: process.env.EMAIL_FROM_NAME ?? 'AI梦之屋',
  emailFromAddress: process.env.EMAIL_FROM_ADDRESS ?? '',
  smsAccount: process.env.SMS_ACCOUNT ?? '',
  smsPassword: process.env.SMS_PASSWORD ?? '',
  smsHost: process.env.SMS_HOST ?? '106.ihuyi.com',
  smsPort: readNumber(process.env.SMS_PORT, 80),
  smsPath: process.env.SMS_PATH ?? '/webservice/sms.php?method=Submit',
  minioEndPoint: process.env.MINIO_END_POINT ?? '127.0.0.1',
  minioPort: readNumber(process.env.MINIO_PORT, 9000),
  minioUseSsl: readBoolean(process.env.MINIO_USE_SSL, false),
  minioAccessKey: process.env.MINIO_ACCESS_KEY ?? '',
  minioSecretKey: process.env.MINIO_SECRET_KEY ?? '',
  minioBucket: process.env.MINIO_BUCKET ?? 'aidreamroom',
  minioImageBucket: process.env.MINIO_IMAGE_BUCKET ?? 'images',
  minioPublicBaseUrl: process.env.MINIO_PUBLIC_BASE_URL ?? '',
}));
