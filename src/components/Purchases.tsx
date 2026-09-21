import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, runTransaction, deleteDoc } from 'firebase/firestore';
import { Purchase, PurchaseItem, Vendor, Material } from '../types';
import { Plus, Search, X, ShoppingCart, Truck, Calendar, Save, Trash2, CheckCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

export default function Purchases() {
  const { user: currentUser } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [receivingId, setReceivingId] = useState<string | null>(null);

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
    setIsSubmitting(true);
    try {
      await runTransaction(db, async (transaction) => {
        // 1. Gather all material refs for items
        const itemsToProcess = purchase.items.filter(item => !!item.materialId);
        const materialRefs = itemsToProcess.map(item => doc(db, 'materials', item.materialId));

        // 2. DO ALL READS FIRST
        const materialSnaps = await Promise.all(materialRefs.map(ref => transaction.get(ref)));

        // 3. NOW DO ALL WRITES
        const purchaseRef = doc(db, 'purchases', purchase.id);
        transaction.update(purchaseRef, { 
          status: 'received', 
          receivedAt: new Date().toISOString() 
        });

        itemsToProcess.forEach((item, index) => {
          const materialSnap = materialSnaps[index];
          const materialRef = materialRefs[index];
          
          if (materialSnap.exists()) {
            const currentStock = materialSnap.data().currentStock || 0;
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
              building: 'General Inventory',
              userId: currentUser?.uid,
              userName: currentUser?.displayName || 'System',
              note: `Purchase Order Received (${purchase.vendorName})`
            });
          }
        });
      });
      setReceivingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `purchases/${purchase.id}/receive`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'purchases', id));
      setDeletingId(null);
    } catch (error) {
      console.error("Error deleting purchase:", error);
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
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
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
                  
                  <div className="flex items-center gap-2">
                    {deletingId === purchase.id ? (
                      <div className="flex items-center gap-2 bg-red-50 p-1 rounded-xl border border-red-100">
                        <span className="text-[10px] font-black text-red-600 uppercase tracking-widest px-2">Confirm?</span>
                        <button
                          onClick={() => handleDelete(purchase.id)}
                          className="px-3 py-1 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-700 transition-all"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-3 py-1 bg-gray-200 text-gray-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-gray-300 transition-all"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(purchase.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        title="Delete Purchase Order"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
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
                  <div className="mt-8 space-y-3">
                    {receivingId === purchase.id ? (
                      <div className="p-5 bg-blue-50 rounded-[1.5rem] border border-blue-100 shadow-inner">
                        <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest text-center mb-4">Confirm receiving inventory?</p>
                        <div className="flex gap-2">
                          <button
                            disabled={isSubmitting}
                            onClick={() => handleReceive(purchase)}
                            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isSubmitting ? 'Processing...' : 'Yes, Confirm'}
                          </button>
                          <button
                            disabled={isSubmitting}
                            onClick={() => setReceivingId(null)}
                            className="flex-1 py-3 bg-white text-gray-500 border border-gray-200 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-50 transition-all active:scale-95"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setReceivingId(purchase.id)}
                        className="flex items-center justify-center gap-3 w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95"
                      >
                        <CheckCircle className="w-5 h-5" />
                        Mark Received
                      </button>
                    )}
                  </div>
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
                    <div className="grid grid-cols-12 gap-4 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest hidden md:grid">
                      <div className="col-span-4">Material</div>
                      <div className="col-span-2">Quantity</div>
                      <div className="col-span-2">Price</div>
                      <div className="col-span-3">Subtotal</div>
                      <div className="col-span-1"></div>
                    </div>
                    {formData.items.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group">
                        <div className="md:col-span-4">
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
                        <div className="md:col-span-2">
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
                        <div className="md:col-span-2">
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
                        <div className="md:col-span-3 flex items-center px-2">
                          <div className="w-full text-right">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2 md:hidden">Subtotal:</span>
                            <span className="text-sm font-black text-gray-900">₹{(item.quantity * item.unitPrice).toLocaleString()}</span>
                          </div>
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

                {formData.items.length > 0 && (
                  <div className="flex justify-end items-center gap-4 px-8 py-6 bg-gray-900 rounded-[2rem] text-white">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Total Order Value</p>
                    <p className="text-3xl font-black tracking-tighter">
                      ₹{formData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toLocaleString()}
                    </p>
                  </div>
                )}

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
