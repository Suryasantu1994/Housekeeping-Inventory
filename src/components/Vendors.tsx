import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Vendor } from '../types';
import { Plus, Search, MoreVertical, Edit2, Trash2, X, Phone, Mail, MapPin, User, Save, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: ''
  });

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
    if (window.confirm('Are you sure you want to delete this vendor?')) {
      try {
        await deleteDoc(doc(db, 'vendors', id));
      } catch (error) {
        console.error("Error deleting vendor:", error);
      }
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
              <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(vendor)}
                  className="p-2 hover:bg-blue-50 text-blue-600 rounded-xl transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(vendor.id)}
                  className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center text-white">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 leading-none uppercase tracking-tight">{vendor.name}</h3>
                  <p className="text-[10px] font-black text-gray-400 mt-2 uppercase tracking-widest">Authorized Supplier</p>
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
    </div>
  );
}
