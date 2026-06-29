export type MaterialCategory = 'Cleaning Supplies' | 'Linens' | 'Guest Supplies' | 'Toiletries' | 'Tools' | 'Other';

export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  currentStock: number;
  minStock: number;
  unitPrice: number;
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
  note?: string;
}

export interface Building {
  id: string;
  name: string;
}

export interface StockAlert {
  materialId: string;
  name: string;
  currentStock: number;
  minStock: number;
  severity: 'low' | 'critical';
}
