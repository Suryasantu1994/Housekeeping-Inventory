import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, addDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Material, MaterialCategory } from '../types';
import { Edit2, Trash2, Plus, Minus, Search, Filter, MoreHorizontal, PackagePlus, AlertTriangle, ArrowDownRight, ArrowUpRight, FileDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { useAuth } from '../contexts/AuthContext';

export default function MaterialList() {
  const { user: currentUser } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'All'>('All');
  const [updateModal, setUpdateModal] = useState<{ id: string, name: string } | null>(null);
  const [updateAmount, setUpdateAmount] = useState(1);

  useEffect(() => {
    const path = 'materials';
    const q = query(collection(db, path), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
      setMaterials(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsubscribe();
  }, []);

  const exportToCSV = () => {
    if (filteredMaterials.length === 0) return;

    const headers = ['Item Name', 'Category', 'Unit', 'Current Stock', 'Min Stock', 'Unit Price (₹)', 'Total Value (₹)'];
    const rows = filteredMaterials.map(m => [
      m.name,
      m.category,
      m.unit,
      m.currentStock,
      m.minStock,
      m.unitPrice || 0,
      ((Number(m.currentStock) || 0) * (Number(m.unitPrice) || 0)).toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredMaterials = materials.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    const path = `materials/${id}`;
    try {
      await deleteDoc(doc(db, 'materials', id));
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleUpdateStock = async (type: 'in' | 'out') => {
    if (!updateModal) return;

    try {
      const material = materials.find(m => m.id === updateModal.id);
      if (!material) return;

      const materialRef = doc(db, 'materials', updateModal.id);
      const amount = type === 'in' ? updateAmount : -updateAmount;

      const updateData: any = {
        currentStock: increment(amount),
      };

      if (type === 'in') {
        updateData.lastRestocked = new Date().toISOString();
      }

      await updateDoc(materialRef, updateData);

      await addDoc(collection(db, 'transactions'), {
        materialId: updateModal.id,
        materialName: updateModal.name,
        type,
        quantity: updateAmount,
        unitPrice: material.unitPrice || 0,
        timestamp: serverTimestamp(),
        userId: currentUser?.uid,
        userName: currentUser?.displayName || 'Unknown',
        note: `Manual stock adjustment (${type})`
      });

      setUpdateModal(null);
      setUpdateAmount(1);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'stock_update');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading inventory...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search materials..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select
            className="flex-1 md:w-48 px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer font-medium"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
          >
            <option value="All">All Categories</option>
            <option value="Cleaning Supplies">Cleaning Supplies</option>
            <option value="Linens">Linens</option>
            <option value="Guest Supplies">Guest Supplies</option>
            <option value="Toiletries">Toiletries</option>
            <option value="Tools">Tools</option>
            <option value="Other">Other</option>
          </select>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors shrink-0 font-bold text-sm"
            title="Export CSV"
          >
            <FileDown className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Item Name</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Stock</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredMaterials.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-400">Unit: {item.unit}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-lg font-bold ${
                      item.currentStock <= item.minStock ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {item.currentStock}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {item.currentStock <= item.minStock ? (
                      <span className="flex items-center gap-1.5 text-red-600 text-xs font-bold uppercase">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Low Stock
                      </span>
                    ) : (
                      <span className="text-green-600 text-xs font-bold uppercase">In Stock</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        type="button"
                        onClick={() => setUpdateModal({ id: item.id, name: item.name })}
                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                        title="Adjust Stock"
                      >
                        <PackagePlus className="w-4 h-4" />
                      </button>
                      
                      {deleteConfirm === item.id ? (
                        <div className="flex items-center gap-1 bg-red-50 rounded-lg p-1 animate-in fade-in zoom-in duration-200">
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded uppercase hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 text-gray-400 text-[10px] font-bold rounded uppercase hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => setDeleteConfirm(item.id)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {updateModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">Adjust Stock</h3>
              <p className="text-gray-500 mb-6 text-sm">Update quantity for <span className="font-semibold">{updateModal.name}</span></p>
              
              <div className="flex items-center justify-center gap-6 mb-8">
                <button 
                  onClick={() => setUpdateAmount(prev => Math.max(1, prev - 1))}
                  className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <Minus className="w-6 h-6" />
                </button>
                <span className="text-4xl font-black text-gray-900 tabular-nums">{updateAmount}</span>
                <button 
                  onClick={() => setUpdateAmount(prev => prev + 1)}
                  className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleUpdateStock('out')}
                  className="py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowDownRight className="w-5 h-5" />
                  Used
                </button>
                <button
                  onClick={() => handleUpdateStock('in')}
                  className="py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowUpRight className="w-5 h-5" />
                  Received
                </button>
                <button
                  onClick={() => setUpdateModal(null)}
                  className="col-span-2 mt-2 py-2 text-gray-400 font-medium hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
