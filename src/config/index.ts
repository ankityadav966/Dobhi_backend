import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret',
    expire: process.env.JWT_EXPIRE || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your_refresh_secret',
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '30d',
  },
  
  otp: {
    expire: parseInt(process.env.OTP_EXPIRE || '600'),
    provider: (process.env.OTP_PROVIDER || 'twilio').toLowerCase(),
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      apiKeySid: process.env.TWILIO_API_KEY_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    },
    msg91: {
      authKey: process.env.MSG91_AUTH_KEY,
      templateId: process.env.MSG91_TEMPLATE_ID,
      baseUrl: 'https://control.msg91.com/api/v5/flow/',
    },
  },
  
  database: {
    url: process.env.DATABASE_URL,
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3Bucket: process.env.AWS_S3_BUCKET,
  },
  
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },
  
  idfy: {
    apiKey: process.env.IDFY_API_KEY,
    accountId: process.env.IDFY_ACCOUNT_ID,
    baseUrl: process.env.IDFY_BASE_URL || 'https://eve.idfy.com/v3',
  },
};
