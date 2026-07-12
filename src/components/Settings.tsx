import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Building } from '../types';
import { Building2, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { motion } from 'motion/react';

export default function Settings() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [newBuilding, setNewBuilding] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = 'buildings';
    const q = query(collection(db, path), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBuildings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Building)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return () => unsubscribe();
  }, []);

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

  if (loading) return <div className="p-8 text-center text-gray-500">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">SETTINGS</h2>
        <p className="text-sm text-gray-500 font-medium">Configure application preferences and data</p>
      </div>

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
    </div>
  );
}
