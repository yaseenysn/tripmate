import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import dns from 'dns';

// Fix Node.js Windows SRV DNS resolution only on Windows OS
if (process.platform === 'win32') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (e) {
    // Ignore if DNS server override not permitted
  }
}

let mongoMemoryServer: MongoMemoryServer | null = null;

export const connectDB = async (): Promise<string> => {
  const uri = process.env.MONGODB_URI;

  if (uri && uri.trim()) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
      console.log('[Database] Successfully connected to MongoDB Atlas');
      return uri;
    } catch (error: any) {
      console.error('[Database] Failed to connect to MONGODB_URI (MongoDB Atlas):', error.message || error);
      console.error('[Database] CRITICAL: If deploying on Render or Cloud, ensure 0.0.0.0/0 (Allow Access From Anywhere) is added under MongoDB Atlas -> Network Access!');
      throw error;
    }
  }

  // Fallback to MongoMemoryServer for local test/dev without MONGODB_URI
  try {
    mongoMemoryServer = await MongoMemoryServer.create();
    const memoryUri = mongoMemoryServer.getUri();
    await mongoose.connect(memoryUri);
    console.log(`[Database] Connected to In-Memory MongoDB at ${memoryUri}`);
    return memoryUri;
  } catch (error) {
    console.error('[Database] Failed to initialize MongoMemoryServer:', error);
    throw error;
  }
};

export const disconnectDB = async () => {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
};
