import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Vendor, Material, PurchaseItem, MaterialCategory } from '../types';
import { Plus, Search, Edit2, Trash2, X, Phone, Mail, MapPin, User, Save, Building2, ShoppingCart, Package, Minus, ListChecks, Check, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../lib/firebase';

export default function Vendors() {
  const { user: currentUser } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVendorForOrder, setSelectedVendorForOrder] = useState<Vendor | null>(null);
  const [managingCatalogVendor, setManagingCatalogVendor] = useState<Vendor | null>(null);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [orderItems, setOrderItems] = useState<{ materialId: string; quantity: number }[]>([]);
  const [orderNote, setOrderNote] = useState('');
  const [addingItemForVendor, setAddingItemForVendor] = useState<Vendor | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: ''
  });

  const [newItemFormData, setNewItemFormData] = useState({
    name: '',
    category: 'Cleaning Supplies' as MaterialCategory,
    unit: 'Pieces',
    currentStock: 0,
    minStock: 5,
    unitPrice: 0
  });
  useEffect(() => {
    const qV = query(collection(db, 'vendors'));
    const unsubV = onSnapshot(qV, (snapshot) => {
      const vendorData: Vendor[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor));
      setVendors(vendorData.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const qM = query(collection(db, 'materials'));
    const unsubM = onSnapshot(qM, (snapshot) => {
      const materialData: Material[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
      setMaterials(materialData);
    });

    return () => {
      unsubV();
      unsubM();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingVendor) {
        await updateDoc(doc(db, 'vendors', editingVendor.id), {
          ...formData,
        });
      } else {
        await addDoc(collection(db, 'vendors'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
      }
      setShowAddForm(false);
      setEditingVendor(null);
      setFormData({ name: '', contactPerson: '', phone: '', email: '', address: '' });
    } catch (error) {
      console.error("Error saving vendor:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      contactPerson: vendor.contactPerson || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      address: vendor.address || ''
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'vendors', id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting vendor:", error);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorForOrder || orderItems.length === 0) return;
    setIsSubmitting(true);

    try {
      const purchaseItems: PurchaseItem[] = orderItems.map(item => {
        const mat = materials.find(m => m.id === item.materialId);
        return {
          materialId: item.materialId,
          materialName: mat?.name || 'Unknown',
          quantity: item.quantity,
          unitPrice: mat?.unitPrice || 0
        };
      });

      const totalAmount = purchaseItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

      await addDoc(collection(db, 'purchases'), {
        vendorId: selectedVendorForOrder.id,
        vendorName: selectedVendorForOrder.name,
        items: purchaseItems,
        totalAmount,
        status: 'pending',
        timestamp: new Date().toISOString(),
        note: orderNote
      });

      setSelectedVendorForOrder(null);
      setOrderItems([]);
      setOrderNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'purchases');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addOrderItem = (materialId: string) => {
    setOrderItems(prev => {
      const existing = prev.find(item => item.materialId === materialId);
      if (existing) {
        return prev.map(item => item.materialId === materialId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { materialId, quantity: 1 }];
    });
  };

  const updateOrderQuantity = (materialId: string, quantity: number) => {
    if (quantity <= 0) {
      setOrderItems(prev => prev.filter(item => item.materialId !== materialId));
      return;
    }
    setOrderItems(prev => prev.map(item => item.materialId === materialId ? { ...item, quantity } : item));
  };

  const toggleMaterialVendor = async (material: Material, vendor: Vendor) => {
    try {
      const isAssigned = material.vendorId === vendor.id;
      await updateDoc(doc(db, 'materials', material.id), {
        vendorId: isAssigned ? null : vendor.id,
        vendorName: isAssigned ? null : vendor.name
      });
    } catch (error) {
      console.error("Error toggling material vendor:", error);
    }
  };

  const handleAddNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingItemForVendor) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'materials'), {
        ...newItemFormData,
        vendorId: addingItemForVendor.id,
        vendorName: addingItemForVendor.name,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.uid,
        createdByName: currentUser?.displayName || 'Unknown'
      });
      setAddingItemForVendor(null);
      setNewItemFormData({
        name: '',
        category: 'Cleaning Supplies',
        unit: 'Pieces',
        currentStock: 0,
        minStock: 5,
        unitPrice: 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'materials');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.contactPerson?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
          <input
            type="text"
            placeholder="Search vendors..."
            className="w-full pl-14 pr-6 py-4 bg-white border border-gray-100 rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => {
            setEditingVendor(null);
            setFormData({ name: '', contactPerson: '', phone: '', email: '', address: '' });
            setShowAddForm(true);
          }}
          className="flex items-center justify-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Add Vendor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredVendors.map((vendor) => (
            <motion.div
              layout
              key={vendor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 relative group"
            >
              <div className="absolute top-6 right-6 flex gap-2">
                <button
                  onClick={() => handleEdit(vendor)}
                  className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                  title="Edit Vendor"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                
                {deleteConfirm === vendor.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(vendor.id)}
                      className="px-3 py-2 bg-red-600 text-white text-[10px] font-black rounded-xl uppercase hover:bg-red-700 shadow-lg shadow-red-200 transition-all active:scale-95"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="p-2 bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(vendor.id)}
                    className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                    title="Delete Vendor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center text-white">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 leading-none uppercase tracking-tight">{vendor.name}</h3>
                  <p className="text-[10px] font-black text-gray-400 mt-2 uppercase tracking-widest leading-none">Authorized Supplier</p>
                  <div className="mt-1 flex items-center gap-1">
                    <Package className="w-3 h-3 text-blue-500" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                      {materials.filter(m => m.vendorId === vendor.id || m.vendorName === vendor.name).length} Items
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {vendor.contactPerson && (
                  <div className="flex items-center gap-3 text-sm font-bold text-gray-600">
                    <User className="w-4 h-4 text-blue-500" />
                    {vendor.contactPerson}
                  </div>
                )}
                {vendor.phone && (
                  <div className="flex items-center gap-3 text-sm font-bold text-gray-600">
                    <Phone className="w-4 h-4 text-blue-500" />
                    {vendor.phone}
                  </div>
                )}
                {vendor.email && (
                  <div className="flex items-center gap-3 text-sm font-bold text-gray-600">
                    <Mail className="w-4 h-4 text-blue-500" />
                    {vendor.email}
                  </div>
                )}
                {vendor.address && (
                  <div className="flex items-start gap-3 text-sm font-bold text-gray-600">
                    <MapPin className="w-4 h-4 text-blue-500 mt-0.5" />
                    <span className="leading-tight">{vendor.address}</span>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-gray-50 flex gap-3">
                <button
                  onClick={() => {
                    setSelectedVendorForOrder(vendor);
                    setOrderItems([]);
                    setOrderNote('');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 text-blue-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-blue-100 transition-all active:scale-95 group/btn"
                >
                  <ShoppingCart className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                  Order
                </button>
                <button
                  onClick={() => {
                    setManagingCatalogVendor(vendor);
                    setCatalogSearchQuery('');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-50 text-gray-600 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-100 transition-all active:scale-95 group/btn"
                >
                  <ListChecks className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                  Manage Items
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredVendors.length === 0 && (
        <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-gray-200">
          <p className="text-gray-400 font-bold uppercase tracking-widest">No vendors found</p>
        </div>
      )}

      {/* Add/Edit Form Modal */}
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
              className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] relative border border-gray-100"
            >
              <button 
                onClick={() => setShowAddForm(false)}
                className="absolute right-8 top-8 p-3 hover:bg-gray-100 rounded-2xl text-gray-400 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-8">
                <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight leading-none">
                  {editingVendor ? 'Edit Vendor' : 'New Vendor'}
                </h3>
                <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Register a new supplier</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Vendor Name</label>
                  <input
                    required
                    type="text"
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                    placeholder="e.g., Global Supplies"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Contact Person</label>
                  <input
                    type="text"
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                    placeholder="e.g., John Smith"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Phone</label>
                    <input
                      type="tel"
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                      placeholder="Phone number"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Email</label>
                    <input
                      type="email"
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                      placeholder="Email address"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Address</label>
                  <textarea
                    rows={2}
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner resize-none"
                    placeholder="Physical address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>

                <div className="pt-4">
                  <button
                    disabled={isSubmitting}
                    type="submit"
                    className="w-full py-5 bg-gray-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
                    {isSubmitting ? 'Saving...' : 'Save Vendor'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manage Catalog Modal */}
      <AnimatePresence>
        {managingCatalogVendor && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setManagingCatalogVendor(null)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ y: 40, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] relative border border-gray-100 overflow-y-auto max-h-[90vh]"
            >
              <button 
                onClick={() => setManagingCatalogVendor(null)}
                className="absolute right-8 top-8 p-3 hover:bg-gray-100 rounded-2xl text-gray-400 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <ListChecks className="w-6 h-6 text-blue-600" />
                  <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight leading-none">
                    Manage Items
                  </h3>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Assigning materials to <span className="text-blue-600">{managingCatalogVendor.name}</span>
                  </p>
                  <button
                    onClick={() => setAddingItemForVendor(managingCatalogVendor)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-200"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Item
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search all materials..."
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border-none rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                    value={catalogSearchQuery}
                    onChange={(e) => setCatalogSearchQuery(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar pb-4">
                  {materials
                    .filter(m => m.name.toLowerCase().includes(catalogSearchQuery.toLowerCase()))
                    .map(m => {
                      const isAssigned = m.vendorId === managingCatalogVendor.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleMaterialVendor(m, managingCatalogVendor)}
                          className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left group ${
                            isAssigned 
                              ? 'bg-blue-50 border-blue-200' 
                              : 'bg-white border-gray-100 hover:border-blue-100 hover:bg-blue-50/30'
                          }`}
                        >
                          <div>
                            <p className={`text-sm font-black ${isAssigned ? 'text-blue-900' : 'text-gray-900'}`}>{m.name}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              {isAssigned ? 'Assigned' : m.vendorName ? `Assigned to ${m.vendorName}` : 'Unassigned'}
                            </p>
                          </div>
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                            isAssigned ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-300 group-hover:bg-blue-100 group-hover:text-blue-400'
                          }`}>
                            {isAssigned ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Materials Modal */}
      <AnimatePresence>
        {selectedVendorForOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVendorForOrder(null)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ y: 40, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-2xl w-full shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] relative border border-gray-100 overflow-y-auto max-h-[90vh]"
            >
              <button 
                onClick={() => setSelectedVendorForOrder(null)}
                className="absolute right-8 top-8 p-3 hover:bg-gray-100 rounded-2xl text-gray-400 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <ShoppingCart className="w-6 h-6 text-blue-600" />
                  <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight leading-none">
                    Create Order
                  </h3>
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Ordering from <span className="text-blue-600">{selectedVendorForOrder.name}</span>
                </p>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Available Materials</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {materials.filter(m => m.vendorId === selectedVendorForOrder.id || m.vendorName === selectedVendorForOrder.name).length === 0 ? (
                      <p className="col-span-2 text-center py-8 text-gray-400 text-xs font-bold uppercase tracking-widest border border-dashed border-gray-200 rounded-2xl">
                        No materials assigned to this vendor
                      </p>
                    ) : (
                      materials
                        .filter(m => m.vendorId === selectedVendorForOrder.id || m.vendorName === selectedVendorForOrder.name)
                        .map(m => (
                          <button
                            key={m.id}
                            onClick={() => addOrderItem(m.id)}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left group"
                          >
                            <div>
                              <p className="text-sm font-black text-gray-900 group-hover:text-blue-700">{m.name}</p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">₹{m.unitPrice} / {m.unit}</p>
                            </div>
                            <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                          </button>
                        ))
                    )}
                  </div>
                </div>

                {orderItems.length > 0 && (
                  <div className="space-y-4">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Order Items</label>
                    <div className="space-y-3">
                      {orderItems.map(item => {
                        const mat = materials.find(m => m.id === item.materialId);
                        return (
                          <div key={item.materialId} className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                            <div className="flex-1">
                              <p className="text-sm font-black text-gray-900">{mat?.name}</p>
                              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">₹{mat?.unitPrice} x {item.quantity}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => updateOrderQuantity(item.materialId, item.quantity - 1)}
                                className="p-2 bg-white text-gray-400 hover:text-red-500 rounded-xl shadow-sm transition-all"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center font-black text-gray-900">{item.quantity}</span>
                              <button
                                onClick={() => updateOrderQuantity(item.materialId, item.quantity + 1)}
                                className="p-2 bg-white text-gray-400 hover:text-blue-500 rounded-xl shadow-sm transition-all"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-end items-center gap-4 px-8 py-6 bg-gray-900 rounded-[2rem] text-white">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Estimated Total</p>
                      <p className="text-3xl font-black tracking-tighter">
                        ₹{orderItems.reduce((sum, item) => {
                          const mat = materials.find(m => m.id === item.materialId);
                          return sum + (item.quantity * (mat?.unitPrice || 0));
                        }, 0).toLocaleString()}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Order Notes</label>
                      <textarea
                        rows={2}
                        className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner resize-none"
                        placeholder="Any specific instructions..."
                        value={orderNote}
                        onChange={(e) => setOrderNote(e.target.value)}
                      />
                    </div>

                    <div className="pt-4">
                      <button
                        disabled={isSubmitting}
                        onClick={handleCreateOrder}
                        className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                      >
                        <Save className="w-5 h-5" />
                        {isSubmitting ? 'Creating Order...' : 'Submit Purchase Order'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add New Item for Vendor Modal */}
      <AnimatePresence>
        {addingItemForVendor && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAddingItemForVendor(null)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ y: 40, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] relative border border-gray-100"
            >
              <button 
                onClick={() => setAddingItemForVendor(null)}
                className="absolute right-8 top-8 p-3 hover:bg-gray-100 rounded-2xl text-gray-400 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-5 h-5 text-blue-600" />
                  <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight leading-none">
                    New Item
                  </h3>
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Adding to <span className="text-blue-600">{addingItemForVendor.name}</span>
                </p>
              </div>

              <form onSubmit={handleAddNewItem} className="space-y-5">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Item Name</label>
                  <input
                    required
                    type="text"
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                    placeholder="e.g., Detergent Powder"
                    value={newItemFormData.name}
                    onChange={(e) => setNewItemFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Category</label>
                    <select
                      required
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-inner appearance-none"
                      value={newItemFormData.category}
                      onChange={(e) => setNewItemFormData(prev => ({ ...prev, category: e.target.value as MaterialCategory }))}
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
                      placeholder="e.g., Kg"
                      value={newItemFormData.unit}
                      onChange={(e) => setNewItemFormData(prev => ({ ...prev, unit: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Initial Qty</label>
                    <input
                      required
                      type="number"
                      min="0"
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                      value={newItemFormData.currentStock}
                      onChange={(e) => setNewItemFormData(prev => ({ ...prev, currentStock: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Price (₹)</label>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
                      value={newItemFormData.unitPrice}
                      onChange={(e) => setNewItemFormData(prev => ({ ...prev, unitPrice: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    disabled={isSubmitting}
                    type="submit"
                    className="w-full py-5 bg-gray-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
                    {isSubmitting ? 'Saving...' : 'Add Item'}
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
