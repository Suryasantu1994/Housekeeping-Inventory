export type MaterialCategory = 'Cleaning Supplies' | 'Linens' | 'Guest Supplies' | 'Toiletries' | 'Tools' | 'Other';

export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  currentStock: number;
  minStock: number;
  unitPrice: number;
  vendorId?: string;
  vendorName?: string;
  lastRestocked?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  materialId: string;
  materialName?: string; // For display
  type: 'in' | 'out';
  quantity: number;
  unitPrice: number;
  timestamp: string;
  note?: string;
  building?: string;
  userId?: string;
  userName?: string;
}

export type RequisitionStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface RequisitionItem {
  materialId: string;
  materialName: string;
  quantity: number;
}

export interface Requisition {
  id: string;
  items: RequisitionItem[];
  building: string;
  status: RequisitionStatus;
  requesterName: string;
  timestamp: string;
  date: string;
  note?: string;
}

export interface Building {
  id: string;
  name: string;
}

export interface Vendor {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt: string;
}

export interface PurchaseItem {
  materialId: string;
  materialName: string;
  quantity: number;
  unitPrice: number;
}

export interface Purchase {
  id: string;
  vendorId: string;
  vendorName: string;
  items: PurchaseItem[];
  totalAmount: number;
  status: 'pending' | 'received' | 'cancelled';
  timestamp: string;
  receivedAt?: string;
  note?: string;
}

export interface StockAlert {
  materialId: string;
  name: string;
  currentStock: number;
  minStock: number;
  severity: 'low' | 'critical';
}
