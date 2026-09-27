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
  getDocFromServer,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Room, UtilityBill, RoomStatusType } from './types';

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
}

// Test connection on boot as required by skill guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('Firebase Firestore connection tested successfully for project: ', firebaseConfig.projectId);
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline test connection notice (will retry when online)');
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

// =========================================================================
// REAL-TIME ROOMS SYNC WITH FIRESTORE
// =========================================================================

/**
 * Listen in real-time to the `rooms` collection in Firestore.
 * Automatically seeds initial rooms if collection is empty.
 */
/**
 * Safely sanitizes a Room object for Firestore by converting any undefined to null.
 * Firestore strictly rejects undefined field values.
 */
export function sanitizeRoomForFirestore(room: Room): Record<string, any> {
  return {
    id: room.id,
    roomNumber: room.roomNumber,
    floor: Number(room.floor) || 1,
    roomType: room.roomType || '1 Bedroom',
    monthlyRent: Number(room.monthlyRent) || 0,
    currency: room.currency || 'Baht',
    status: room.status || 'available',
    tenantName: room.tenantName ?? null,
    tenantPhone: room.tenantPhone ?? null,
    leaseStartDate: room.leaseStartDate ?? null,
    leaseEndDate: room.leaseEndDate ?? null,
    notes: room.notes ?? null,
    isTenantCheckedIn: Boolean(room.isTenantCheckedIn),
  };
}

