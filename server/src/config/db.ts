import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import dns from 'dns';

// Fix Node.js Windows SRV DNS resolution (querySrv ECONNREFUSED)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if DNS server override not permitted
}

let mongoMemoryServer: MongoMemoryServer | null = null;

export const connectDB = async (): Promise<string> => {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      await mongoose.connect(uri);
      console.log('[Database] Successfully connected to MongoDB Atlas');
      return uri;
    } catch (error: any) {
      console.error('[Database] Failed to connect to MONGODB_URI (MongoDB Atlas):', error.message || error);
      throw error;
    }
  }

  // Fallback to MongoMemoryServer
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
