import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Requisition, RequisitionStatus, Material, RequisitionItem, Building } from '../types';
import { FileText, Plus, Clock, CheckCircle2, XCircle, Trash2, User, Package, Building2, Minus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { useAuth } from '../contexts/AuthContext';

export default function Requisitions() {
  const { user: currentUser } = useAuth();
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<string>('');

  const [formData, setFormData] = useState({
    building: '',
    items: [{ materialId: '', quantity: 1 }] as { materialId: string; quantity: number }[],
    requesterName: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  useEffect(() => {
    const reqPath = 'requisitions';
    const matPath = 'materials';
    const buildPath = 'buildings';
    
    const qReq = query(collection(db, reqPath), orderBy('timestamp', 'desc'));
    const unsubReq = onSnapshot(qReq, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          timestamp: data.timestamp && typeof data.timestamp.toDate === 'function' 
            ? data.timestamp.toDate().toISOString() 
            : (data.timestamp || new Date().toISOString())
        } as Requisition;
      });
      setRequisitions(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, reqPath);
    });

    const qMat = query(collection(db, matPath), orderBy('name', 'asc'));
    const unsubMat = onSnapshot(qMat, (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material)));
    });

    const qBuild = query(collection(db, buildPath), orderBy('name', 'asc'));
    const unsubBuild = onSnapshot(qBuild, (snapshot) => {
      setBuildings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Building)));
    });

    return () => {
      unsubReq();
      unsubMat();
      unsubBuild();
    };
  }, []);

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { materialId: '', quantity: 1 }]
    }));
  };

  const removeItem = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateItem = (index: number, field: 'materialId' | 'quantity', value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }));
  };

  const totalRequisitionValue = formData.items.reduce((acc, item) => {
    const material = materials.find(m => m.id === item.materialId);
    return acc + (item.quantity * (material?.unitPrice || 0));
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate items
    const validItems: RequisitionItem[] = [];
    for (const item of formData.items) {
      const material = materials.find(m => m.id === item.materialId);
      if (material) {
        validItems.push({
          materialId: item.materialId,
          materialName: material.name,
          quantity: item.quantity
        });
      }
    }

    if (validItems.length === 0) return;

    try {
      await addDoc(collection(db, 'requisitions'), {
        building: formData.building,
        items: validItems,
        requesterName: formData.requesterName || currentUser?.displayName || 'Anonymous',
        userId: currentUser?.uid,
        date: formData.date,
        note: formData.note,
        status: 'pending',
        timestamp: new Date().toISOString()
      });
      setShowAddForm(false);
      setFormData({ 
        building: '', 
        items: [{ materialId: '', quantity: 1 }], 
        requesterName: '', 
        date: new Date().toISOString().split('T')[0],
        note: '' 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'requisitions');
    }
  };

  const updateStatus = async (id: string, status: RequisitionStatus) => {
    try {
      if (status === 'completed') {
        const req = requisitions.find(r => r.id === id);
        if (req) {
          // Process each item in the requisition
          for (const item of req.items) {
            const material = materials.find(m => m.id === item.materialId);
            const materialRef = doc(db, 'materials', item.materialId);
            const { increment } = await import('firebase/firestore');
            
            // Deduct stock
            await updateDoc(materialRef, {
              currentStock: increment(-item.quantity)
            });

            // Log transaction
            await addDoc(collection(db, 'transactions'), {
              materialId: item.materialId,
              materialName: item.materialName,
              quantity: item.quantity,
              unitPrice: material?.unitPrice || 0, // Include unit price for value tracking
              type: 'out',
              timestamp: new Date().toISOString(),
              building: req.building,
              userId: currentUser?.uid,
              userName: currentUser?.displayName || 'System',
              note: `Requisition ${req.id} - ${req.building} (${req.requesterName})`
            });
          }
        }
      }
      await updateDoc(doc(db, 'requisitions', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `requisitions/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'requisitions', id));
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `requisitions/${id}`);
    }
  };

  const getStatusColor = (status: RequisitionStatus) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'approved': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
      case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
  };

  const filteredRequisitions = requisitions.filter(req => {
    if (!filterDate) return true;
    const reqDate = req.date || new Date(req.timestamp).toISOString().split('T')[0];
    return reqDate === filterDate;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading requisitions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">REQUISITIONS</h2>
          <p className="text-sm text-gray-500 font-medium">Manage material requests and approvals</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter Date:</span>
            <input
              type="date"
              className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-gray-900 outline-none transition-all shadow-sm"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Clear Date Filter"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
          >
            <Plus className="w-5 h-5" />
            New Request
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddForm(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-10 border-b border-gray-100 flex items-center justify-between bg-gray-900 text-white">
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tight leading-none">New Requisition</h2>
                  <p className="text-gray-400 text-[10px] font-black mt-2 tracking-widest uppercase">Request Materials for building</p>
                </div>
                <button 
                  onClick={() => setShowAddForm(false)}
                  className="p-3 hover:bg-white/10 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Building Selection */}
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Target Building</label>
                    <div className="relative group">
                      <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                      <select
                        required
                        className="w-full pl-14 pr-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner appearance-none cursor-pointer"
                        value={formData.building}
                        onChange={(e) => setFormData(prev => ({ ...prev, building: e.target.value }))}
                      >
                        <option value="">Select Building...</option>
                        {buildings.map(b => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Requisition Date */}
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Request Date</label>
                    <div className="relative group">
                      <Clock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                      <input
                        required
                        type="date"
                        className="w-full pl-14 pr-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner cursor-pointer"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Requester Name */}
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Requester Name</label>
                    <div className="relative group">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                      <input
                        required
                        type="text"
                        placeholder="Enter name"
                        className="w-full pl-14 pr-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                        value={formData.requesterName}
                        onChange={(e) => setFormData(prev => ({ ...prev, requesterName: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Internal Note */}
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Internal Note</label>
                    <div className="relative group">
                      <FileText className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                      <input
                        type="text"
                        placeholder="Optional note"
                        className="w-full pl-14 pr-5 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                        value={formData.note}
                        onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Requested Materials</label>
                    <button
                      type="button"
                      onClick={addItem}
                      className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all"
                    >
                      <Plus className="w-3 h-3" /> Add Item
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {formData.items.map((item, index) => (
                      <motion.div 
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-4 items-center bg-gray-50 p-4 rounded-[1.5rem] group hover:bg-white hover:shadow-lg hover:shadow-gray-200/50 transition-all border border-transparent hover:border-gray-100"
                      >
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="md:col-span-3">
                            <select
                              required
                              className="w-full px-5 py-3 bg-white border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer shadow-sm"
                              value={item.materialId}
                              onChange={(e) => updateItem(index, 'materialId', e.target.value)}
                            >
                              <option value="">Select Material...</option>
                              {materials.map(m => (
                                <option key={m.id} value={m.id}>{m.name} ({m.currentStock} {m.unit})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <input
                              required
                              type="number"
                              min="1"
                              placeholder="Qty"
                              className="w-full px-5 py-3 bg-white border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm text-center"
                              value={item.quantity || ''}
                              onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="pt-6 mt-6 border-t border-gray-100 space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Estimated Total Value</span>
                    <span className="text-2xl font-black text-gray-900 tracking-tighter">
                      ₹{totalRequisitionValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full py-6 bg-gray-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-2xl shadow-gray-900/20 flex items-center justify-center gap-3 active:scale-95"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                    Submit Requisition
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="w-full mt-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
                  >
                    Cancel and Close
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredRequisitions.map((req) => (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(req.status)}`}>
                {req.status}
              </div>
              <div className="text-[10px] font-bold text-gray-400 flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(req.timestamp).toLocaleDateString()}
                </div>
                {req.date && (
                  <div className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                    Req Date: {new Date(req.date).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <Building2 className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Building</p>
                  <h4 className="font-bold text-gray-900 leading-tight">{req.building}</h4>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Materials Requested</p>
                <div className="space-y-1">
                  {req.items?.map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded-lg">
                      <span className="font-medium text-gray-700">{item.materialName}</span>
                      <span className="font-black text-gray-900">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-gray-50">
                <div className="p-2 bg-gray-50 rounded-lg">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-xs text-gray-600 font-bold">{req.requesterName}</p>
              </div>

              {req.note && (
                <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500 italic">
                  "{req.note}"
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between gap-2">
              <div className="flex gap-2">
                {req.status === 'pending' && (
                  <>
                    <button
                      onClick={() => updateStatus(req.id, 'approved')}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      title="Approve"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => updateStatus(req.id, 'rejected')}
                      className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      title="Reject"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                )}
                {req.status === 'approved' && (
                  <button
                    onClick={() => updateStatus(req.id, 'completed')}
                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                    title="Mark Completed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {deleteConfirm === req.id ? (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDelete(req.id)}
                    className="px-2 py-1 bg-red-600 text-white text-[10px] font-bold rounded uppercase hover:bg-red-700"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-2 py-1 text-gray-400 text-[10px] font-bold rounded uppercase hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(req.id)}
                  className="p-2 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition-colors"
                  title="Delete Request"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        ))}
        {filteredRequisitions.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
            <FileText className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-medium">No requisitions found</p>
          </div>
        )}
      </div>
    </div>
  );
}
