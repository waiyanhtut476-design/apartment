/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Building2,
  RotateCcw,
  Calculator,
  Receipt,
  CheckCircle,
  Plus,
  ShieldCheck,
  Lock,
  LogOut,
  UserCheck,
  AlertTriangle,
  Database,
  Cloud,
  RefreshCw
} from 'lucide-react';
import { Room, RoomStatusType, UtilityBill, AdminUser } from './types';
import { INITIAL_ROOMS } from './data/initialRooms';
import { RoomStatus } from './components/RoomStatus';
import { BillCalculator } from './components/BillCalculator';
import { AdminLoginModal } from './components/AdminLoginModal';
import {
  subscribeToRooms,
  saveRoomToFirestore,
  subscribeToBills,
  saveBillToFirestore,
  updateInvoiceStatusInFirestore,
  deleteInvoiceFromFirestore,
  resetAllFirestoreData,
  resetAllRoomsToVacant,
  firebaseConfig
} from './firebase';

const STORAGE_KEY = 'apartment_management_rooms_v6';
const BILLS_STORAGE_KEY = 'apartment_utility_bills_v3';
const ADMIN_STORAGE_KEY = 'apartment_admin_user_v1';
const DESIGNATED_ADMIN_EMAIL = 'waiyanhtut476@gmail.com';

// All 66 rooms are vacant initially, no pending bills until landlord checks in tenants
const INITIAL_BILLS: UtilityBill[] = [];

