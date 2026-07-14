import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { Purchase, PurchaseItem, Vendor, Material } from '../types';
import { Plus, Search, X, ShoppingCart, Truck, Calendar, Save, Trash2, CheckCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Purchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    vendorId: '',
    items: [] as PurchaseItem[],
    note: ''
  });

  useEffect(() => {
    const qPurchases = query(collection(db, 'purchases'));
    const unsubscribePurchases = onSnapshot(qPurchases, (snapshot) => {
      const data: Purchase[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Purchase);
      });
      setPurchases(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    });

    const qVendors = query(collection(db, 'vendors'));
    const unsubscribeVendors = onSnapshot(qVendors, (snapshot) => {
      const data: Vendor[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Vendor);
      });
      setVendors(data);
    });

    const qMaterials = query(collection(db, 'materials'));
    const unsubscribeMaterials = onSnapshot(qMaterials, (snapshot) => {
      const data: Material[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Material);
      });
      setMaterials(data);
    });

    return () => {
      unsubscribePurchases();
      unsubscribeVendors();
      unsubscribeMaterials();
    };
  }, []);

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { materialId: '', materialName: '', quantity: 1, unitPrice: 0 }]
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      if (field === 'materialId') {
        const mat = materials.find(m => m.id === value);
        newItems[index] = { 
          ...newItems[index], 
          materialId: value, 
          materialName: mat?.name || '',
          unitPrice: mat?.unitPrice || 0
        };
      } else {
        newItems[index] = { ...newItems[index], [field]: value };
      }
      return { ...prev, items: newItems };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.items.length === 0) return;
    setIsSubmitting(true);

    try {
      const totalAmount = formData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const vendor = vendors.find(v => v.id === formData.vendorId);

      await addDoc(collection(db, 'purchases'), {
        vendorId: formData.vendorId,
        vendorName: vendor?.name || 'Unknown',
        items: formData.items,
        totalAmount,
        status: 'pending',
        timestamp: new Date().toISOString(),
        note: formData.note
      });

      setShowAddForm(false);
      setFormData({ vendorId: '', items: [], note: '' });
    } catch (error) {
      console.error("Error creating purchase:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReceive = async (purchase: Purchase) => {
    if (!window.confirm('Mark this purchase as received and update stock?')) return;

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Update purchase status
        const purchaseRef = doc(db, 'purchases', purchase.id);
        transaction.update(purchaseRef, { 
          status: 'received', 
          receivedAt: new Date().toISOString() 
        });

        // 2. Update material stock and create transactions
        for (const item of purchase.items) {
          const materialRef = doc(db, 'materials', item.materialId);
          const materialDoc = await transaction.get(materialRef);
          
          if (materialDoc.exists()) {
            const currentStock = materialDoc.data().currentStock || 0;
            transaction.update(materialRef, {
              currentStock: currentStock + item.quantity,
              lastRestocked: new Date().toISOString()
            });

            // Create stock-in transaction
            const transRef = doc(collection(db, 'transactions'));
            transaction.set(transRef, {
              materialId: item.materialId,
              materialName: item.materialName,
              type: 'in',
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              timestamp: new Date().toISOString(),
              note: `Purchase Order Received (${purchase.vendorName})`
            });
          }
        }
      });
    } catch (error) {
      console.error("Error receiving purchase:", error);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1">
          <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Purchases</h2>
          <p className="text-gray-500 font-medium">Manage procurement and vendor orders</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center justify-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Create Order
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {purchases.map((purchase) => (
          <motion.div
            key={purchase.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40"
          >
            <div className="flex flex-col lg:flex-row justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    purchase.status === 'received' ? 'bg-green-100 text-green-700' : 
                    purchase.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {purchase.status}
                  </div>
                  <span className="text-xs font-bold text-gray-400">
                    {new Date(purchase.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-2">{purchase.vendorName}</h3>
                <p className="text-sm font-medium text-gray-500 mb-6">{purchase.note || 'No notes added'}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {purchase.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div>
                        <p className="text-sm font-black text-gray-900">{item.materialName}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.quantity} units @ ₹{item.unitPrice}</p>
                      </div>
                      <p className="font-black text-gray-900">₹{(item.quantity * item.unitPrice).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:w-72 flex flex-col justify-between border-l border-gray-100 lg:pl-8">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Order Value</p>
                  <p className="text-4xl font-black text-gray-900 tracking-tighter">₹{purchase.totalAmount.toLocaleString()}</p>
                </div>
                
                {purchase.status === 'pending' && (
                  <button
                    onClick={() => handleReceive(purchase)}
                    className="mt-8 flex items-center justify-center gap-3 w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Mark Received
                  </button>
                )}
                {purchase.status === 'received' && (
                  <div className="mt-8 flex items-center gap-3 text-green-600 font-bold text-sm bg-green-50 p-4 rounded-2xl border border-green-100">
                    <CheckCircle className="w-5 h-5" />
                    Received on {new Date(purchase.receivedAt!).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}

        {purchases.length === 0 && (
          <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-gray-200">
            <ShoppingCart className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-bold uppercase tracking-widest">No purchase orders found</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ y: 40, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] relative border border-gray-100 overflow-y-auto max-h-[90vh]"
            >
              <button 
                onClick={() => setShowAddForm(false)}
                className="absolute right-8 top-8 p-3 hover:bg-gray-100 rounded-2xl text-gray-400 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-8">
                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight leading-none">New Purchase Order</h3>
                <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Create a record for incoming supplies</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Vendor</label>
                  <select
                    required
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-inner appearance-none"
                    value={formData.vendorId}
                    onChange={(e) => setFormData(prev => ({ ...prev, vendorId: e.target.value }))}
                  >
                    <option value="">Select Vendor...</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Order Items</label>
                    <button
                      type="button"
                      onClick={addItem}
                      className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1 hover:text-blue-700"
                    >
                      <Plus className="w-3 h-3" /> Add Item
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {formData.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 relative">
                        <div className="md:col-span-5">
                          <select
                            required
                            className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold text-gray-900 shadow-sm"
                            value={item.materialId}
                            onChange={(e) => updateItem(idx, 'materialId', e.target.value)}
                          >
                            <option value="">Select Material...</option>
                            {materials.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-3">
                          <input
                            type="number"
                            required
                            min="1"
                            placeholder="Qty"
                            className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold text-gray-900 shadow-sm"
                            value={item.quantity}
                            onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                          />
                        </div>
                        <div className="md:col-span-3">
                          <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            placeholder="Price"
                            className="w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-bold text-gray-900 shadow-sm"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(idx, 'unitPrice', Number(e.target.value))}
                          />
                        </div>
                        <div className="md:col-span-1 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {formData.items.length === 0 && (
                      <p className="text-center py-8 text-gray-400 text-xs font-bold uppercase tracking-widest border border-dashed border-gray-200 rounded-2xl">
                        Add items to your order
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Notes</label>
                  <textarea
                    rows={2}
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner resize-none"
                    placeholder="Any specific instructions or details..."
                    value={formData.note}
                    onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  />
                </div>

                <div className="pt-4">
                  <button
                    disabled={isSubmitting || formData.items.length === 0}
                    type="submit"
                    className="w-full py-5 bg-gray-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
                    {isSubmitting ? 'Creating Order...' : 'Create Purchase Order'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
