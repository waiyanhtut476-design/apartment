import React, { useState, useMemo } from 'react';
import {
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  LayoutGrid,
  List,
  Wrench,
  UserPlus,
  UserMinus,
  Edit3,
  Phone,
  Calendar,
  X,
  ArrowRight,
  TrendingUp,
  Download,
  Lock,
  ShieldAlert
} from 'lucide-react';
import { Room, RoomStatusType, RoomType, ViewMode } from '../types';

interface RoomStatusProps {
  rooms: Room[];
  isAdmin: boolean;
  onRequestAdminLogin: () => void;
  onAddRoom: (newRoom: Omit<Room, 'id'>) => void;
  onUpdateStatus: (roomId: string, newStatus: RoomStatusType, tenantName?: string | null) => void;
  onUpdateRoom: (room: Room) => void;
}

export const RoomStatus: React.FC<RoomStatusProps> = ({
  rooms,
  isAdmin,
  onRequestAdminLogin,
  onAddRoom,
  onUpdateStatus,
  onUpdateRoom,
}) => {
  // State for view mode: grid or table
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RoomStatusType>('all');
  const [floorFilter, setFloorFilter] = useState<'all' | number>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | RoomType>('all');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [quickActionRoom, setQuickActionRoom] = useState<Room | null>(null);

  // New room form state
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newRoomFloor, setNewRoomFloor] = useState<number>(1);
  const [newRoomType, setNewRoomType] = useState<RoomType>('1 Bedroom');
  const [newRoomRent, setNewRoomRent] = useState<number>(450000);
  const [newRoomStatus, setNewRoomStatus] = useState<RoomStatusType>('available');
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantPhone, setNewTenantPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Quick Tenant assignment state
  const [tenantInputName, setTenantInputName] = useState('');
  const [tenantInputPhone, setTenantInputPhone] = useState('');

  // Calculate summaries
  const totalRooms = rooms.length;
  const occupiedRooms = useMemo(() => rooms.filter((r) => r.status === 'occupied').length, [rooms]);
  const availableRooms = useMemo(() => rooms.filter((r) => r.status === 'available').length, [rooms]);
  const maintenanceRooms = useMemo(() => rooms.filter((r) => r.status === 'maintenance').length, [rooms]);

  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  const totalPotentialRent = useMemo(
    () => rooms.reduce((sum, r) => sum + r.monthlyRent, 0),
    [rooms]
  );
  const currentCollectedRent = useMemo(
    () => rooms.filter((r) => r.status === 'occupied').reduce((sum, r) => sum + r.monthlyRent, 0),
    [rooms]
  );

  // Distinct floors for filter
  const availableFloors = useMemo(() => {
    const floors = Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b);
    return floors;
  }, [rooms]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      // Search query matches room number, tenant name, or room type
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesRoom = room.roomNumber.toLowerCase().includes(query);
        const matchesTenant = room.tenantName?.toLowerCase().includes(query) || false;
        const matchesType = room.roomType.toLowerCase().includes(query);
        if (!matchesRoom && !matchesTenant && !matchesType) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && room.status !== statusFilter) {
        return false;
      }

      // Floor filter
      if (floorFilter !== 'all' && room.floor !== floorFilter) {
        return false;
      }

      // Type filter
      if (typeFilter !== 'all' && room.roomType !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [rooms, searchQuery, statusFilter, floorFilter, typeFilter]);

  // Helper formatter for MMK currency
  const formatRent = (amount: number, currency: string = 'MMK') => {
    return `${amount.toLocaleString()} ${currency}`;
  };

  // Status visual badge styling
  const getStatusBadge = (status: RoomStatusType) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            {/* မီးစိမ်း Indicator */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Available (လွတ်လပ်)</span>
          </span>
        );
      case 'occupied':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80">
            {/* မီးနီ Indicator */}
            <span className="inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            <span>Occupied (ငှားပြီး)</span>
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80">
            {/* မီးဝါ Indicator */}
            <span className="inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            <span>Maintenance (ပြုပြင်ဆဲ)</span>
          </span>
        );
    }
  };

  // Handle Add Room Submit
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNumber.trim()) return;

    onAddRoom({
      roomNumber: newRoomNumber.trim(),
      floor: Number(newRoomFloor),
      roomType: newRoomType,
      monthlyRent: Number(newRoomRent),
      currency: 'MMK',
      status: newRoomStatus,
      tenantName: newRoomStatus === 'occupied' && newTenantName.trim() ? newTenantName.trim() : null,
      tenantPhone: newTenantPhone.trim() || undefined,
      notes: newNotes.trim() || undefined,
    });

    // Reset form
    setNewRoomNumber('');
    setNewTenantName('');
    setNewTenantPhone('');
    setNewNotes('');
    setIsAddModalOpen(false);
  };

  // Export room data to simple CSV
  const handleExportCSV = () => {
    const headers = ['Room Number', 'Floor', 'Room Type', 'Monthly Rent (MMK)', 'Status', 'Tenant Name', 'Phone', 'Notes'];
    const rows = filteredRooms.map((r) => [
      `"${r.roomNumber}"`,
      r.floor,
      `"${r.roomType}"`,
      r.monthlyRent,
      r.status,
      `"${r.tenantName || '-'}"`,
      `"${r.tenantPhone || '-'}"`,
      `"${r.notes || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `apartment_rooms_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* 1. SUMMARY CARDS (စာရင်းအချုပ်ပြ CARDS ၃ ခု အဓိက + တန်ဖိုးသုံးသပ်ချက်) */}
      {/* ============================================================== */}
      <section aria-label="Room Statistics Summary">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: အခန်းစုစုပေါင်း (Total Rooms) */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs transition-all hover:border-slate-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                အခန်းစုစုပေါင်း
              </span>
              <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
                {totalRooms}
              </span>
              <span className="text-xs text-slate-500 font-medium">ခန်း (Units)</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
              <span>အဆောက်အအုံ စုစုပေါင်း</span>
              <span className="font-semibold text-slate-700 font-mono tabular-nums">100%</span>
            </div>
          </div>

          {/* Card 2: ငှားပြီး အခန်း (Occupied Rooms) - မီးနီ Theme */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs transition-all hover:border-rose-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-rose-500"></span>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  ငှားပြီး အခန်း
                </span>
              </div>
              <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-rose-600 font-mono tabular-nums">
                {occupiedRooms}
              </span>
              <span className="text-xs text-slate-500 font-medium">ခန်း (Occupied)</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
              <span>Occupancy Rate</span>
              <span className="font-semibold text-rose-600 font-mono tabular-nums">
                {occupancyRate}%
              </span>
            </div>
          </div>

          {/* Card 3: လွတ်နေသော အခန်း (Available Rooms) - မီးစိမ်း Theme */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs transition-all hover:border-emerald-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  လွတ်နေသော အခန်း
                </span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-emerald-600 font-mono tabular-nums">
                {availableRooms}
              </span>
              <span className="text-xs text-slate-500 font-medium">ခန်း (Ready to Lease)</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
              <span>Vacancy Rate</span>
              <span className="font-semibold text-emerald-600 font-mono tabular-nums">
                {totalRooms > 0 ? Math.round((availableRooms / totalRooms) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Card 4: ပြုပြင်ဆဲ / ဝင်ငွေအခြေအနေ (Maintenance & Revenue) */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs transition-all hover:border-amber-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  ပြုပြင်ဆဲ အခန်းများ
                </span>
              </div>
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                <Wrench className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-amber-600 font-mono tabular-nums">
                {maintenanceRooms}
              </span>
              <span className="text-xs text-slate-500 font-medium">ခန်း (Under repair)</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
              <span>လက်ရှိလစဉ်ရငွေ</span>
              <span className="font-semibold text-slate-800 font-mono tabular-nums">
                {currentCollectedRent.toLocaleString()} Ks
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* 2. FILTER & CONTROLS TOOLBAR */}
      {/* ============================================================== */}
      <section className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="အခန်းနံပါတ် သို့မဟုတ် ငှားသူအမည် ရှာဖွေပါ (Search room / tenant)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50/70 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-1"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter selectors & View switch */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Segmented Filter */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                အားလုံး ({rooms.length})
              </button>
              <button
                onClick={() => setStatusFilter('available')}
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'available'
                    ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                လွတ် ({availableRooms})
              </button>
              <button
                onClick={() => setStatusFilter('occupied')}
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'occupied'
                    ? 'bg-white text-rose-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-rose-700'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                ငှားပြီး ({occupiedRooms})
              </button>
              <button
                onClick={() => setStatusFilter('maintenance')}
                className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'maintenance'
                    ? 'bg-white text-amber-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-amber-700'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                ပြုပြင်ဆဲ ({maintenanceRooms})
              </button>
            </div>

            {/* Floor Dropdown */}
            <div className="relative">
              <select
                value={floorFilter}
                onChange={(e) =>
                  setFloorFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                }
                className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="all">အလွှာအားလုံး (All Floors)</option>
                {availableFloors.map((floor) => (
                  <option key={floor} value={floor}>
                    Floor {floor} (အလွှာ {floor})
                  </option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle (Grid vs Table) */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Grid View (ကတ်ပုံစံဖြင့် ပြသခြင်း)"
                aria-label="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Table View (ဇယားပုံစံဖြင့် ပြသခြင်း)"
                aria-label="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              title="Download CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </button>

            {/* Add Room Button (Admin Only) */}
            <button
              onClick={() => {
                if (!isAdmin) {
                  onRequestAdminLogin();
                  return;
                }
                setIsAddModalOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg shadow-xs transition-colors ${
                isAdmin
                  ? 'text-white bg-indigo-600 hover:bg-indigo-700'
                  : 'text-indigo-950 bg-indigo-100 hover:bg-indigo-200 border border-indigo-200'
              }`}
              title={isAdmin ? 'အခန်းအသစ်ထည့်ရန်' : 'အိမ်ရှင် (Admin) သာ အခန်းအသစ်ထည့်သွင်းခွင့်ရှိပါသည်'}
            >
              {isAdmin ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-indigo-700" />}
              <span>အခန်းအသစ်ထည့်ရန်</span>
            </button>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {(statusFilter !== 'all' || floorFilter !== 'all' || searchQuery) && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              ရလဒ် စုစုပေါင်း: <strong className="text-slate-800 font-mono tabular-nums">{filteredRooms.length}</strong> ခန်း တွေ့ရှိသည်
            </div>
            <button
              onClick={() => {
                setStatusFilter('all');
                setFloorFilter('all');
                setTypeFilter('all');
                setSearchQuery('');
              }}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              စစ်ထုတ်မှုများ ပြန်လည်ရှင်းလင်းရန် (Clear filters)
            </button>
          </div>
        )}
      </section>

      {/* ============================================================== */}
      {/* 3. ROOM STATUS VIEW (GRID OR TABLE) */}
      {/* ============================================================== */}
      {filteredRooms.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">အခန်းရှာမတွေ့ပါ</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            ရွေးချယ်ထားသော စစ်ထုတ်ချက်များနှင့် ကိုက်ညီသည့် အခန်းများ မရှိသေးပါ။
          </p>
          <button
            onClick={() => {
              setStatusFilter('all');
              setFloorFilter('all');
              setSearchQuery('');
            }}
            className="mt-4 px-4 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            စစ်ထုတ်ချက် အားလုံးကို ဖျက်ပါ
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* ------------------------------------------------------------ */
        /* GRID VIEW: Clean & Modern Card Presentation                  */
        /* ------------------------------------------------------------ */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRooms.map((room) => {
            const isAvailable = room.status === 'available';
            const isOccupied = room.status === 'occupied';
            const isMaintenance = room.status === 'maintenance';

            return (
              <div
                key={room.id}
                className={`bg-white rounded-xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  isAvailable
                    ? 'border-slate-200 hover:border-emerald-300'
                    : isOccupied
                    ? 'border-slate-200 hover:border-rose-300'
                    : 'border-slate-200 hover:border-amber-300'
                }`}
              >
                {/* Header: Room Number, Floor, Status Badge */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/40">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold font-mono text-slate-900">
                          {room.roomNumber}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          Floor {room.floor}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{room.roomType}</p>
                    </div>
                    {/* Status Badge with Color-coded light */}
                    <div>{getStatusBadge(room.status)}</div>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-4 space-y-3 flex-1">
                  {/* Monthly Rent */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">လစဉ်ငှားခ (Monthly Rent)</span>
                    <span className="font-bold text-slate-900 font-mono tabular-nums text-sm">
                      {formatRent(room.monthlyRent, room.currency)}
                    </span>
                  </div>

                  {/* Tenant Details */}
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100/80">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>ငှားရမ်းသူ (Tenant)</span>
                      {room.tenantPhone && (
                        <span className="font-mono text-[11px] text-slate-600 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {room.tenantPhone}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-800 truncate">
                      {room.tenantName ? (
                        room.tenantName
                      ) : (
                        <span className="text-slate-400 italic font-normal">
                          လစ်လပ်နေပါသည် (No tenant)
                        </span>
                      )}
                    </div>
                    {room.leaseStartDate && (
                      <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Lease: {room.leaseStartDate} ~ {room.leaseEndDate || 'Ongoing'}</span>
                      </div>
                    )}
                  </div>

                  {/* Room Notes (if any) */}
                  {room.notes && (
                    <div className="text-[11px] text-slate-500 bg-slate-50/50 p-2 rounded border border-slate-100 line-clamp-2">
                      {room.notes}
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                  {/* Quick Action based on current status */}
                  {isAvailable && (
                    <button
                      onClick={() => {
                        if (!isAdmin) {
                          onRequestAdminLogin();
                          return;
                        }
                        setQuickActionRoom(room);
                        setTenantInputName('');
                        setTenantInputPhone('');
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                      title={isAdmin ? 'ငှားရမ်းသူထည့်သွင်းမည်' : 'အိမ်ရှင် (Admin) သာ ပြင်ဆင်ခွင့်ရှိပါသည်'}
                    >
                      {isAdmin ? <UserPlus className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3 text-emerald-600" />}
                      <span>ငှားရမ်းသူထည့်သွင်းမည်</span>
                    </button>
                  )}

                  {isOccupied && (
                    <button
                      onClick={() => {
                        if (!isAdmin) {
                          onRequestAdminLogin();
                          return;
                        }
                        if (
                          confirm(
                            `အခန်း ${room.roomNumber} မှ အခန်းငှားသူ ${room.tenantName || ''} ကို Check-out လုပ်ပြီး အခန်းအား Available ပြန်လုပ်မည်လား?`
                          )
                        ) {
                          onUpdateStatus(room.id, 'available', null);
                        }
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                      title={isAdmin ? 'Check-out' : 'အိမ်ရှင် (Admin) သာ ပြင်ဆင်ခွင့်ရှိပါသည်'}
                    >
                      {isAdmin ? <UserMinus className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3 text-rose-600" />}
                      <span>Check-out / လွတ်လပ်ရန်</span>
                    </button>
                  )}

                  {isMaintenance && (
                    <button
                      onClick={() => {
                        if (!isAdmin) {
                          onRequestAdminLogin();
                          return;
                        }
                        onUpdateStatus(room.id, 'available', null);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                      title={isAdmin ? 'Mark Ready' : 'အိမ်ရှင် (Admin) သာ ပြင်ဆင်ခွင့်ရှိပါသည်'}
                    >
                      {isAdmin ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3 text-amber-600" />}
                      <span>ပြုပြင်ပြီးစီး (Mark Ready)</span>
                    </button>
                  )}

                  {/* Edit Button */}
                  <button
                    onClick={() => {
                      if (!isAdmin) {
                        onRequestAdminLogin();
                        return;
                      }
                      setEditingRoom(room);
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition-colors"
                    title={isAdmin ? "အခန်းအချက်အလက် ပြင်ဆင်ရန်" : "အိမ်ရှင် (Admin) သာ ပြင်ဆင်ခွင့်ရှိပါသည်"}
                    aria-label="Edit room"
                  >
                    {isAdmin ? <Edit3 className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ------------------------------------------------------------ */
        /* TABLE VIEW: High-Density Enterprise Tabular Layout           */
        /* ------------------------------------------------------------ */
        <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">အခန်းနံပါတ် (Room)</th>
                  <th className="py-3 px-4">အလွှာ (Floor)</th>
                  <th className="py-3 px-4">အမျိုးအစား (Type)</th>
                  <th className="py-3 px-4 text-right">လစဉ်ငှားခ (Monthly Rent)</th>
                  <th className="py-3 px-4 text-center">အခြေအနေ (Status)</th>
                  <th className="py-3 px-4">ငှားသူအမည် (Tenant Name)</th>
                  <th className="py-3 px-4">ဖုန်းနံပါတ် (Contact)</th>
                  <th className="py-3 px-4 text-right">လုပ်ဆောင်ချက် (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRooms.map((room) => {
                  return (
                    <tr
                      key={room.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {room.roomNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono">
                        Floor {room.floor}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {room.roomType}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatRent(room.monthlyRent, room.currency)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(room.status)}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {room.tenantName ? (
                          room.tenantName
                        ) : (
                          <span className="text-slate-400 italic font-normal">
                            - လစ်လပ် -
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {room.tenantPhone || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {room.status === 'available' && (
                            <button
                              onClick={() => {
                                if (!isAdmin) {
                                  onRequestAdminLogin();
                                  return;
                                }
                                setQuickActionRoom(room);
                                setTenantInputName('');
                                setTenantInputPhone('');
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors flex items-center gap-1"
                              title={isAdmin ? 'Check-in' : 'အိမ်ရှင် (Admin) သာ ပြင်ဆင်ခွင့်ရှိပါသည်'}
                            >
                              {!isAdmin && <Lock className="w-3 h-3 text-emerald-600" />}
                              <span>Check-in</span>
                            </button>
                          )}
                          {room.status === 'occupied' && (
                            <button
                              onClick={() => {
                                if (!isAdmin) {
                                  onRequestAdminLogin();
                                  return;
                                }
                                if (
                                  confirm(
                                    `အခန်း ${room.roomNumber} ကို Check-out လုပ်မည်လား?`
                                  )
                                ) {
                                  onUpdateStatus(room.id, 'available', null);
                                }
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors flex items-center gap-1"
                              title={isAdmin ? 'Check-out' : 'အိမ်ရှင် (Admin) သာ ပြင်ဆင်ခွင့်ရှိပါသည်'}
                            >
                              {!isAdmin && <Lock className="w-3 h-3 text-rose-600" />}
                              <span>Check-out</span>
                            </button>
                          )}
                          {room.status === 'maintenance' && (
                            <button
                              onClick={() => {
                                if (!isAdmin) {
                                  onRequestAdminLogin();
                                  return;
                                }
                                onUpdateStatus(room.id, 'available', null);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 transition-colors flex items-center gap-1"
                              title={isAdmin ? 'Ready' : 'အိမ်ရှင် (Admin) သာ ပြင်ဆင်ခွင့်ရှိပါသည်'}
                            >
                              {!isAdmin && <Lock className="w-3 h-3 text-amber-600" />}
                              <span>Ready</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (!isAdmin) {
                                onRequestAdminLogin();
                                return;
                              }
                              setEditingRoom(room);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                            title={isAdmin ? "Edit Room" : "အိမ်ရှင် (Admin) သာ ပြင်ဆင်ခွင့်ရှိပါသည်"}
                          >
                            {isAdmin ? <Edit3 className="w-3.5 h-3.5" /> : <Lock className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MODAL: ADD NEW ROOM (အခန်းအသစ်ထည့်သွင်းခြင်း) */}
      {/* ============================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">
                  အခန်းအသစ် ထည့်သွင်းရန် (Add New Room)
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    အခန်းနံပါတ် (Room Number) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ဥပမာ- 105, 204"
                    value={newRoomNumber}
                    onChange={(e) => setNewRoomNumber(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    အလွှာ (Floor) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={newRoomFloor}
                    onChange={(e) => setNewRoomFloor(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    အခန်းအမျိုးအစား (Room Type)
                  </label>
                  <select
                    value={newRoomType}
                    onChange={(e) => setNewRoomType(e.target.value as RoomType)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="Studio">Studio (စတူဒီယို)</option>
                    <option value="1 Bedroom">1 Bedroom (၁ ခန်းတွဲ)</option>
                    <option value="2 Bedroom">2 Bedroom (၂ ခန်းတွဲ)</option>
                    <option value="3 Bedroom">3 Bedroom (၃ ခန်းတွဲ)</option>
                    <option value="Penthouse">Penthouse (ခေါင်မိုးထပ်)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    လစဉ်ငှားခ (Monthly Rent - MMK) *
                  </label>
                  <input
                    type="number"
                    step={10000}
                    required
                    value={newRoomRent}
                    onChange={(e) => setNewRoomRent(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  အခြေအနေ (Status)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRoomStatus('available')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors ${
                      newRoomStatus === 'available'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Available (လွတ်လပ်)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRoomStatus('occupied')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors ${
                      newRoomStatus === 'occupied'
                        ? 'border-rose-500 bg-rose-50 text-rose-700 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Occupied (ငှားပြီး)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRoomStatus('maintenance')}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors ${
                      newRoomStatus === 'maintenance'
                        ? 'border-amber-500 bg-amber-50 text-amber-700 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Maintenance (ပြုပြင်ဆဲ)
                  </button>
                </div>
              </div>

              {newRoomStatus === 'occupied' && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      အခန်းငှားသူအမည် (Tenant Name)
                    </label>
                    <input
                      type="text"
                      placeholder="ဥပမာ- ကိုအောင်မင်း"
                      value={newTenantName}
                      onChange={(e) => setNewTenantName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ဖုန်းနံပါတ် (Contact Phone)
                    </label>
                    <input
                      type="text"
                      placeholder="ဥပမာ- 09-12345678"
                      value={newTenantPhone}
                      onChange={(e) => setNewTenantPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  မှတ်ချက် (Notes)
                </label>
                <textarea
                  rows={2}
                  placeholder="အခန်းနှင့်ပတ်သက်သော မှတ်ချက်များ..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  မလုပ်တော့ပါ (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
                >
                  အခန်းသိမ်းဆည်းမည် (Save Room)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. MODAL: QUICK CHECK-IN TENANT */}
      {/* ============================================================== */}
      {quickActionRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ငှားရမ်းသူ အသစ် စာရင်းသွင်းခြင်း
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  အခန်း {quickActionRoom.roomNumber} ({quickActionRoom.roomType})
                </p>
              </div>
              <button
                onClick={() => setQuickActionRoom(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!tenantInputName.trim()) return;
                onUpdateRoom({
                  ...quickActionRoom,
                  status: 'occupied',
                  tenantName: tenantInputName.trim(),
                  tenantPhone: tenantInputPhone.trim() || undefined,
                  leaseStartDate: new Date().toISOString().slice(0, 10),
                });
                setQuickActionRoom(null);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ငှားရမ်းသူအမည် (Tenant Name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ဥပမာ- ကိုအောင်မင်း"
                  value={tenantInputName}
                  onChange={(e) => setTenantInputName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ဆက်သွယ်ရန်ဖုန်းနံပါတ် (Phone Number)
                </label>
                <input
                  type="text"
                  placeholder="09-xxxxxxxxx"
                  value={tenantInputPhone}
                  onChange={(e) => setTenantInputPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-xs text-emerald-800">
                <span className="font-semibold">လစဉ်ငှားခ:</span>{' '}
                <span className="font-mono font-bold">
                  {formatRent(quickActionRoom.monthlyRent, quickActionRoom.currency)}
                </span>
                <p className="mt-1 text-[11px] text-emerald-700">
                  အတည်ပြုပြီးပါက အခန်းအခြေအနေသည် "Occupied (ငှားပြီး)" သို့ အလိုအလျောက် ပြောင်းလဲသွားပါမည်။
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickActionRoom(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                >
                  Check-in အတည်ပြုမည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. MODAL: EDIT ROOM DETAILS & STATUS */}
      {/* ============================================================== */}
      {editingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  အခန်း {editingRoom.roomNumber} အချက်အလက် ပြင်ဆင်ရန်
                </h3>
                <p className="text-xs text-slate-500">
                  Floor {editingRoom.floor} · {editingRoom.roomType}
                </p>
              </div>
              <button
                onClick={() => setEditingRoom(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateRoom(editingRoom);
                setEditingRoom(null);
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    အခန်းနံပါတ်
                  </label>
                  <input
                    type="text"
                    value={editingRoom.roomNumber}
                    onChange={(e) =>
                      setEditingRoom({ ...editingRoom, roomNumber: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    လစဉ်ငှားခ (MMK)
                  </label>
                  <input
                    type="number"
                    step={10000}
                    value={editingRoom.monthlyRent}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        monthlyRent: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  အခြေအနေ (Status)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingRoom({
                        ...editingRoom,
                        status: 'available',
                        tenantName: null,
                        tenantPhone: undefined,
                      })
                    }
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors ${
                      editingRoom.status === 'available'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Available (လွတ်လပ်)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingRoom({
                        ...editingRoom,
                        status: 'occupied',
                      })
                    }
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors ${
                      editingRoom.status === 'occupied'
                        ? 'border-rose-500 bg-rose-50 text-rose-700 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Occupied (ငှားပြီး)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingRoom({
                        ...editingRoom,
                        status: 'maintenance',
                      })
                    }
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-colors ${
                      editingRoom.status === 'maintenance'
                        ? 'border-amber-500 bg-amber-50 text-amber-700 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Maintenance (ပြုပြင်ဆဲ)
                  </button>
                </div>
              </div>

              {editingRoom.status === 'occupied' && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ငှားသူအမည် (Tenant Name)
                    </label>
                    <input
                      type="text"
                      value={editingRoom.tenantName || ''}
                      onChange={(e) =>
                        setEditingRoom({ ...editingRoom, tenantName: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ဖုန်းနံပါတ် (Phone Number)
                    </label>
                    <input
                      type="text"
                      value={editingRoom.tenantPhone || ''}
                      onChange={(e) =>
                        setEditingRoom({ ...editingRoom, tenantPhone: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  မှတ်ချက် (Notes)
                </label>
                <textarea
                  rows={2}
                  value={editingRoom.notes || ''}
                  onChange={(e) =>
                    setEditingRoom({ ...editingRoom, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  အပြောင်းအလဲ သိမ်းဆည်းမည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
