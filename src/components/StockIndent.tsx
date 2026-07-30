import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Material, Vendor } from '../types';
import { Package, Truck, AlertTriangle, ArrowRight, Download, Calculator } from 'lucide-react';
import { motion } from 'motion/react';

interface VendorIndent {
  vendorName: string;
  vendorId?: string;
  items: {
    name: string;
    currentStock: number;
    minStock: number;
    required: number;
    unitPrice: number;
    totalValue: number;
  }[];
  totalVendorValue: number;
}

export default function StockIndent() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubMaterials = onSnapshot(query(collection(db, 'materials')), (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material)));
      setLoading(false);
    });

    const unsubVendors = onSnapshot(query(collection(db, 'vendors')), (snapshot) => {
      setVendors(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor)));
    });

    return () => {
      unsubMaterials();
      unsubVendors();
    };
  }, []);

  // Calculate indents: items where currentStock <= minStock
  // Group them by vendor
  const indentData = materials.reduce((acc: Record<string, VendorIndent>, m) => {
    const current = Number(m.currentStock) || 0;
    const min = Number(m.minStock) || 0;
    
    if (min > 0 && current <= min) {
      const vendorKey = m.vendorName || 'Unassigned';
      if (!acc[vendorKey]) {
        acc[vendorKey] = {
          vendorName: vendorKey,
          vendorId: m.vendorId,
          items: [],
          totalVendorValue: 0
        };
      }
      
      // Calculate how much to order: enough to reach 2x minStock as a safe buffer
      const required = Math.max(0, (min * 2) - current);
      const unitPrice = Number(m.unitPrice) || 0;
      const totalValue = required * unitPrice;
      
      acc[vendorKey].items.push({
        name: m.name,
        currentStock: current,
        minStock: min,
        required,
        unitPrice,
        totalValue
      });
      
      acc[vendorKey].totalVendorValue += totalValue;
    }
    return acc;
  }, {});

  const vendorIndents = (Object.values(indentData) as VendorIndent[]).sort((a, b) => b.totalVendorValue - a.totalVendorValue);
  const totalIndentValue = vendorIndents.reduce((sum, v) => sum + v.totalVendorValue, 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 font-bold uppercase tracking-widest">Loading indent data...</div>;
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gray-900 p-10 rounded-[2.5rem] text-white shadow-2xl shadow-gray-200">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tight leading-none">Stock Indent Report</h2>
          <p className="text-gray-400 text-xs font-bold mt-2 uppercase tracking-widest">Replenishment value calculated per vendor</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Estimated Value</p>
          <p className="text-5xl font-black tracking-tighter">₹{totalIndentValue.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {vendorIndents.map((indent) => (
          <motion.div
            key={indent.vendorName}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden"
          >
            <div className="p-8 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center text-white">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">{indent.vendorName}</h3>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{indent.items.length} items need replenishment</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Vendor Indent Value</p>
                <p className="text-2xl font-black text-gray-900 tracking-tighter">₹{indent.totalVendorValue.toLocaleString()}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/30">
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Material Name</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Stock / Min</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Required Qty</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Unit Price</th>
                    <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Estimated Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {indent.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-8 py-5">
                        <span className="text-sm font-bold text-gray-900">{item.name}</span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">{item.currentStock}</span>
                          <span className="text-gray-300">/</span>
                          <span className="text-xs font-bold text-gray-500">{item.minStock}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className="text-sm font-black text-blue-600">{item.required}</span>
                      </td>
                      <td className="px-8 py-5 text-right font-medium text-gray-500">₹{item.unitPrice.toLocaleString()}</td>
                      <td className="px-8 py-5 text-right font-black text-gray-900">₹{item.totalValue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ))}

        {vendorIndents.length === 0 && (
          <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-gray-200">
            <Calculator className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-bold uppercase tracking-widest">No indents required. All stock levels are healthy.</p>
          </div>
        )}
      </div>
    </div>
  );
}