export function subscribeToRooms(
  initialFallbackRooms: Room[],
  onUpdate: (rooms: Room[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const path = 'rooms';
  const roomsRef = collection(db, path);

  const unsubscribe = onSnapshot(
    roomsRef,
    async (snapshot) => {
      // If collection is empty or has fewer than 66 rooms, seed/sync missing rooms
      const existingIds = new Set(snapshot.docs.map((d) => d.id));
      if (initialFallbackRooms.length === 66 && (snapshot.empty || snapshot.docs.length < 66)) {
        console.log('Syncing complete 66 rooms to Firestore...');
        try {
          for (const room of initialFallbackRooms) {
            if (!existingIds.has(room.id)) {
              await setDoc(doc(db, 'rooms', room.id), {
                ...sanitizeRoomForFirestore(room),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          }
        } catch (seedErr) {
          console.error('Failed to seed 66 rooms to Firestore:', seedErr);
        }
      }

      const firestoreRooms: Room[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const floor = Number(data.floor) || 1;
        const defaultRent = floor <= 4 ? 1700 : 1200;
        const monthlyRent =
          typeof data.monthlyRent === 'number' && data.monthlyRent > 0 && data.monthlyRent < 50000
            ? data.monthlyRent
            : defaultRent;

        // A room is ONLY occupied if the landlord has genuinely checked in a tenant with a name
        const isGenuinelyOccupied =
          data.status === 'occupied' &&
          Boolean(data.tenantName && String(data.tenantName).trim().length > 0) &&
          Boolean(data.isTenantCheckedIn);

        // Auto-clean any legacy demo occupied rooms or leftover tenant names in Firestore
        if (!isGenuinelyOccupied && (data.status === 'occupied' || data.tenantName || data.tenantPhone)) {
          setDoc(
            doc(db, 'rooms', docSnap.id),
            {
              status: data.status === 'maintenance' ? 'maintenance' : 'available',
              tenantName: null,
              tenantPhone: null,
              leaseStartDate: null,
              leaseEndDate: null,
              notes: 'အခန်းအလွတ် (အသင့်ငှားရမ်းနိုင်သည်)',
              isTenantCheckedIn: false,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          ).catch(() => {});
        }

        const status: RoomStatusType = isGenuinelyOccupied
          ? 'occupied'
          : data.status === 'maintenance'
          ? 'maintenance'
          : 'available';

        const tenantName = isGenuinelyOccupied ? data.tenantName : null;
        const tenantPhone = isGenuinelyOccupied ? data.tenantPhone : undefined;

        return {
          id: docSnap.id,
          roomNumber: data.roomNumber || '',
          floor,
          roomType: data.roomType || '1 Bedroom',
          monthlyRent,
          currency: 'Baht',
          status,
          tenantName,
          tenantPhone,
          leaseStartDate: isGenuinelyOccupied ? data.leaseStartDate : undefined,
          leaseEndDate: isGenuinelyOccupied ? data.leaseEndDate : undefined,
          notes: isGenuinelyOccupied ? data.notes : 'အခန်းအလွတ် (အသင့်ငှားရမ်းနိုင်သည်)',
          isTenantCheckedIn: isGenuinelyOccupied,
        };
      });

      // Merge so all 66 rooms are guaranteed in state
      const roomMap = new Map<string, Room>();
      for (const r of initialFallbackRooms) {
        roomMap.set(r.id, r);
      }
      for (const r of firestoreRooms) {
        roomMap.set(r.id, r);
      }

      const allRooms = Array.from(roomMap.values());
      allRooms.sort((a, b) => {
        if (a.floor !== b.floor) return a.floor - b.floor;
        return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
      });

      onUpdate(allRooms);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
      if (onError) onError(err);
    }
  );

  return unsubscribe;
}

/**
 * Save or update a Room in Firestore
 */
export async function saveRoomToFirestore(room: Room): Promise<void> {
  const path = `rooms/${room.id}`;
  try {
    await setDoc(
      doc(db, 'rooms', room.id),
      {
        ...sanitizeRoomForFirestore(room),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

/**
 * Delete a Room from Firestore
 */
export async function deleteRoomFromFirestore(roomId: string): Promise<void> {
  const path = `rooms/${roomId}`;
  try {
    await deleteDoc(doc(db, 'rooms', roomId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

// =========================================================================
// REAL-TIME INVOICES / UTILITY BILLS SYNC WITH FIRESTORE
// =========================================================================

/**
 * Listen in real-time to the `invoices` collection in Firestore.
 */
export function subscribeToBills(
  initialFallbackBills: UtilityBill[],
  onUpdate: (bills: UtilityBill[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const path = 'invoices';
  const invoicesQuery = query(collection(db, path), orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(
    invoicesQuery,
    async (snapshot) => {
      if (snapshot.empty && initialFallbackBills.length > 0) {
        console.log('Firestore invoices collection is empty. Seeding initial bills...');
        try {
          for (const bill of initialFallbackBills) {
            await setDoc(doc(db, 'invoices', bill.id), {
              ...bill,
              room: bill.roomNumber,
              month: bill.billMonth,
              totalAmount: bill.grandTotal,
              status: bill.status === 'paid' ? 'Paid' : 'Pending',
              createdAt: serverTimestamp(),
            });
          }
        } catch (seedErr) {
          console.error('Failed to seed bills to Firestore:', seedErr);
        }
        return;
      }

      const firestoreBills: UtilityBill[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const createdAtVal =
          data.createdAt && typeof data.createdAt.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : data.createdAt || new Date().toISOString();

        return {
          id: docSnap.id,
          roomId: data.roomId || `room-${data.roomNumber || data.room}`,
          roomNumber: data.roomNumber || data.room || '',
          tenantName: data.tenantName || null,
          billMonth: data.billMonth || data.month || '',
          createdAt: createdAtVal,
          roomRent: Number(data.roomRent) || 0,
          electricPrev: Number(data.electricPrev) || Number(data.electricity?.previousUnit) || 0,
          electricCurrent: Number(data.electricCurrent) || Number(data.electricity?.currentUnit) || 0,
          electricUnits: Number(data.electricUnits) || Number(data.electricity?.unitsUsed) || 0,
          electricRate: Number(data.electricRate) || Number(data.electricity?.rate) || 10,
          electricTotal: Number(data.electricTotal) || Number(data.electricity?.amount) || 0,
          waterPrev: Number(data.waterPrev) || Number(data.water?.previousUnit) || 0,
          waterCurrent: Number(data.waterCurrent) || Number(data.water?.currentUnit) || 0,
          waterUnits: Number(data.waterUnits) || Number(data.water?.unitsUsed) || 0,
          waterRate: Number(data.waterRate) || Number(data.water?.rate) || 25,
          waterTotal: Number(data.waterTotal) || Number(data.water?.amount) || 0,
          commonFee: Number(data.commonFee) || 100,
          grandTotal: Number(data.grandTotal) || Number(data.totalAmount) || 0,
          currency: data.currency || 'Baht',
          status:
            String(data.status).toLowerCase() === 'paid'
              ? 'paid'
              : 'unpaid',
          notes: data.notes || undefined,
        };
      });

      onUpdate(firestoreBills);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
      if (onError) onError(err);
    }
  );

  return unsubscribe;
}

/**
 * Save Utility Bill to Firestore `invoices` collection
 */
export async function saveBillToFirestore(bill: UtilityBill): Promise<{
  success: boolean;
  id: string;
}> {
  const path = 'invoices';
  try {
    const docData: Record<string, any> = {
      id: bill.id,
      roomId: bill.roomId,
      roomNumber: bill.roomNumber,
      room: bill.roomNumber,
      tenantName: bill.tenantName ?? null,
      billMonth: bill.billMonth,
      month: bill.billMonth,
      createdAtStr: bill.createdAt || new Date().toISOString(),
      roomRent: Number(bill.roomRent) || 0,
      electricPrev: Number(bill.electricPrev) || 0,
      electricCurrent: Number(bill.electricCurrent) || 0,
      electricUnits: Number(bill.electricUnits) || 0,
      electricRate: Number(bill.electricRate) || 10,
      electricTotal: Number(bill.electricTotal) || 0,
      waterPrev: Number(bill.waterPrev) || 0,
      waterCurrent: Number(bill.waterCurrent) || 0,
      waterUnits: Number(bill.waterUnits) || 0,
      waterRate: Number(bill.waterRate) || 25,
      waterTotal: Number(bill.waterTotal) || 0,
      commonFee: Number(bill.commonFee) || 100,
      grandTotal: Number(bill.grandTotal) || 0,
      totalAmount: Number(bill.grandTotal) || 0,
      currency: bill.currency || 'Baht',
      notes: bill.notes ?? null,
      electricity: {
        previousUnit: Number(bill.electricPrev) || 0,
        currentUnit: Number(bill.electricCurrent) || 0,
        unitsUsed: Number(bill.electricUnits) || 0,
        rate: Number(bill.electricRate) || 10,
        amount: Number(bill.electricTotal) || 0,
      },
      water: {
        previousUnit: Number(bill.waterPrev) || 0,
        currentUnit: Number(bill.waterCurrent) || 0,
        unitsUsed: Number(bill.waterUnits) || 0,
        rate: Number(bill.waterRate) || 25,
        amount: Number(bill.waterTotal) || 0,
      },
      status: bill.status === 'paid' ? 'Paid' : 'Pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, path, bill.id), docData);

    return {
      success: true,
      id: bill.id,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

/**
 * Save invoice data (alias for BillCalculator)
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
      updatedAt: serverTimestamp(),
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
 * Fetch all invoices from Firestore
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
export async function updateInvoiceStatusInFirestore(invoiceId: string, status: 'paid' | 'unpaid'): Promise<void> {
  const path = `invoices/${invoiceId}`;
  try {
    await updateDoc(doc(db, 'invoices', invoiceId), {
      status: status === 'paid' ? 'Paid' : 'Pending',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Delete invoice from Firestore
 */
export async function deleteInvoiceFromFirestore(invoiceId: string): Promise<void> {
  const path = `invoices/${invoiceId}`;
  try {
    await deleteDoc(doc(db, 'invoices', invoiceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Reset both Firestore and LocalStorage with initial data
 */
export async function resetAllFirestoreData(initialRooms: Room[], initialBills: UtilityBill[]): Promise<void> {
  // Clear and rewrite rooms
  for (const room of initialRooms) {
    await setDoc(doc(db, 'rooms', room.id), {
      ...sanitizeRoomForFirestore(room),
      updatedAt: serverTimestamp(),
    });
  }
  // Clear and rewrite bills
  for (const bill of initialBills) {
    await setDoc(doc(db, 'invoices', bill.id), {
      ...bill,
      room: bill.roomNumber,
      month: bill.billMonth,
      totalAmount: bill.grandTotal,
      status: bill.status === 'paid' ? 'Paid' : 'Pending',
      updatedAt: serverTimestamp(),
    });
  }
}

/**
 * Reset all rooms to vacant in Firestore
 */
export async function resetAllRoomsToVacant(vacantRooms: Room[]): Promise<void> {
  for (const room of vacantRooms) {
    await setDoc(doc(db, 'rooms', room.id), {
      ...sanitizeRoomForFirestore(room),
      status: 'available',
      tenantName: null,
      tenantPhone: null,
      leaseStartDate: null,
      leaseEndDate: null,
      notes: 'အခန်းအလွတ် (အသင့်ငှားရမ်းနိုင်သည်)',
      isTenantCheckedIn: false,
      updatedAt: serverTimestamp(),
    });
  }
}
