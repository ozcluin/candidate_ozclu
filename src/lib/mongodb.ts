import { MongoClient, Db } from "mongodb";
import dns from "dns";
import { validateEnvironment } from "./envGuard";

// Use Google DNS to resolve MongoDB Atlas SRV records
// (the default local DNS may not support SRV lookups)
try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch {
  // Ignore — some serverless runtimes don't support dns.setServers
}

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;
let envValidated = false;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  const uri = process.env.MONGODB_URI || "";
  if (!uri) {
    throw new Error("Please add your MongoDB URI to .env.local");
  }
  if (!client) {
    client = new MongoClient(uri);
    clientPromise = client.connect();
  }
  const connectedClient = await clientPromise!;
  const db = connectedClient.db("clusoverify");

  if (!envValidated) {
    validateEnvironment();
    envValidated = true;
  }

  return { client: connectedClient, db };
}
