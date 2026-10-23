import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { MaterialCategory, Vendor } from '../types';
import { X, Save } from 'lucide-react';
import { motion } from 'motion/react';

import { useAuth } from '../contexts/AuthContext';

interface AddMaterialFormProps {
  onClose: () => void;
}

export default function AddMaterialForm({ onClose }: AddMaterialFormProps) {
  const { user: currentUser } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    vendorId: '',
    vendorName: '',
    category: 'Cleaning Supplies' as MaterialCategory,
    unit: 'Pieces',
    currentStock: 0,
    minStock: 5,
    unitPrice: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'vendors'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vendorData: Vendor[] = [];
      snapshot.forEach((doc) => {
        vendorData.push({ id: doc.id, ...doc.data() } as Vendor);
      });
      setVendors(vendorData.sort((a, b) => a.name.localeCompare(b.name)));
    });
    return () => unsubscribe();
  }, []);

  const totalValue = formData.currentStock * formData.unitPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const path = 'materials';
    try {
      await addDoc(collection(db, path), {
        ...formData,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.uid,
        createdByName: currentUser?.displayName || 'Unknown'
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-xl"
      />
      <motion.div 
        initial={{ y: 40, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] relative border border-gray-100"
      >
        <button 
          onClick={onClose}
          className="absolute right-8 top-8 p-3 hover:bg-gray-100 rounded-2xl text-gray-400 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-8">
          <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight leading-none">New Material</h3>
          <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Register a new inventory item</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Item Name</label>
            <input
              required
              type="text"
              className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
              placeholder="e.g., Hand Soap"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Vendor</label>
            <select
              className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-inner appearance-none"
              value={formData.vendorId}
              onChange={(e) => {
                const vendorId = e.target.value;
                const vendor = vendors.find(v => v.id === vendorId);
                setFormData(prev => ({ 
                  ...prev, 
                  vendorId, 
                  vendorName: vendor?.name || '' 
                }));
              }}
            >
              <option value="">Select Vendor...</option>
              {vendors.map(vendor => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Category</label>
              <select
                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-inner appearance-none"
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
              >
                <option value="Cleaning Supplies">Cleaning</option>
                <option value="Linens">Linens</option>
                <option value="Guest Supplies">Guest</option>
                <option value="Toiletries">Toiletries</option>
                <option value="Tools">Tools</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Unit</label>
              <input
                required
                type="text"
                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                placeholder="e.g., Pieces"
                value={formData.unit}
                onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Initial Stock</label>
              <input
                required
                type="number"
                min="0"
                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                value={formData.currentStock}
                onChange={(e) => setFormData(prev => ({ ...prev, currentStock: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Unit Price (₹)</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                value={formData.unitPrice}
                onChange={(e) => setFormData(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Min. Stock</label>
              <input
                required
                type="number"
                min="0"
                className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                value={formData.minStock}
                onChange={(e) => setFormData(prev => ({ ...prev, minStock: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col justify-center">
              <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Valuation</span>
              <span className="text-lg font-black text-blue-600 tracking-tighter">
                ₹{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          <div className="pt-4">
            <button
              disabled={isSubmitting}
              type="submit"
              className="w-full py-5 bg-gray-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {isSubmitting ? 'Saving...' : 'Save Material'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
