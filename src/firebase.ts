import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Room } from './types';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Must pass firebaseConfig.firestoreDatabaseId to getFirestore
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export { firebaseConfig };
export const isPlaceholderConfig = false;

// Error Handling conforming to Firebase Integration standard
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot as required by skill guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase Firestore connection tested successfully for project: ', firebaseConfig.projectId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export interface InvoiceData {
  room: string;
  month: string;
  tenantName: string | null;
  roomRent: number;
  electricity: {
    previousUnit: number;
    currentUnit: number;
    unitsUsed: number;
    rate: number;
    amount: number;
  };
  water: {
    previousUnit: number;
    currentUnit: number;
    unitsUsed: number;
    rate: number;
    amount: number;
  };
  commonFee: number;
  totalAmount: number;
  currency: string;
  status: 'Pending' | 'Paid';
  notes?: string;
  createdAt?: unknown;
}

/**
 * Save invoice to Firestore `invoices` collection
 */
export async function saveInvoiceToFirestore(invoiceData: InvoiceData): Promise<{
  success: boolean;
  id: string;
  isSimulated: boolean;
  message: string;
}> {
  const path = 'invoices';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...invoiceData,
      createdAt: serverTimestamp(),
    });
    return {
      success: true,
      id: docRef.id,
      isSimulated: false,
      message: `Firebase Firestore (Project: ${firebaseConfig.projectId}) ထဲသို့ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

/**
 * Fetch all invoices from Firestore `invoices` collection
 */
export async function fetchInvoicesFromFirestore(): Promise<(InvoiceData & { id: string })[]> {
  const path = 'invoices';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as InvoiceData),
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

/**
 * Update invoice payment status in Firestore
 */
export async function updateInvoiceStatusInFirestore(invoiceId: string, status: 'Pending' | 'Paid') {
  const path = `invoices/${invoiceId}`;
  try {
    await updateDoc(doc(db, 'invoices', invoiceId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Delete invoice from Firestore
 */
export async function deleteInvoiceFromFirestore(invoiceId: string) {
  const path = `invoices/${invoiceId}`;
  try {
    await deleteDoc(doc(db, 'invoices', invoiceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Sync Room to Firestore
 */
export async function saveRoomToFirestore(room: Room) {
  const path = `rooms/${room.id}`;
  try {
    await setDoc(doc(db, 'rooms', room.id), {
      ...room,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
