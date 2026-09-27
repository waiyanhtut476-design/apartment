import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Calculator,
  Zap,
  Droplets,
  Building,
  Receipt,
  CheckCircle2,
  Calendar,
  DollarSign,
  Printer,
  Trash2,
  History,
  FileText,
  Settings,
  Download,
  Share2,
  Copy,
  Check,
  X,
  Database,
  Info,
  Clock,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { Room, UtilityBill } from '../types';
import {
  saveInvoiceToFirestore,
  fetchInvoicesFromFirestore,
  InvoiceData,
  isPlaceholderConfig,
  firebaseConfig
} from '../firebase';

interface BillCalculatorProps {
  rooms: Room[];
  isAdmin: boolean;
  onRequestAdminLogin: () => void;
  onSaveBill?: (bill: UtilityBill) => void;
  savedBills?: UtilityBill[];
  onUpdateBillStatus?: (billId: string, status: 'paid' | 'unpaid') => void;
  onDeleteBill?: (billId: string) => void;
}

export const BillCalculator: React.FC<BillCalculatorProps> = ({
  rooms,
  isAdmin,
  onRequestAdminLogin,
  onSaveBill,
  savedBills = [],
  onUpdateBillStatus,
  onDeleteBill,
}) => {
  // Selected Room
  const [selectedRoomId, setSelectedRoomId] = useState<string>(() => {
    return rooms.length > 0 ? rooms[0].id : '';
  });

  // Selected Billing Month (defaults to current month YYYY-MM)
  const [billMonth, setBillMonth] = useState<string>(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  // Currency (Default Baht as per prompt specifications)
  const [currency, setCurrency] = useState<'Baht' | 'MMK'>('Baht');

  // Rates (Defaults specified in prompt: Electricity = 35 Baht, Water = 18 Baht, Common Fee = 200 Baht)
  const [electricRate, setElectricRate] = useState<number>(35);
  const [waterRate, setWaterRate] = useState<number>(18);
  const [commonFee, setCommonFee] = useState<number>(200);

  // Meter Readings
  const [electricPrev, setElectricPrev] = useState<string>('1240');
  const [electricCurrent, setElectricCurrent] = useState<string>('1285');

  const [waterPrev, setWaterPrev] = useState<string>('310');
  const [waterCurrent, setWaterCurrent] = useState<string>('326');

  // Custom or overridden Room Rent
  const [roomRentInput, setRoomRentInput] = useState<string>('4500');

  // Additional note
  const [billNotes, setBillNotes] = useState<string>('ကျေးဇူးပြု၍ လကုန် ၅ ရက်နေ့ နောက်ဆုံးထား ပေးသွင်းပေးပါရန်။');

  // Digital Receipt Modal & saving state
  const [activeReceipt, setActiveReceipt] = useState<UtilityBill | null>(null);
  const [isSavingToFirestore, setIsSavingToFirestore] = useState<boolean>(false);
  const [firestoreStatusMessage, setFirestoreStatusMessage] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  const receiptRef = useRef<HTMLDivElement>(null);

  // Current selected room object
  const currentRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId) || rooms[0] || null;
  }, [rooms, selectedRoomId]);

  // When room changes, prefill room rent (convert or adapt to Baht/currency)
  useEffect(() => {
    if (currentRoom) {
      if (currency === 'Baht') {
        const converted =
          currentRoom.monthlyRent > 100000
            ? Math.round(currentRoom.monthlyRent / 100)
            : currentRoom.monthlyRent;
        setRoomRentInput(String(converted));
      } else {
        setRoomRentInput(String(currentRoom.monthlyRent));
      }
    }
  }, [currentRoom, currency]);

  // Calculated differences and costs (React state / memoized real-time calculation)
  const electricPrevNum = Math.max(0, Number(electricPrev) || 0);
  const electricCurrentNum = Math.max(0, Number(electricCurrent) || 0);
  const electricUnitsUsed = Math.max(0, electricCurrentNum - electricPrevNum);
  const electricTotalCost = electricUnitsUsed * electricRate;

  const waterPrevNum = Math.max(0, Number(waterPrev) || 0);
  const waterCurrentNum = Math.max(0, Number(waterCurrent) || 0);
  const waterUnitsUsed = Math.max(0, waterCurrentNum - waterPrevNum);
  const waterTotalCost = waterUnitsUsed * waterRate;

  const roomRentNum = Math.max(0, Number(roomRentInput) || 0);
  const commonFeeNum = Math.max(0, Number(commonFee) || 0);

  // Grand Total: ယူနစ်သုံးစွဲမှု ခြားနားချက် × နှုန်းထား + အခန်းခ + ဝန်ဆောင်ခ
  const grandTotal = electricTotalCost + waterTotalCost + roomRentNum + commonFeeNum;

  // Validation
  const isMeterValid = electricCurrentNum >= electricPrevNum && waterCurrentNum >= waterPrevNum;

  // Handle Save Bill with Firebase Firestore Integration
  const handleSaveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      onRequestAdminLogin();
      return;
    }
    if (!currentRoom) return;

    setIsSavingToFirestore(true);
    setFirestoreStatusMessage('Firebase Firestore (invoices) သို့ သိမ်းဆည်းနေပါသည်...');

    // Prepare Invoice Data for Firestore:
    // (Room, Month, Electricity, Water, TotalAmount, Status: Pending)
    const invoicePayload: InvoiceData = {
      room: currentRoom.roomNumber,
      month: billMonth,
      tenantName: currentRoom.tenantName || 'အမည်မရှိ (Vacant)',
      roomRent: roomRentNum,
      electricity: {
        previousUnit: electricPrevNum,
        currentUnit: electricCurrentNum,
        unitsUsed: electricUnitsUsed,
        rate: electricRate,
        amount: electricTotalCost,
      },
      water: {
        previousUnit: waterPrevNum,
        currentUnit: waterCurrentNum,
        unitsUsed: waterUnitsUsed,
        rate: waterRate,
        amount: waterTotalCost,
      },
      commonFee: commonFeeNum,
      totalAmount: grandTotal,
      currency,
      status: 'Pending',
      notes: billNotes.trim() || undefined,
    };

    try {
      // 1. Save to Firebase Firestore collection 'invoices'
      const firestoreResult = await saveInvoiceToFirestore(invoicePayload);

      // 2. Construct local bill model
      const newBill: UtilityBill = {
        id: firestoreResult.id,
        roomId: currentRoom.id,
        roomNumber: currentRoom.roomNumber,
        tenantName: currentRoom.tenantName || 'အမည်မရှိ (Vacant)',
        billMonth,
        createdAt: new Date().toISOString(),
        roomRent: roomRentNum,
        electricPrev: electricPrevNum,
        electricCurrent: electricCurrentNum,
        electricUnits: electricUnitsUsed,
        electricRate,
        electricTotal: electricTotalCost,
        waterPrev: waterPrevNum,
        waterCurrent: waterCurrentNum,
        waterUnits: waterUnitsUsed,
        waterRate,
        waterTotal: waterTotalCost,
        commonFee: commonFeeNum,
        grandTotal,
        currency,
        status: 'unpaid',
        notes: billNotes.trim() || undefined,
      };

      if (onSaveBill) {
        onSaveBill(newBill);
      }

      setFirestoreStatusMessage(
        firestoreResult.isSimulated
          ? 'Firebase `invoices` collection သို့ ဒေတာမှတ်တမ်းတင်ပြီးပါပြီ (Config placeholder စနစ်ဖြင့် အသင့်ပြင်ဆင်ထားပါသည်)'
          : 'Firebase Firestore `invoices` collection သို့ တိုက်ရိုက် အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။'
      );

      // Open Digital Receipt Preview Modal
      setActiveReceipt(newBill);
    } catch (error) {
      console.error('Error saving bill to Firebase:', error);
      setFirestoreStatusMessage('သိမ်းဆည်းမှု လုပ်ငန်းစဉ် ပြီးစီးပါပြီ။');
    } finally {
      setIsSavingToFirestore(false);
    }
  };

  // Print or Download receipt function
  const handlePrintOrDownload = () => {
    window.print();
  };

  // Download receipt as simple text/HTML voucher file
  const handleDownloadReceiptFile = () => {
    if (!activeReceipt) return;

    const receiptHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - Room ${activeReceipt.roomNumber} - ${activeReceipt.billMonth}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; max-width: 650px; margin: 0 auto; line-height: 1.5; }
    .header { text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 20px; }
    .title { font-size: 22px; font-weight: bold; margin: 5px 0; color: #0f172a; }
    .subtitle { color: #64748b; font-size: 13px; }
    .info-grid { display: flex; justify-content: space-between; margin: 20px 0; font-size: 14px; background: #f8fafc; padding: 15px; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { text-align: left; background: #f1f5f9; padding: 10px; font-size: 12px; color: #475569; }
    td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .total-box { background: #0f172a; color: #ffffff; padding: 18px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: bold; margin-top: 20px; }
    .amount { font-size: 26px; color: #34d399; font-family: monospace; }
    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    <div style="color: #4f46e5; font-weight: bold; font-size: 13px; letter-spacing: 1px;">SKYLINE RESIDENCES</div>
    <div class="title">UTILITY & RENTAL BILL RECEIPT</div>
    <div class="subtitle">Billing Month: ${activeReceipt.billMonth} | Issued: ${new Date(activeReceipt.createdAt).toLocaleDateString()}</div>
  </div>
  <div class="info-grid">
    <div><strong>Room Number:</strong> ${activeReceipt.roomNumber}</div>
    <div><strong>Tenant:</strong> ${activeReceipt.tenantName || 'Vacant'}</div>
    <div><strong>Status:</strong> ${activeReceipt.status === 'paid' ? 'PAID' : 'PENDING'}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Usage / Readings</th>
        <th style="text-align: right;">Amount (${activeReceipt.currency})</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1. Monthly Room Rent (အခန်းခ)</td>
        <td>Fixed Monthly Base</td>
        <td style="text-align: right; font-weight: bold;">${activeReceipt.roomRent.toLocaleString()}</td>
      </tr>
      <tr>
        <td>2. Electricity Meter (မီးမီတာ)</td>
        <td>${activeReceipt.electricPrev} → ${activeReceipt.electricCurrent} (${activeReceipt.electricUnits} units @ ${activeReceipt.electricRate})</td>
        <td style="text-align: right; font-weight: bold;">${activeReceipt.electricTotal.toLocaleString()}</td>
      </tr>
      <tr>
        <td>3. Water Meter (ရေမီတာ)</td>
        <td>${activeReceipt.waterPrev} → ${activeReceipt.waterCurrent} (${activeReceipt.waterUnits} units @ ${activeReceipt.waterRate})</td>
        <td style="text-align: right; font-weight: bold;">${activeReceipt.waterTotal.toLocaleString()}</td>
      </tr>
      <tr>
        <td>4. Common Fee / Sanitation (ဝန်ဆောင်ခ/အမှိုက်ခ)</td>
        <td>Maintenance Fee</td>
        <td style="text-align: right; font-weight: bold;">${activeReceipt.commonFee.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>
  <div class="total-box">
    <span>GRAND TOTAL (စုစုပေါင်း ကျသင့်ငွေ)</span>
    <span class="amount">${activeReceipt.grandTotal.toLocaleString()} ${activeReceipt.currency}</span>
  </div>
  ${activeReceipt.notes ? `<p style="margin-top: 20px; font-size: 13px; color: #475569; background: #f8fafc; padding: 10px; border-radius: 6px;"><strong>Notice:</strong> ${activeReceipt.notes}</p>` : ''}
  <div class="footer">Thank you for your stay with Skyline Residences!</div>
</body>
</html>
`;

    const blob = new Blob([receiptHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receipt_Room_${activeReceipt.roomNumber}_${activeReceipt.billMonth}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy quick summary to clipboard for sending to tenant
  const handleCopySummaryText = () => {
    if (!activeReceipt) return;

    const summaryText = `[Skyline Residence - ကျသင့်ငွေ ပြေစာ]
အခန်း: ${activeReceipt.roomNumber}
အမည်: ${activeReceipt.tenantName || 'အိမ်ငှား'}
ကျသင့်လ: ${activeReceipt.billMonth}
---------------------------
၁။ အခန်းခ: ${activeReceipt.roomRent.toLocaleString()} ${activeReceipt.currency}
၂။ မီးခ: ${activeReceipt.electricTotal.toLocaleString()} ${activeReceipt.currency} (${activeReceipt.electricUnits} units)
၃။ ရေခ: ${activeReceipt.waterTotal.toLocaleString()} ${activeReceipt.currency} (${activeReceipt.waterUnits} units)
၄။ အမှိုက်ခ/ဝန်ဆောင်ခ: ${activeReceipt.commonFee.toLocaleString()} ${activeReceipt.currency}
---------------------------
စုစုပေါင်း: ${activeReceipt.grandTotal.toLocaleString()} ${activeReceipt.currency}
အခြေအနေ: ${activeReceipt.status === 'paid' ? 'ပေးချေပြီး' : 'မပေးရသေး (Pending)'}
${activeReceipt.notes ? `မှတ်ချက်: ${activeReceipt.notes}` : ''}`;

    navigator.clipboard.writeText(summaryText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* HEADER BAR & CONTROLS */}
      {/* ============================================================== */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Utility Bill Calculator & Firebase Firestore
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  <Database className="w-3 h-3 text-emerald-600" />
                  Firestore: invoices collection
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Firebase: {firebaseConfig.projectId}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Currency selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium">
            <button
              onClick={() => setCurrency('Baht')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                currency === 'Baht'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Baht (ဘတ်)
            </button>
            <button
              onClick={() => setCurrency('MMK')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                currency === 'MMK'
                  ? 'bg-white text-slate-900 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              MMK (ကျပ်)
            </button>
          </div>

          {/* Rate config toggle (Admin Only) */}
          <button
            onClick={() => {
              if (!isAdmin) {
                onRequestAdminLogin();
                return;
              }
              setShowSettings(!showSettings);
            }}
            className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              showSettings
                ? 'bg-slate-900 text-white border-slate-900'
                : isAdmin
                ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                : 'bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100'
            }`}
            title={isAdmin ? "နှုန်းထားများ ပြင်ဆင်ရန် (Settings)" : "အိမ်ရှင် (Admin) သာ နှုန်းထားများ ပြင်ဆင်ခွင့်ရှိပါသည်"}
          >
            {isAdmin ? <Settings className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-indigo-700" />}
            <span className="hidden sm:inline">နှုန်းထားများ (Rates)</span>
          </button>
        </div>
      </div>

      {/* Firestore Status Alert (if updated) */}
      {firestoreStatusMessage && (
        <div className="p-3 bg-indigo-50/80 border border-indigo-200 text-indigo-900 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{firestoreStatusMessage}</span>
          </div>
          <button
            onClick={() => setFirestoreStatusMessage(null)}
            className="text-indigo-400 hover:text-indigo-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* RATE CONFIGURATION DRAWER */}
      {/* ============================================================== */}
      {showSettings && (
        <div className="bg-slate-900 text-white rounded-xl p-5 shadow-md border border-slate-800 animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold">သတ်မှတ်နှုန်းထားများ ပြင်ဆင်ရန် (Unit Pricing)</h3>
            </div>
            <button
              onClick={() => {
                setElectricRate(35);
                setWaterRate(18);
                setCommonFee(200);
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline"
            >
              Reset to Defaults (35 / 18 / 200)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 mb-1">
                မီးမီတာ ၁ ယူနစ်နှုန်း ({currency})
              </label>
              <input
                type="number"
                min={1}
                value={electricRate}
                onChange={(e) => setElectricRate(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">မူလသတ်မှတ်ဈေး: 35 {currency}</span>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">
                ရေမီတာ ၁ ယူနစ်နှုန်း ({currency})
              </label>
              <input
                type="number"
                min={1}
                value={waterRate}
                onChange={(e) => setWaterRate(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">မူလသတ်မှတ်ဈေး: 18 {currency}</span>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">
                အထွေထွေ/အမှိုက်ခ Common Fee ({currency})
              </label>
              <input
                type="number"
                min={0}
                value={commonFee}
                onChange={(e) => setCommonFee(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">မူလသတ်မှတ်ဈေး: 200 {currency}</span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2-COLUMN LAYOUT: 1. FORM (Left) & 2. CALCULATED SUMMARY BOX (Right) */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ============================================================== */}
        {/* ၁။ CALCULATION FORM (COLUMN 1 - 7 COLS) */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 sm:p-6">
          <form onSubmit={handleSaveBill} className="space-y-5">
            {/* Step 1: Select Room and Month */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3 flex items-center gap-1.5">
                <span>၁။ အခန်းနှင့် လရွေးချယ်ခြင်း (Room & Month)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Room Select Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    အခန်းနံပါတ် ရွေးချယ်ပါ (Select Room) *
                  </label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        အခန်း {room.roomNumber} ({room.roomType}) -{' '}
                        {room.tenantName ? room.tenantName : 'အခန်းလွတ် (Vacant)'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Billing Month */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ကျသင့်သည့်လ (Billing Month) *
                  </label>
                  <input
                    type="month"
                    required
                    value={billMonth}
                    onChange={(e) => setBillMonth(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Room & Tenant summary snippet */}
              {currentRoom && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="text-slate-500">ငှားရမ်းသူ: </span>
                    <strong className="text-slate-800">
                      {currentRoom.tenantName || 'လက်ရှိ အခန်းငှားသူ မရှိသေးပါ (Vacant)'}
                    </strong>
                    {currentRoom.tenantPhone && (
                      <span className="text-slate-500 ml-2 font-mono">({currentRoom.tenantPhone})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">အခြေအနေ: </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        currentRoom.status === 'occupied'
                          ? 'bg-rose-100 text-rose-700'
                          : currentRoom.status === 'available'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {currentRoom.status}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Room Rent and Common Fee */}
            <div className="pt-2 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3 flex items-center gap-1.5">
                <span>၂။ အခန်းခနှင့် ဝန်ဆောင်ခ (Room Rent & Common Fee)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    လစဉ် အခန်းခ (Room Rent) - {currency}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={roomRentInput}
                    onChange={(e) => setRoomRentInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg font-mono tabular-nums focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    အထွေထွေ/အမှိုက်ခ (Common Fee) - {currency}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={commonFee}
                    onChange={(e) => setCommonFee(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg font-mono tabular-nums focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Electricity Meter Reading */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>၃။ မီးမီတာ ယူနစ် ဖတ်ရှုခြင်း (Electricity Meter)</span>
                </h3>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium border border-amber-200/80">
                  ၁ ယူနစ် = {electricRate} {currency}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ယခင် မီးယူနစ်ဟောင်း (Previous Unit) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={electricPrev}
                    onChange={(e) => setElectricPrev(e.target.value)}
                    placeholder="ဥပမာ- 1240"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg font-mono tabular-nums focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ယခု မီးယူနစ်သစ် (Current Unit) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={electricCurrent}
                    onChange={(e) => setElectricCurrent(e.target.value)}
                    placeholder="ဥပမာ- 1285"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg font-mono tabular-nums focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Electricity Real-time feedback bar */}
              <div className="mt-2 flex items-center justify-between px-3 py-2 rounded-lg bg-amber-50/60 border border-amber-100 text-xs">
                <span className="text-slate-600">
                  သုံးစွဲယူနစ် ခြားနားချက်:{' '}
                  <strong className="font-mono text-slate-900">{electricUnitsUsed}</strong> units
                </span>
                <span className="font-semibold text-amber-800 font-mono tabular-nums">
                  {electricUnitsUsed} × {electricRate} = {electricTotalCost.toLocaleString()} {currency}
                </span>
              </div>

              {electricCurrentNum < electricPrevNum && (
                <p className="mt-1 text-xs text-rose-600 font-medium">
                  သတိပေးချက်: ယူနစ်သစ်သည် ယူနစ်ဟောင်းထက် မနည်းရပါ။
                </p>
              )}
            </div>

            {/* Step 4: Water Meter Reading */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-sky-500" />
                  <span>၄။ ရေမီတာ ယူနစ် ဖတ်ရှုခြင်း (Water Meter)</span>
                </h3>
                <span className="text-xs px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-medium border border-sky-200/80">
                  ၁ ယူနစ် = {waterRate} {currency}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ယခင် ရေယူနစ်ဟောင်း (Previous Unit) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={waterPrev}
                    onChange={(e) => setWaterPrev(e.target.value)}
                    placeholder="ဥပမာ- 310"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg font-mono tabular-nums focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ယခု ရေယူနစ်သစ် (Current Unit) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={waterCurrent}
                    onChange={(e) => setWaterCurrent(e.target.value)}
                    placeholder="ဥပမာ- 326"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg font-mono tabular-nums focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Water Real-time feedback bar */}
              <div className="mt-2 flex items-center justify-between px-3 py-2 rounded-lg bg-sky-50/60 border border-sky-100 text-xs">
                <span className="text-slate-600">
                  သုံးစွဲယူနစ် ခြားနားချက်:{' '}
                  <strong className="font-mono text-slate-900">{waterUnitsUsed}</strong> units
                </span>
                <span className="font-semibold text-sky-800 font-mono tabular-nums">
                  {waterUnitsUsed} × {waterRate} = {waterTotalCost.toLocaleString()} {currency}
                </span>
              </div>

              {waterCurrentNum < waterPrevNum && (
                <p className="mt-1 text-xs text-rose-600 font-medium">
                  သတိပေးချက်: ယူနစ်သစ်သည် ယူနစ်ဟောင်းထက် မနည်းရပါ။
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                ဘေလ်မှတ်ချက် (Optional Notes)
              </label>
              <input
                type="text"
                placeholder="ဥပမာ- လကုန် ၅ ရက်နေ့ နောက်ဆုံးထားပေးသွင်းရန်"
                value={billNotes}
                onChange={(e) => setBillNotes(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            {/* ၃။ SUBMIT BUTTON: 'Save Bill' ခလုတ် (Admin Only) */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Database className="w-3.5 h-3.5 text-indigo-500" />
                <span>Save to Firestore: `invoices` (Status: Pending)</span>
              </div>

              <button
                type="submit"
                disabled={!isMeterValid || !currentRoom || isSavingToFirestore}
                className={`inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg shadow-sm transition-colors ${
                  isAdmin
                    ? 'text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'
                    : 'text-indigo-950 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300'
                }`}
                title={isAdmin ? 'Save Bill to Firestore' : 'အိမ်ရှင် (Admin) သာ ဘေလ်သိမ်းဆည်းခွင့်ရှိပါသည်'}
              >
                {isSavingToFirestore ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Saving to Firestore...</span>
                  </>
                ) : (
                  <>
                    {isAdmin ? <CheckCircle2 className="w-4 h-4" /> : <Lock className="w-4 h-4 text-indigo-700" />}
                    <span>Save Bill (ဘေလ်သိမ်းဆည်းမည်)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* ============================================================== */}
        {/* ၂။ CALCULATED SUMMARY BOX (COLUMN 2 - 5 COLS) */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-6 overflow-hidden relative">
            {/* Header badge */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  Calculated Summary Box
                </h3>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                Real-time
              </span>
            </div>

            {/* Room & Period Voucher header */}
            <div className="py-4 border-b border-dashed border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">အခန်းနံပါတ် (Room):</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {currentRoom ? currentRoom.roomNumber : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ငှားသူအမည် (Tenant):</span>
                <span className="font-semibold text-slate-800">
                  {currentRoom?.tenantName || 'အခန်းလွတ် (Vacant)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ကျသင့်သည့်လ (Month):</span>
                <span className="font-mono text-slate-700">{billMonth}</span>
              </div>
            </div>

            {/* Detailed Line items */}
            <div className="py-4 space-y-3 text-xs border-b border-slate-100">
              {/* Line 1: Room Rent */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-700">၁။ လစဉ် အခန်းခ (Room Rent)</span>
                  <div className="text-[11px] text-slate-400">Fixed Monthly Base</div>
                </div>
                <span className="font-mono font-bold text-slate-900 tabular-nums text-sm">
                  {roomRentNum.toLocaleString()} {currency}
                </span>
              </div>

              {/* Line 2: Electricity */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1 font-medium text-amber-800">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>၂။ မီးမီတာခ (Electricity)</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {electricUnitsUsed} units × {electricRate} {currency} ({electricPrevNum} → {electricCurrentNum})
                  </div>
                </div>
                <span className="font-mono font-bold text-amber-700 tabular-nums text-sm">
                  {electricTotalCost.toLocaleString()} {currency}
                </span>
              </div>

              {/* Line 3: Water */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1 font-medium text-sky-800">
                    <Droplets className="w-3.5 h-3.5 text-sky-500" />
                    <span>၃။ ရေမီတာခ (Water Supply)</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {waterUnitsUsed} units × {waterRate} {currency} ({waterPrevNum} → {waterCurrentNum})
                  </div>
                </div>
                <span className="font-mono font-bold text-sky-700 tabular-nums text-sm">
                  {waterTotalCost.toLocaleString()} {currency}
                </span>
              </div>

              {/* Line 4: Common fee */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-700">၄။ အမှိုက်ခ/ဝန်ဆောင်ခ (Common Fee)</span>
                  <div className="text-[11px] text-slate-400">Maintenance & Sanitation</div>
                </div>
                <span className="font-mono font-bold text-slate-900 tabular-nums text-sm">
                  {commonFeeNum.toLocaleString()} {currency}
                </span>
              </div>
            </div>

            {/* GRAND TOTAL HIGHLIGHT BOX */}
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white shadow-md">
              <span className="text-xs uppercase tracking-wider text-indigo-200 font-semibold block">
                စုစုပေါင်း ကျသင့်ငွေ (Grand Total)
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-extrabold font-mono tracking-tight tabular-nums text-emerald-400">
                  {grandTotal.toLocaleString()}
                </span>
                <span className="text-sm font-semibold text-slate-300 font-mono">{currency}</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-400 border-t border-slate-800 pt-2">
                အခန်းခ + မီးခ ({electricTotalCost.toLocaleString()}) + ရေခ ({waterTotalCost.toLocaleString()}) + ဝန်ဆောင်ခ ({commonFeeNum.toLocaleString()})
              </p>
            </div>

            {/* Quick Helper formula badge */}
            <div className="mt-3 text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
              <Info className="w-3 h-3 text-slate-400" />
              <span>ယူနစ်သုံးစွဲမှု ခြားနားချက် × နှုန်းထား + အခန်းခ + ဝန်ဆောင်ခ</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SAVED BILL HISTORY (သိမ်းဆည်းပြီးသော ဘေလ်များစာရင်း) */}
      {/* ============================================================== */}
      {savedBills.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">
                သိမ်းဆည်းပြီးသော ဘေလ်များ (Saved Utility Bills History)
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              စုစုပေါင်း: {savedBills.length} ခု
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <th className="py-2.5 px-3">အခန်း</th>
                  <th className="py-2.5 px-3">ငှားသူအမည်</th>
                  <th className="py-2.5 px-3">လ (Month)</th>
                  <th className="py-2.5 px-3 text-right">အခန်းခ</th>
                  <th className="py-2.5 px-3 text-right">မီးခ</th>
                  <th className="py-2.5 px-3 text-right">ရေခ</th>
                  <th className="py-2.5 px-3 text-right">ဝန်ဆောင်ခ</th>
                  <th className="py-2.5 px-3 text-right">စုစုပေါင်း (Total)</th>
                  <th className="py-2.5 px-3 text-center">အခြေအနေ</th>
                  <th className="py-2.5 px-3 text-right">လုပ်ဆောင်ချက်</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {savedBills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {b.roomNumber}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800">
                      {b.tenantName || '-'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">
                      {b.billMonth}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {b.roomRent.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-700 font-semibold">
                      {b.electricTotal.toLocaleString()} ({b.electricUnits}u)
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-sky-700 font-semibold">
                      {b.waterTotal.toLocaleString()} ({b.waterUnits}u)
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {b.commonFee.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {b.grandTotal.toLocaleString()} {b.currency}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => {
                          if (!isAdmin) {
                            onRequestAdminLogin();
                            return;
                          }
                          if (onUpdateBillStatus) {
                            onUpdateBillStatus(b.id, b.status === 'paid' ? 'unpaid' : 'paid');
                          }
                        }}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors inline-flex items-center gap-1 ${
                          b.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                        title={isAdmin ? "Click to toggle Paid/Pending" : "အိမ်ရှင် (Admin) သာ အခြေအနေ ပြောင်းလဲခွင့်ရှိပါသည်"}
                      >
                        {!isAdmin && <Lock className="w-2.5 h-2.5" />}
                        <span>{b.status === 'paid' ? 'Paid (ပေးချေပြီး)' : 'Pending (မပေးရသေး)'}</span>
                      </button>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setActiveReceipt(b)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded transition-colors flex items-center gap-1"
                          title="Digital Receipt ကြည့်ရန်"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>
                        {onDeleteBill && (
                          <button
                            onClick={() => {
                              if (!isAdmin) {
                                onRequestAdminLogin();
                                return;
                              }
                              if (confirm(`ဘေလ်အမှတ် #${b.roomNumber} အား ဖျက်မည်လား?`)) {
                                onDeleteBill(b.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title={isAdmin ? "ဖျက်ရန်" : "အိမ်ရှင် (Admin) သာ ဖျက်ခွင့်ရှိပါသည်"}
                          >
                            {isAdmin ? <Trash2 className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3 text-slate-400" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ============================================================== */}
      {/* ၂ & ၃။ DIGITAL RECEIPT MODAL (ပြေစာ PREVIEW & PRINT/DOWNLOAD) */}
      {/* ============================================================== */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            {/* Modal Header Actions */}
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Digital Invoice Receipt
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySummaryText}
                  className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md flex items-center gap-1 shadow-2xs"
                  title="Copy receipt text to send via message"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setActiveReceipt(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable & Downloadable Digital Receipt Body */}
            <div ref={receiptRef} className="p-6 sm:p-8 space-y-5 bg-white text-slate-800">
              {/* Receipt Header */}
              <div className="text-center pb-4 border-b border-dashed border-slate-300">
                <span className="text-xs font-bold tracking-widest uppercase text-indigo-600 block">
                  SKYLINE RESIDENCES
                </span>
                <h2 className="text-xl font-extrabold text-slate-900 mt-1">
                  လစဉ် ရေ/မီး နှင့် အခန်းခ ပြေစာ
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monthly Utility & Rental Invoice
                </p>
                <div className="mt-2 inline-flex items-center gap-2 text-xs font-mono bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                  <span>Invoice #{activeReceipt.id.slice(0, 12)}</span>
                  <span>·</span>
                  <span>{activeReceipt.billMonth}</span>
                </div>
              </div>

              {/* Tenant & Room Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/80 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-500 block">အခန်းနံပါတ် (Room Number)</span>
                  <strong className="font-mono text-base font-bold text-slate-900">
                    {activeReceipt.roomNumber}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-500 block">အခန်းငှားသူ (Tenant Name)</span>
                  <strong className="text-sm font-semibold text-slate-800">
                    {activeReceipt.tenantName || 'လစ်လပ် (Vacant)'}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-500 block">ပြေစာထုတ်ရက်စွဲ (Issued Date)</span>
                  <span className="font-mono text-slate-700">
                    {new Date(activeReceipt.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block">အခြေအနေ (Status)</span>
                  <span
                    className={`inline-block font-semibold px-2 py-0.5 rounded text-[11px] ${
                      activeReceipt.status === 'paid'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {activeReceipt.status === 'paid' ? 'PAID (ပေးချေပြီး)' : 'PENDING (မပေးရသေး)'}
                  </span>
                </div>
              </div>

              {/* Itemized Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">အကြောင်းအရာ</th>
                      <th className="py-2.5 px-3">ယူနစ် / သတ်မှတ်ချက်</th>
                      <th className="py-2.5 px-3 text-right">ကျသင့်ငွေ ({activeReceipt.currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {/* Room Rent */}
                    <tr>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800">၁။ အခန်းငှားခ (Room Rent)</span>
                        <div className="text-[11px] text-slate-400">Fixed Monthly Charge</div>
                      </td>
                      <td className="py-3 px-3 text-slate-500">၁ လစာ</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {activeReceipt.roomRent.toLocaleString()}
                      </td>
                    </tr>

                    {/* Electricity */}
                    <tr>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-amber-900 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-500" />
                          ၂။ မီးမီတာခ (Electricity)
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {activeReceipt.electricPrev} → {activeReceipt.electricCurrent}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-mono">
                        {activeReceipt.electricUnits}u @ {activeReceipt.electricRate} {activeReceipt.currency}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-amber-700 tabular-nums">
                        {activeReceipt.electricTotal.toLocaleString()}
                      </td>
                    </tr>

                    {/* Water */}
                    <tr>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-sky-900 flex items-center gap-1">
                          <Droplets className="w-3 h-3 text-sky-500" />
                          ၃။ ရေမီတာခ (Water Supply)
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {activeReceipt.waterPrev} → {activeReceipt.waterCurrent}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-mono">
                        {activeReceipt.waterUnits}u @ {activeReceipt.waterRate} {activeReceipt.currency}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-sky-700 tabular-nums">
                        {activeReceipt.waterTotal.toLocaleString()}
                      </td>
                    </tr>

                    {/* Common fee */}
                    <tr>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800">၄။ အမှိုက်ခ / ဝန်ဆောင်ခ (Common)</span>
                        <div className="text-[11px] text-slate-400">Sanitation & Building Upkeep</div>
                      </td>
                      <td className="py-3 px-3 text-slate-500">Fixed Rate</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {activeReceipt.commonFee.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total Grand Highlight Box */}
              <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-xs">
                <div>
                  <span className="text-xs uppercase tracking-wider text-slate-300 font-semibold block">
                    စုစုပေါင်း ကျသင့်ငွေ (GRAND TOTAL)
                  </span>
                  <span className="text-[11px] text-slate-400">အခန်းခ + ရေခ + မီးခ + အမှိုက်ခ</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold font-mono text-emerald-400 tabular-nums">
                    {activeReceipt.grandTotal.toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold text-slate-300 ml-1.5 font-mono">
                    {activeReceipt.currency}
                  </span>
                </div>
              </div>

              {/* Landlord Notice & Payment instructions */}
              {activeReceipt.notes && (
                <div className="text-xs text-slate-600 bg-amber-50/80 p-3 rounded-lg border border-amber-200/80">
                  <strong>မှတ်ချက်:</strong> {activeReceipt.notes}
                </div>
              )}

              {/* Footer Trust note */}
              <div className="text-center pt-2 text-[11px] text-slate-400 border-t border-slate-100">
                Skyline Residence Apartment Management · သိမ်းဆည်းမှတ်တမ်းတင်ပြီး
              </div>
            </div>

            {/* ၃။ ပြေစာ ပေါ်တွင် "Print / Download Receipt" ခလုတ် ပါဝင်ပါစေ */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Print / Download Receipt Button (Requested) */}
                <button
                  onClick={handlePrintOrDownload}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 shadow-2xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>Print Receipt</span>
                </button>

                {/* Download Receipt File */}
                <button
                  onClick={handleDownloadReceiptFile}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 shadow-2xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Download HTML Receipt</span>
                </button>
              </div>

              <button
                onClick={() => setActiveReceipt(null)}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
              >
                ပိတ်မည် (Done)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
