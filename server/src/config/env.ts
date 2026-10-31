import dotenv from 'dotenv';
import path from 'path';

// Pre-load environment variables from server/.env before any other module imports
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

