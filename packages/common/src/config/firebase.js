import admin from "firebase-admin";
import { readFileSync } from "fs";

const serviceAccount = process.env.FIREBASE_PRIVATE_KEY
  ? {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }
  : JSON.parse(readFileSync("./ydays-reservation-firebase-adminsdk-fbsvc-e38bba35aa.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

export default admin;

