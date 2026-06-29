import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Transaction, Building } from '../types';
import { Clock, ArrowUpRight, ArrowDownRight, Trash2, Building2, ChevronRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    const tPath = 'transactions';
    const bPath = 'buildings';
    
    const qT = query(collection(db, tPath), orderBy('timestamp', 'desc'), limit(200));
    const unsubT = onSnapshot(qT, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          timestamp: data.timestamp && typeof data.timestamp.toDate === 'function' 
            ? data.timestamp.toDate().toISOString() 
            : (data.timestamp || new Date().toISOString())
        } as Transaction;
      });
      setTransactions(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, tPath);
    });

    const qB = query(collection(db, bPath), orderBy('name', 'asc'));
    const unsubB = onSnapshot(qB, (snapshot) => {
      setBuildings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Building)));
    });

    return () => {
      unsubT();
      unsubB();
    };
  }, []);

  const handleDelete = async (id: string) => {
    const path = `transactions/${id}`;
    try {
      await deleteDoc(doc(db, 'transactions', id));
      setDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const buildingGroups = buildings.map(b => ({
    name: b.name,
    count: transactions.filter(t => t.building === b.name).length
  }));

  const globalTransactionsCount = transactions.filter(t => !t.building).length;

  const filteredTransactions = selectedBuilding === 'General Inventory' 
    ? transactions.filter(t => !t.building)
    : selectedBuilding 
      ? transactions.filter(t => t.building === selectedBuilding)
      : [];

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading activity logs...</div>;
  }

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {!selectedBuilding ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">ACTIVITY HISTORY</h2>
              <p className="text-sm text-gray-500 font-medium">View transaction logs by building</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={() => setSelectedBuilding('General Inventory')}
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all text-left group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-blue-50 rounded-2xl group-hover:bg-blue-600 transition-colors">
                    <Clock className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-900 transition-colors" />
                </div>
                <h3 className="text-lg font-black text-gray-900 mb-1">General Inventory</h3>
                <p className="text-sm text-gray-500 font-medium">{globalTransactionsCount} logs</p>
              </button>

              {buildingGroups.map((group) => (
                <button
                  key={group.name}
                  onClick={() => setSelectedBuilding(group.name)}
                  className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all text-left group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-gray-900 rounded-2xl group-hover:bg-blue-600 transition-colors">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-900 transition-colors" />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 mb-1">{group.name}</h3>
                  <p className="text-sm text-gray-500 font-medium">{group.count} logs</p>
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedBuilding(null)}
                className="p-3 bg-white rounded-2xl border border-gray-100 text-gray-400 hover:text-gray-900 transition-colors shadow-sm"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">{selectedBuilding}</h2>
                <p className="text-sm text-gray-500 font-medium">Detailed activity logs</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-50">
                {filteredTransactions.length === 0 ? (
                  <div className="p-20 text-center text-gray-400 italic">No logs found for this selection</div>
                ) : (
                  filteredTransactions.map((t) => (
                    <div key={t.id} className="p-6 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-6">
                        <div className={`p-4 rounded-2xl ${t.type === 'in' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                          {t.type === 'in' ? (
                            <ArrowUpRight className="w-6 h-6 text-emerald-600" />
                          ) : (
                            <ArrowDownRight className="w-6 h-6 text-rose-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-black text-gray-900 text-lg">{t.materialName}</h4>
                          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mt-1">
                            <Clock className="w-3 h-3" />
                            {new Date(t.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-6">
                          <div>
                            <p className={`text-xl font-black ${t.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {t.type === 'in' ? '+' : '-'}{t.quantity}
                            </p>
                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mt-1">
                              {t.type === 'in' ? 'Restocked' : 'Consumed'}
                            </p>
                          </div>
                          
                          {deleteConfirm === t.id ? (
                            <div className="flex items-center gap-1 bg-red-50 rounded-xl p-1">
                              <button
                                onClick={() => handleDelete(t.id)}
                                className="px-3 py-1.5 bg-red-600 text-white text-[10px] font-black rounded-lg uppercase hover:bg-red-700 transition-colors"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-3 py-1.5 text-gray-400 text-[10px] font-black rounded-lg uppercase hover:text-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setDeleteConfirm(t.id)}
                              className="p-3 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-xl transition-colors"
                              title="Delete Log"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {t.note && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-2xl text-sm text-gray-600 italic border-l-4 border-gray-200">
                          "{t.note}"
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
