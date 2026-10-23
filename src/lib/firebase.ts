import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Use the firestoreDatabaseId from the config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  const jsonError = JSON.stringify(errInfo);
  console.error('Firestore Error: ', jsonError);
  throw new Error(jsonError);
}

// Anonymous auth for preview purposes handled in AuthContext

export function formatFirebaseTimestamp(timestamp: any): string {
  if (!timestamp) return new Date().toISOString();
  
  // If it's a Firestore Timestamp (has toDate method)
  if (timestamp && typeof timestamp.toDate === 'function') {
    try {
      return timestamp.toDate().toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  }
  
  // If it's a numeric timestamp object (seconds/nanoseconds)
  if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
    try {
      return new Date(timestamp.seconds * 1000).toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  }
  
  // If it's already a Date object
  if (timestamp instanceof Date) {
    try {
      return timestamp.toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  }

  // If it's a string or number
  try {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch (e) {
    // Fall through
  }
  
  return new Date().toISOString();
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
