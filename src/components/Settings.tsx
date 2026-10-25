import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Building, UserProfile } from '../types';
import { Building2, Plus, Trash2, Edit2, Check, X, Users, Shield, User as UserIcon, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { profile: currentProfile } = useAuth();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [newBuilding, setNewBuilding] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserProfile | null>(null);

  useEffect(() => {
    const path = 'buildings';
    const q = query(collection(db, path), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBuildings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Building)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentProfile?.role !== 'admin') {
      setLoading(false);
      return;
    }

    const path = 'userProfiles';
    const unsubscribe = onSnapshot(collection(db, path), (snapshot) => {
      setUserProfiles(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentProfile]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBuilding.trim()) return;
    try {
      await addDoc(collection(db, 'buildings'), { name: newBuilding.trim() });
      setNewBuilding('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'buildings');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editValue.trim()) return;
    try {
      await updateDoc(doc(db, 'buildings', id), { name: editValue.trim() });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `buildings/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this building?')) {
      try {
        await deleteDoc(doc(db, 'buildings', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `buildings/${id}`);
      }
    }
  };

  const toggleUserBuilding = async (userId: string, buildingName: string) => {
    const user = userProfiles.find(u => u.uid === userId);
    if (!user) return;

    const assigned = user.assignedBuildings || [];
    const isAssigned = assigned.includes(buildingName);
    
    const newAssigned = isAssigned 
      ? assigned.filter(b => b !== buildingName)
      : [...assigned, buildingName];

    try {
      await updateDoc(doc(db, 'userProfiles', userId), {
        assignedBuildings: newAssigned
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `userProfiles/${userId}`);
    }
  };

  const toggleUserRole = async (userId: string) => {
    const user = userProfiles.find(u => u.uid === userId);
    if (!user) return;

    const newRole = user.role === 'admin' ? 'staff' : 'admin';
    
    try {
      await updateDoc(doc(db, 'userProfiles', userId), {
        role: newRole
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `userProfiles/${userId}`);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">SETTINGS</h2>
        <p className="text-sm text-gray-500 font-medium">Configure application preferences and data</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Manage Buildings */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center gap-3">
            <div className="p-2 bg-gray-900 rounded-lg">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-black text-gray-900">MANAGE BUILDINGS</h3>
          </div>

          <div className="p-6 space-y-6">
            <form onSubmit={handleAdd} className="flex gap-2">
              <input
                type="text"
                placeholder="Add new building name..."
                className="flex-1 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-gray-900 outline-none transition-all font-medium"
                value={newBuilding}
                onChange={(e) => setNewBuilding(e.target.value)}
              />
              <button
                type="submit"
                className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-800 transition-all"
              >
                <Plus className="w-5 h-5" />
                Add
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {buildings.map((building) => (
                <motion.div
                  key={building.id}
                  layout
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group"
                >
                  {editingId === building.id ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        autoFocus
                        className="flex-1 bg-white px-3 py-1 rounded-lg border-none focus:ring-2 focus:ring-gray-900 outline-none text-sm font-bold"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdate(building.id)}
                      />
                      <button onClick={() => handleUpdate(building.id)} className="text-green-600 hover:text-green-700">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-bold text-gray-700">{building.name}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingId(building.id);
                            setEditValue(building.name);
                          }}
                          className="p-2 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(building.id)}
                          className="p-2 hover:bg-red-100 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
              {buildings.length === 0 && (
                <p className="col-span-full py-8 text-center text-gray-400 italic text-sm">
                  No buildings added yet. Add your first building above.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* User Management (Admin Only) */}
        {currentProfile?.role === 'admin' && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-black text-gray-900">USER ACCESS MANAGEMENT</h3>
            </div>

            <div className="p-6">
              <div className="divide-y divide-gray-50">
                {userProfiles.map((user) => (
                  <div key={user.uid} className="py-6 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                          <UserIcon className="w-6 h-6 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-black text-gray-900 leading-none">{user.displayName}</p>
                          <p className="text-xs text-gray-500 font-medium mt-1">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleUserRole(user.uid)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {user.role}
                        </button>
                        <button
                          onClick={() => setSelectedUserForEdit(selectedUserForEdit?.uid === user.uid ? null : user)}
                          className="p-2 hover:bg-gray-100 rounded-xl transition-all"
                        >
                          <SettingsIcon className="w-5 h-5 text-gray-400" />
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {selectedUserForEdit?.uid === user.uid && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-6 p-6 bg-gray-50 rounded-2xl space-y-4">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assign Buildings</p>
                            <div className="flex flex-wrap gap-2">
                              {buildings.map(b => {
                                const isAssigned = user.assignedBuildings?.includes(b.name);
                                return (
                                  <button
                                    key={b.id}
                                    onClick={() => toggleUserBuilding(user.uid, b.name)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                                      isAssigned 
                                        ? 'bg-blue-600 border-blue-600 text-white' 
                                        : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                                    }`}
                                  >
                                    {b.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
