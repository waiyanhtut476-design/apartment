export type RoomStatusType = 'available' | 'occupied' | 'maintenance';

export type RoomType = 'Studio' | '1 Bedroom' | '2 Bedroom' | '3 Bedroom' | 'Penthouse';

export interface Room {
  id: string;
  roomNumber: string;
  floor: number;
  roomType: RoomType;
  monthlyRent: number;
  currency: string;
  status: RoomStatusType;
  tenantName: string | null;
  tenantPhone?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  notes?: string;
}

export type ViewMode = 'grid' | 'table';

export interface RoomFilterState {
  status: 'all' | RoomStatusType;
  floor: 'all' | number;
  roomType: 'all' | RoomType;
  searchQuery: string;
}

export interface UtilityBill {
  id: string;
  roomId: string;
  roomNumber: string;
  tenantName: string | null;
  billMonth: string;
  createdAt: string;
  roomRent: number;
  electricPrev: number;
  electricCurrent: number;
  electricUnits: number;
  electricRate: number;
  electricTotal: number;
  waterPrev: number;
  waterCurrent: number;
  waterUnits: number;
  waterRate: number;
  waterTotal: number;
  commonFee: number;
  grandTotal: number;
  currency: string;
  status: 'unpaid' | 'paid';
  notes?: string;
}

export interface AdminUser {
  email: string;
  name: string;
  role: 'admin';
  isAuthenticated: boolean;
  loginTime?: string;
}
