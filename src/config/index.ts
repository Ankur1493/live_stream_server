import { config } from 'dotenv';

config({ path: '.env' });

export const CREDENTIALS = process.env.CREDENTIALS === 'true';

export const { NODE_ENV, PORT, LOG_FORMAT, LOG_DIR, ORIGIN, SESSION_KEY } = process.env;

export const { AWS_REGION, AWS_BUCKET_NAME, AWS_SECRET_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } = process.env;
