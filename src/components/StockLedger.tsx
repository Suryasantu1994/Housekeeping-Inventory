import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { Material, Transaction } from '../types';
import { Search, Filter, ArrowUpRight, ArrowDownRight, Package, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { motion } from 'motion/react';

export default function StockLedger() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const qMaterials = query(collection(db, 'materials'));
    const unsubscribeMaterials = onSnapshot(qMaterials, (snapshot) => {
      const data: Material[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Material);
      });
      setMaterials(data.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const qTransactions = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
    const unsubscribeTransactions = onSnapshot(qTransactions, (snapshot) => {
      const data: Transaction[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(data);
    });

    return () => {
      unsubscribeMaterials();
      unsubscribeTransactions();
    };
  }, []);

  const getLedgerData = () => {
    if (selectedMaterial === 'all') {
      return transactions.filter(t => 
        t.materialName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.note?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // For a specific material, we calculate running balance
    const materialTransactions = transactions
      .filter(t => t.materialId === selectedMaterial)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let runningBalance = 0;
    const ledgerWithBalance = materialTransactions.map(t => {
      if (t.type === 'in') {
        runningBalance += t.quantity;
      } else {
        runningBalance -= t.quantity;
      }
      return { ...t, balance: runningBalance };
    });

    return ledgerWithBalance.reverse(); // Show newest first
  };

  const ledgerEntries = getLedgerData();

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/3 space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Select Material</label>
          <select
            className="w-full px-6 py-4 bg-white border border-gray-100 rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-sm appearance-none"
            value={selectedMaterial}
            onChange={(e) => setSelectedMaterial(e.target.value)}
          >
            <option value="all">All Materials</option>
            {materials.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Search Entries</label>
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by note or material..."
              className="w-full pl-14 pr-6 py-4 bg-white border border-gray-100 rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date & Time</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Material</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Qty</th>
                {selectedMaterial !== 'all' && (
                  <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Balance</th>
                )}
                <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Reference / Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ledgerEntries.map((entry: any) => (
                <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-900">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className="text-sm font-bold text-gray-900">{entry.materialName || 'Unknown Material'}</span>
                  </td>
                  <td className="px-8 py-6">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      entry.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {entry.type === 'in' ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                      Stock {entry.type}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`text-sm font-black ${entry.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.type === 'in' ? '+' : '-'}{entry.quantity}
                    </span>
                  </td>
                  {selectedMaterial !== 'all' && (
                    <td className="px-8 py-6 text-center">
                      <span className="text-sm font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                        {entry.balance}
                      </span>
                    </td>
                  )}
                  <td className="px-8 py-6">
                    <p className="text-sm font-medium text-gray-500 max-w-xs">{entry.note || '-'}</p>
                    {entry.building && (
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                        Building: {entry.building}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ledgerEntries.length === 0 && (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 font-bold uppercase tracking-widest">No transactions recorded</p>
          </div>
        )}
      </div>
    </div>
  );
}