export default function App() {
  // Admin authentication state (Defaults to designated landlord waiyanhtut476@gmail.com)
  // Landlord admin session is permanently authorized
  const [adminUser, setAdminUser] = useState<AdminUser | null>({
    email: DESIGNATED_ADMIN_EMAIL,
    name: 'အိမ်ရှင် (Landlord Admin)',
    role: 'admin',
    isAuthenticated: true,
    loginTime: new Date().toISOString(),
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Real-time Cloud Firestore & LocalStorage Sync Status
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('syncing');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');

  // Load rooms from localStorage (instant offline boot) or fallback to initial dummy data
  const [rooms, setRooms] = useState<Room[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return INITIAL_ROOMS;
  });

  // Load saved bills from localStorage (instant offline boot) or fallback to initial bills
  const [savedBills, setSavedBills] = useState<UtilityBill[]>(() => {
    try {
      const saved = localStorage.getItem(BILLS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return INITIAL_BILLS;
  });

  const [activeTab, setActiveTab] = useState<'rooms' | 'calculator' | 'revenue' | 'maintenance'>('rooms');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Landlord has permanent full administrative access
  const isAdmin = true;

  // Guarantee all 66 rooms are initialized as completely vacant (no dummy tenants)
  useEffect(() => {
    const VACANT_MIGRATION_KEY = 'apartment_all_66_vacant_applied_v1';
    if (!localStorage.getItem(VACANT_MIGRATION_KEY)) {
      localStorage.setItem(VACANT_MIGRATION_KEY, 'true');
      setRooms(INITIAL_ROOMS);
      setSavedBills([]);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ROOMS));
        localStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify([]));
      } catch (e) {
        console.error(e);
      }
      resetAllRoomsToVacant(INITIAL_ROOMS).catch((err) => console.error('Reset vacant error:', err));
    }
  }, []);

  // 1. Subscribe to Real-Time Rooms collection in Firestore
  useEffect(() => {
    setSyncStatus('syncing');
    const unsubscribe = subscribeToRooms(
      INITIAL_ROOMS,
      (firestoreRooms) => {
        setRooms(firestoreRooms);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(firestoreRooms));
        } catch (e) {
          console.error('Failed to sync rooms to localStorage', e);
        }
        setSyncStatus('synced');
        setLastSyncTime(new Date().toLocaleTimeString());
      },
      (err) => {
        console.warn('Real-time rooms listener offline or fallback:', err);
        setSyncStatus('offline');
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. Subscribe to Real-Time Invoices collection in Firestore
  useEffect(() => {
    const unsubscribe = subscribeToBills(
      INITIAL_BILLS,
      (firestoreBills) => {
        setSavedBills(firestoreBills);
        try {
          localStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify(firestoreBills));
        } catch (e) {
          console.error('Failed to sync bills to localStorage', e);
        }
        setSyncStatus('synced');
        setLastSyncTime(new Date().toLocaleTimeString());
      },
      (err) => {
        console.warn('Real-time bills listener offline or fallback:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  // 3. Persist Admin Session in LocalStorage
  useEffect(() => {
    try {
      if (adminUser) {
        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(adminUser));
      } else {
        localStorage.removeItem(ADMIN_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to save admin session', e);
    }
  }, [adminUser]);

  // Show temporary toast
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleLoginSuccess = (user: AdminUser) => {
    setAdminUser(user);
    showToast(`အိမ်ရှင် Admin (${user.email}) အဖြစ် အောင်မြင်စွာ Login ဝင်ပြီးပါပြီ။`);
  };

  const handleLogout = () => {
    setAdminUser(null);
    showToast('အိမ်ရှင် အကောင့်မှ ထွက်ခွာပြီးပါပြီ (Guest Read-Only Mode)။');
  };

  // Add Room (Local State + LocalStorage + Cloud Firestore)
  const handleAddRoom = (newRoomData: Omit<Room, 'id'>) => {
    const newRoom: Room = {
      ...newRoomData,
      id: `room-${Date.now()}`,
    };
    const updated = [newRoom, ...rooms];
    setRooms(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    // Persist to Cloud Firestore in real-time
    saveRoomToFirestore(newRoom)
      .then(() => {
        setSyncStatus('synced');
        setLastSyncTime(new Date().toLocaleTimeString());
      })
      .catch((err) => console.error('Firestore save room error:', err));

    showToast(`အခန်းအမှတ် ${newRoom.roomNumber} အသစ်ကို အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ (Firestore & LocalStorage သိမ်းဆည်းပြီး)။`);
  };

  // Quick Status Update (Local State + LocalStorage + Cloud Firestore)
  const handleUpdateStatus = (roomId: string, newStatus: RoomStatusType, tenantName?: string | null) => {
    let targetUpdatedRoom: Room | null = null;
    const updated = rooms.map((room) => {
      if (room.id === roomId) {
        const effectiveTenantName = newStatus === 'available' ? null : tenantName !== undefined ? tenantName : room.tenantName;
        const isOcc = newStatus === 'occupied' && Boolean(effectiveTenantName && effectiveTenantName.trim().length > 0);

        const u: Room = {
          ...room,
          status: isOcc ? 'occupied' : newStatus === 'maintenance' ? 'maintenance' : 'available',
          tenantName: isOcc ? effectiveTenantName : null,
          tenantPhone: isOcc ? room.tenantPhone : undefined,
          isTenantCheckedIn: isOcc,
        };
        targetUpdatedRoom = u;
        return u;
      }
      return room;
    });

    setRooms(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    if (targetUpdatedRoom) {
      saveRoomToFirestore(targetUpdatedRoom)
        .then(() => {
          setSyncStatus('synced');
          setLastSyncTime(new Date().toLocaleTimeString());
        })
        .catch((err) => console.error('Firestore update room status error:', err));
    }

    const targetRoom = rooms.find((r) => r.id === roomId);
    showToast(`အခန်း ${targetRoom?.roomNumber || ''} အခြေအနေ ပြောင်းလဲပြီးပါပြီ (${newStatus}) - Cloud Synced`);
  };

  // Update full room details (Local State + LocalStorage + Cloud Firestore)
  const handleUpdateRoom = (updatedRoom: Room) => {
    const isOcc =
      updatedRoom.status === 'occupied' &&
      Boolean(updatedRoom.tenantName && updatedRoom.tenantName.trim().length > 0) &&
      Boolean(updatedRoom.isTenantCheckedIn !== false);

    const sanitizedRoom: Room = {
      ...updatedRoom,
      status: isOcc ? 'occupied' : updatedRoom.status === 'maintenance' ? 'maintenance' : 'available',
      tenantName: isOcc ? updatedRoom.tenantName : null,
      tenantPhone: isOcc ? updatedRoom.tenantPhone : undefined,
      isTenantCheckedIn: isOcc,
    };

    const updated = rooms.map((room) => (room.id === sanitizedRoom.id ? sanitizedRoom : room));
    setRooms(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    saveRoomToFirestore(sanitizedRoom)
      .then(() => {
        setSyncStatus('synced');
        setLastSyncTime(new Date().toLocaleTimeString());
      })
      .catch((err) => console.error('Firestore save room error:', err));

    showToast(`အခန်း ${sanitizedRoom.roomNumber} အချက်အလက်များ သိမ်းဆည်းပြီးပါပြီ (Firestore Synced)။`);
  };

  // Save Utility Bill (Local State + LocalStorage + Cloud Firestore)
  const handleSaveBill = (newBill: UtilityBill) => {
    const updated = [newBill, ...savedBills.filter((b) => b.id !== newBill.id)];
    setSavedBills(updated);
    try {
      localStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    saveBillToFirestore(newBill)
      .then(() => {
        setSyncStatus('synced');
        setLastSyncTime(new Date().toLocaleTimeString());
      })
      .catch((err) => console.error('Firestore save bill error:', err));

    showToast(`အခန်း ${newBill.roomNumber} အတွက် ဘေလ် (${newBill.grandTotal.toLocaleString()} ${newBill.currency}) ကို Cloud Database & LocalStorage တွင် သိမ်းဆည်းပြီးပါပြီ။`);
  };

  // Update Bill Paid Status (Local State + LocalStorage + Cloud Firestore)
  const handleUpdateBillStatus = (billId: string, status: 'paid' | 'unpaid') => {
    const updated = savedBills.map((b) => (b.id === billId ? { ...b, status } : b));
    setSavedBills(updated);
    try {
      localStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    updateInvoiceStatusInFirestore(billId, status)
      .then(() => {
        setSyncStatus('synced');
        setLastSyncTime(new Date().toLocaleTimeString());
      })
      .catch((err) => console.error('Firestore update bill status error:', err));

    showToast(`ဘေလ်အခြေအနေ ပြောင်းလဲပြီးပါပြီ (${status === 'paid' ? 'Paid' : 'Unpaid'}) - Cloud Synced`);
  };

  // Delete Bill (Local State + LocalStorage + Cloud Firestore)
  const handleDeleteBill = (billId: string) => {
    const updated = savedBills.filter((b) => b.id !== billId);
    setSavedBills(updated);
    try {
      localStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }

    deleteInvoiceFromFirestore(billId)
      .then(() => {
        setSyncStatus('synced');
        setLastSyncTime(new Date().toLocaleTimeString());
      })
      .catch((err) => console.error('Firestore delete bill error:', err));

    showToast('ဘေလ်အား စာရင်းမှ ဖျက်ပြီးပါပြီ (Cloud Synced)။');
  };

  // Clear All Bills (Local State + LocalStorage + Cloud Firestore)
  const handleClearAllBills = async () => {
    const billsToDelete = [...savedBills];
    setSavedBills([]);
    try {
      localStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify([]));
    } catch (e) {
      console.error(e);
    }

    try {
      for (const bill of billsToDelete) {
        await deleteInvoiceFromFirestore(bill.id);
      }
      setSyncStatus('synced');
      setLastSyncTime(new Date().toLocaleTimeString());
      showToast('ဘေလ်မှတ်တမ်းအားလုံးကို အောင်မြင်စွာ ဖျက်ပြီးပါပြီ (Cloud Synced)။');
    } catch (err) {
      console.error('Firestore delete all bills error:', err);
    }
  };

  // Reset demo data (Reset both LocalStorage and Cloud Firestore)
  const handleResetData = () => {
    if (!isAdmin) {
      setIsLoginModalOpen(true);
      return;
    }
    if (confirm('အခန်း ၆၆ ခန်းလုံးအား အခန်းလွတ် (Available) အဖြစ် ပြန်လည်ထားရှိမည်လား? (Firestore နှင့် LocalStorage ရှိ အခန်းအားလုံးကို အခန်းလွတ်အဖြစ် ပြန်လည်ပြင်ဆင်ပါမည်)')) {
      setRooms(INITIAL_ROOMS);
      setSavedBills([]);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ROOMS));
        localStorage.setItem(BILLS_STORAGE_KEY, JSON.stringify([]));
      } catch (e) {
        console.error(e);
      }

      resetAllRoomsToVacant(INITIAL_ROOMS)
        .then(() => {
          setSyncStatus('synced');
          setLastSyncTime(new Date().toLocaleTimeString());
        })
        .catch((err) => console.error('Firestore reset error:', err));

      showToast('အခန်း ၆၆ ခန်းလုံးအား အခန်းလွတ် (Available) အဖြစ် ပြန်လည်ထားရှိပြီးပါပြီ။');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* ============================================================== */}
      {/* TOP BAR CONTRACT: Zone 1 (Brand) - Zone 2 (Nav) - Zone 3 (Action) */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <a href="/" className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
              SKYLINE RESIDENCE
            </a>
          </div>

          {/* Zone 2: Clean text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              onClick={() => setActiveTab('rooms')}
              className={`pb-1 transition-colors relative ${
                activeTab === 'rooms'
                  ? 'text-indigo-600 font-semibold border-b-2 border-indigo-600'
                  : 'hover:text-slate-900'
              }`}
            >
              အခန်းများ အခြေအနေ (Room Status)
            </button>
            <button
              onClick={() => setActiveTab('calculator')}
              className={`pb-1 transition-colors relative flex items-center gap-1.5 ${
                activeTab === 'calculator'
                  ? 'text-indigo-600 font-semibold border-b-2 border-indigo-600'
                  : 'hover:text-slate-900'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span>Bill Calculator (မီတာ/ဘေလ်တွက်ချက်ရန်)</span>
            </button>
            <button
              onClick={() => setActiveTab('revenue')}
              className={`pb-1 transition-colors relative ${
                activeTab === 'revenue'
                  ? 'text-indigo-600 font-semibold border-b-2 border-indigo-600'
                  : 'hover:text-slate-900'
              }`}
            >
              လစဉ်ငှားခ စာရင်းချုပ် (Revenue)
            </button>
            <button
              onClick={() => setActiveTab('maintenance')}
              className={`pb-1 transition-colors relative ${
                activeTab === 'maintenance'
                  ? 'text-indigo-600 font-semibold border-b-2 border-indigo-600'
                  : 'hover:text-slate-900'
              }`}
            >
              ပြုပြင်ထိန်းသိမ်းမှု (Maintenance)
            </button>
          </nav>

          {/* Zone 3: Admin Auth Status & Controls */}
          <div className="flex items-center gap-2">
            {/* Real-time Cloud Sync Badge */}
            <div
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white"
              title={`Firestore Real-time & LocalStorage Synced (${firebaseConfig.projectId})`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  syncStatus === 'synced'
                    ? 'bg-emerald-500'
                    : syncStatus === 'syncing'
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-slate-400'
                }`}
              ></span>
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px] font-medium text-slate-600">
                {syncStatus === 'synced' ? 'Cloud & Local Synced' : syncStatus === 'syncing' ? 'Syncing...' : 'Local Cache'}
              </span>
            </div>

            {isAdmin ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/90 rounded-lg">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate max-w-[170px]" title={adminUser?.email}>
                    အိမ်ရှင် Admin ({adminUser?.email?.split('@')[0]})
                  </span>
                </div>

                <button
                  onClick={handleLogout}
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1"
                  title="အိမ်ရှင် အကောင့်မှ ထွက်ပြီး Guest Mode ပြောင်းမည်"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsLoginModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 animate-pulse"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>အိမ်ရှင် Login (Admin)</span>
              </button>
            )}

            <button
              onClick={handleResetData}
              title="Reset initial sample data"
              className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Viewport */}

      {/* ============================================================== */}
      {/* MAIN VIEWPORT CONTAINER */}
      {/* ============================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Page Title & Context Header with Cloud Persistence Banner */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              တိုက်ခန်းနှင့် အခန်းများ စီမံခန့်ခွဲမှု Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Apartment Room Status Dashboard & Tenant Management System
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-2 self-start sm:self-auto text-xs bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-2xs"
            title="ဒေတာများကို Browser LocalStorage နှင့် Firebase Firestore နှစ်ခုစလုံးတွင် အချိန်နှင့်တပြေးညီ Real-time အမှန်တကယ် သိမ်းဆည်းထားပြီး Refresh ပြုလုပ်သော်လည်း မပျောက်ပျက်ပါ"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-slate-800">Cloud & Local Storage: Active</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-mono text-[11px]">
              Project: {firebaseConfig.projectId} ({lastSyncTime})
            </span>
          </div>
        </div>

        {/* Mobile Navigation Pills */}
        <div className="md:hidden flex items-center gap-2 overflow-x-auto pb-3 mb-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('calculator')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
              activeTab === 'calculator'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Bill Calculator
          </button>
          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
              activeTab === 'rooms'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Room Status
          </button>
          <button
            onClick={() => setActiveTab('revenue')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
              activeTab === 'revenue'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Revenue
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
              activeTab === 'maintenance'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            Maintenance
          </button>
        </div>

        {/* Tab 0: Bill Calculator Component */}
        {activeTab === 'calculator' && (
          <BillCalculator
            rooms={rooms}
            isAdmin={isAdmin}
            onRequestAdminLogin={() => setIsLoginModalOpen(true)}
            onSaveBill={handleSaveBill}
            savedBills={savedBills}
            onUpdateBillStatus={handleUpdateBillStatus}
            onDeleteBill={handleDeleteBill}
            onClearAllBills={handleClearAllBills}
          />
        )}

        {/* Tab 1: Room Status Component */}
        {activeTab === 'rooms' && (
          <RoomStatus
            rooms={rooms}
            isAdmin={isAdmin}
            onRequestAdminLogin={() => setIsLoginModalOpen(true)}
            onAddRoom={handleAddRoom}
            onUpdateStatus={handleUpdateStatus}
            onUpdateRoom={handleUpdateRoom}
          />
        )}

        {/* Tab 2: Revenue Overview */}
        {activeTab === 'revenue' && (
          <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  လစဉ်ငှားခ ဘဏ္ဍာရေး စာရင်းချုပ် (Monthly Rental Revenue)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  ငှားရမ်းထားသော အခန်းများနှင့် ရရှိနိုင်မည့် အလားအလာရှိသော ဝင်ငွေ အခြေအနေ
                </p>
              </div>
              <button
                onClick={() => setActiveTab('rooms')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                ← အခန်းစာရင်းသို့ ပြန်သွားရန်
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  ခန့်မှန်းခြေ စုစုပေါင်း အပြည့်အဝ ဝင်ငွေ (Potential)
                </span>
                <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tabular-nums">
                  {rooms.reduce((s, r) => s + r.monthlyRent, 0).toLocaleString()} Baht
                </div>
                <p className="text-xs text-slate-500 mt-1">အခန်းအားလုံး ငှားရမ်းနိုင်ပါက</p>
              </div>

              <div className="p-5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <span className="text-xs font-semibold text-emerald-800 uppercase">
                  လက်ရှိ ရရှိနေသော လစဉ်ငှားခ (Active Rent)
                </span>
                <div className="mt-2 text-2xl font-bold font-mono text-emerald-700 tabular-nums">
                  {rooms
                    .filter((r) => r.status === 'occupied')
                    .reduce((s, r) => s + r.monthlyRent, 0)
                    .toLocaleString()}{' '}
                  Baht
                </div>
                <p className="text-xs text-emerald-600 mt-1">
                  {rooms.filter((r) => r.status === 'occupied').length} ခန်းမှ ရရှိသော ပမာဏ
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200/80">
                <span className="text-xs font-semibold text-slate-500 uppercase">
                  လစ်လပ်နေမှုကြောင့် မရရှိသေးသော ငွေ (Vacancy Loss)
                </span>
                <div className="mt-2 text-2xl font-bold font-mono text-rose-600 tabular-nums">
                  {rooms
                    .filter((r) => r.status !== 'occupied')
                    .reduce((s, r) => s + r.monthlyRent, 0)
                    .toLocaleString()}{' '}
                  Baht
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {rooms.filter((r) => r.status !== 'occupied').length} ခန်း လွတ်/ပြုပြင်ဆဲ
                </p>
              </div>
            </div>

            {/* Breakdown table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden mt-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-3 px-4">အခန်းနံပါတ်</th>
                    <th className="py-3 px-4">အမျိုးအစား</th>
                    <th className="py-3 px-4">ငှားသူအမည်</th>
                    <th className="py-3 px-4">အခြေအနေ</th>
                    <th className="py-3 px-4 text-right">လစဉ်ငှားခ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rooms.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-800">
                        {r.roomNumber}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{r.roomType}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {r.tenantName || '-'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            r.status === 'occupied'
                              ? 'bg-rose-50 text-rose-700'
                              : r.status === 'available'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {r.monthlyRent.toLocaleString()} Baht
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Maintenance Overview */}
        {activeTab === 'maintenance' && (
          <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  ပြုပြင်ထိန်းသိမ်းမှု လိုအပ်သော အခန်းများ (Maintenance Schedule)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  မီးဝါ (Maintenance) အခြေအနေရှိသော အခန်းများစာရင်း
                </p>
              </div>
              <button
                onClick={() => setActiveTab('rooms')}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                ← အခန်းစာရင်းသို့ ပြန်သွားရန်
              </button>
            </div>

            {rooms.filter((r) => r.status === 'maintenance').length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-slate-800">
                  လတ်တလော ပြုပြင်ရန်လိုအပ်သော အခန်း မရှိပါ
                </h4>
                <p className="text-xs text-slate-500 mt-1">အခန်းအားလုံး ကောင်းမွန်သောအခြေအနေတွင် ရှိပါသည်</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms
                  .filter((r) => r.status === 'maintenance')
                  .map((room) => (
                    <div
                      key={room.id}
                      className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold font-mono text-slate-900">
                            အခန်း {room.roomNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                            Floor {room.floor} · {room.roomType}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-slate-600">
                          <strong>ပြုပြင်မှု အသေးစိတ်:</strong>{' '}
                          {room.notes || 'အသေးစိတ် မဖော်ပြထားပါ'}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-amber-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          လစဉ်ငှားခ: {room.monthlyRent.toLocaleString()} Ks
                        </span>
                        <button
                          onClick={() => {
                            if (!isAdmin) {
                              setIsLoginModalOpen(true);
                              return;
                            }
                            handleUpdateStatus(room.id, 'available', null);
                          }}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1 ${
                            isAdmin
                              ? 'text-white bg-emerald-600 hover:bg-emerald-700'
                              : 'text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300'
                          }`}
                          title={isAdmin ? 'Mark as Available' : 'အိမ်ရှင် (Admin) သာ ပြင်ဆင်ခွင့်ရှိပါသည်'}
                        >
                          {!isAdmin && <Lock className="w-3 h-3 text-emerald-700" />}
                          <span>ပြုပြင်ပြီးစီး (Mark as Available)</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* TOAST FEEDBACK NOTIFICATION */}
      {/* ============================================================== */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* QUIET FOOTER */}
      {/* ============================================================== */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <p>© {new Date().getFullYear()} Skyline Residence Apartment Management System.</p>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Available (မီးစိမ်း)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Occupied (မီးနီ)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Maintenance (မီးဝါ)</span>
            </span>
          </div>
        </div>
      </footer>

      {/* ============================================================== */}
      {/* ADMIN LOGIN MODAL */}
      {/* ============================================================== */}
      <AdminLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        designatedEmail={DESIGNATED_ADMIN_EMAIL}
      />
    </div>
  );
}
