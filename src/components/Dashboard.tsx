import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Material, StockAlert, Transaction, Building, MaterialCategory } from '../types';
import { Package, AlertTriangle, ArrowUpRight, ArrowDownRight, ClipboardList, Wallet, Receipt, Building2, PieChart, TrendingUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState<string>('');

  useEffect(() => {
    const materialsPath = 'materials';
    const transactionsPath = 'transactions';
    const buildingsPath = 'buildings';
    const materialsQuery = query(collection(db, materialsPath), orderBy('name', 'asc'));
    const transactionsQuery = query(collection(db, transactionsPath), orderBy('timestamp', 'desc'));
    const buildingsQuery = query(collection(db, buildingsPath), orderBy('name', 'asc'));

    let materialsUnsubscribed = false;
    let transactionsUnsubscribed = false;
    let buildingsUnsubscribed = false;

    const unsubMaterials = onSnapshot(materialsQuery, (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material)));
      materialsUnsubscribed = true;
      if (materialsUnsubscribed && transactionsUnsubscribed && buildingsUnsubscribed) {
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, materialsPath);
      setLoading(false);
    });

    const unsubTransactions = onSnapshot(transactionsQuery, (snapshot) => {
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
      transactionsUnsubscribed = true;
      if (materialsUnsubscribed && transactionsUnsubscribed && buildingsUnsubscribed) {
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, transactionsPath);
      setLoading(false);
    });

    const unsubBuildings = onSnapshot(buildingsQuery, (snapshot) => {
      setBuildings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Building)));
      buildingsUnsubscribed = true;
      if (materialsUnsubscribed && transactionsUnsubscribed && buildingsUnsubscribed) {
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, buildingsPath);
      setLoading(false);
    });

    return () => {
      unsubMaterials();
      unsubTransactions();
      unsubBuildings();
    };
  }, []);

  const alerts: StockAlert[] = materials
    .filter(m => {
      const current = Number(m.currentStock) || 0;
      const min = Number(m.minStock) || 0;
      return min > 0 && current <= min;
    })
    .map(m => {
      const current = Number(m.currentStock) || 0;
      const min = Number(m.minStock) || 0;
      return {
        materialId: m.id,
        name: m.name,
        currentStock: current,
        minStock: min,
        severity: current <= min * 0.2 ? 'critical' : 'low'
      };
    });

  const totalItems = materials.length;
  const lowStockCount = alerts.length;
  const criticalStockCount = alerts.filter(a => a.severity === 'critical').length;

  const totalStockValue = materials.reduce((acc, m) => acc + ((Number(m.currentStock) || 0) * (Number(m.unitPrice) || 0)), 0);
  
  const dateFilteredTransactions = transactions.filter(t => {
    if (!filterDate) return true;
    const tDate = new Date(t.timestamp).toISOString().split('T')[0];
    return tDate === filterDate;
  });

  const totalIssuedValue = transactions
    .filter(t => t.type === 'out')
    .reduce((acc, t) => {
      const material = materials.find(m => m.id === t.materialId);
      const unitPrice = Number(t.unitPrice) || Number(material?.unitPrice) || 0;
      return acc + ((Number(t.quantity) || 0) * unitPrice);
    }, 0);

  const [showIndentModal, setShowIndentModal] = useState(false);
  const totalStockIndent = totalStockValue + totalIssuedValue;

  const categoryBreakdown = materials.reduce((acc, m) => {
    const category = m.category || 'Other';
    if (!acc[category]) acc[category] = { stockValue: 0, issuedValue: 0 };
    acc[category].stockValue += (Number(m.currentStock) || 0) * (Number(m.unitPrice) || 0);
    return acc;
  }, {} as Record<string, { stockValue: number; issuedValue: number }>);

  transactions
    .filter(t => t.type === 'out')
    .forEach(t => {
      const material = materials.find(m => m.id === t.materialId);
      const category = material?.category || 'Other';
      if (!categoryBreakdown[category]) {
        categoryBreakdown[category] = { stockValue: 0, issuedValue: 0 };
      }
      categoryBreakdown[category].issuedValue += (Number(t.quantity) || 0) * (Number(material?.unitPrice) || 0);
    });

  const consumptionTrends = dateFilteredTransactions
    .filter(t => t.type === 'out')
    .reduce((acc: any[], t) => {
      const date = new Date(t.timestamp);
      const month = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();
      const key = `${month} ${year}`;
      
      const existing = acc.find(item => item.name === key);
      const material = materials.find(m => m.id === t.materialId);
      const unitPrice = Number(t.unitPrice) || Number(material?.unitPrice) || 0;
      const value = (Number(t.quantity) || 0) * unitPrice;
      
      if (existing) {
        existing.value += value;
      } else {
        acc.push({ name: key, value, rawDate: date });
      }
      return acc;
    }, [])
    .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())
    .slice(-6); // Last 6 months

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading metrics...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase leading-none">Dashboard</h2>
          <p className="text-sm text-gray-500 font-bold mt-2 flex items-center gap-2 opacity-60">
            <TrendingUp className="w-4 h-4" />
            Inventory insights & performance
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md p-2 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50 self-start ring-1 ring-black/5">
          <div className="flex items-center gap-3 px-4 py-1">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter by Date</span>
            <input
              type="date"
              className="bg-transparent border-none text-sm font-black text-gray-900 focus:ring-0 outline-none p-0 cursor-pointer"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
              title="Clear Filter"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ y: -5, scale: 1.02 }}
          className="bg-white p-7 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 ring-1 ring-black/5 transition-all"
        >
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-[1.5rem] w-fit shadow-inner">
              <Package className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Materials</p>
              <h3 className="text-3xl font-black text-gray-900 tracking-tighter">{totalItems}</h3>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          whileHover={{ y: -5, scale: 1.02 }}
          className="bg-white p-7 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 ring-1 ring-black/5 transition-all"
        >
          <div className="flex flex-col gap-4">
            <div className={`p-4 rounded-[1.5rem] w-fit shadow-inner ${lowStockCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Low Stock Items</p>
              <h3 className={`text-3xl font-black tracking-tighter ${lowStockCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{lowStockCount}</h3>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          whileHover={{ y: -5, scale: 1.02 }}
          className="bg-white p-7 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 ring-1 ring-black/5 transition-all"
        >
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-[1.5rem] w-fit shadow-inner">
              <Wallet className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Stock Value</p>
              <h3 className="text-3xl font-black text-gray-900 tracking-tighter">₹{totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          whileHover={{ y: -5, scale: 1.02 }}
          className="bg-white p-7 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 ring-1 ring-black/5 transition-all"
        >
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-purple-50 text-purple-600 rounded-[1.5rem] w-fit shadow-inner">
              <Receipt className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Issued Value</p>
              <h3 className="text-3xl font-black text-gray-900 tracking-tighter">₹{totalIssuedValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          whileHover={{ y: -5, scale: 1.02 }}
          onClick={() => setShowIndentModal(true)}
          className="bg-gray-900 p-7 rounded-[2rem] shadow-2xl shadow-gray-900/20 cursor-pointer hover:bg-gray-800 transition-all group overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform duration-500">
            <PieChart className="w-24 h-24 text-white" />
          </div>
          <div className="flex flex-col gap-4 relative z-10">
            <div className="p-4 bg-white/10 text-white rounded-[1.5rem] w-fit backdrop-blur-md">
              <PieChart className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-black text-white/50 uppercase tracking-widest mb-1">Stock Indent</p>
              <h3 className="text-3xl font-black text-white tracking-tighter">₹{totalStockIndent.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showIndentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIndentModal(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative bg-white w-full max-w-2xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] overflow-hidden"
            >
              <div className="p-10 border-b border-gray-100 flex items-center justify-between bg-gray-900 text-white">
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tight leading-none">Stock Indent</h2>
                  <p className="text-gray-400 text-[10px] font-black mt-2 tracking-widest uppercase">Inventory Valuation Breakdown</p>
                </div>
                <button 
                  onClick={() => setShowIndentModal(false)}
                  className="p-3 hover:bg-white/10 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-10 max-h-[50vh] overflow-y-auto space-y-6">
                {(Object.entries(categoryBreakdown) as [string, { stockValue: number; issuedValue: number }][])
                  .sort((a, b) => (b[1].stockValue + b[1].issuedValue) - (a[1].stockValue + a[1].issuedValue))
                  .map(([category, values]) => {
                    const total = values.stockValue + values.issuedValue;
                    return (
                      <div key={category} className="group p-6 bg-gray-50 rounded-[2rem] flex items-center justify-between hover:bg-blue-50 transition-all duration-300">
                        <div className="flex flex-col gap-2">
                          <h4 className="text-lg font-black text-gray-900 tracking-tight">{category}</h4>
                          <div className="flex gap-4">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Stock: ₹{values.stockValue.toLocaleString()}</span>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Issued: ₹{values.issuedValue.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-black text-gray-900 tracking-tighter">₹{total.toLocaleString()}</div>
                          <div className="w-32 h-2 bg-gray-200 rounded-full mt-3 overflow-hidden shadow-inner">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(total / totalStockIndent) * 100}%` }}
                              transition={{ duration: 1.5, ease: "circOut" }}
                              className="h-full bg-blue-600 rounded-full"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="p-10 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Total Valuation</span>
                <span className="text-4xl font-black text-gray-900 tracking-tighter">₹{totalStockIndent.toLocaleString()}</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 ring-1 ring-black/5"
          >
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase leading-none">Consumption Trends</h3>
                <p className="text-xs font-bold text-gray-400 mt-2 uppercase tracking-widest">Daily item issuance volume</p>
              </div>
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl shadow-inner">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
            
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={consumptionTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(value) => `₹${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      borderRadius: '16px', 
                      border: '1px solid #f1f5f9',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                      fontWeight: '700'
                    }}
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Consumption']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#2563eb" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorValue)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase leading-none">Building Analysis</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {buildings.map((building) => {
                const buildingTransactions = dateFilteredTransactions.filter(t => t.building?.trim() === building.name.trim() && t.type === 'out');
                
                const buildingTotalValue = buildingTransactions.reduce((acc, t) => {
                  const material = materials.find(m => m.id === t.materialId);
                  const unitPrice = Number(t.unitPrice) || Number(material?.unitPrice) || 0;
                  return acc + ((Number(t.quantity) || 0) * unitPrice);
                }, 0);

                const categoryConsumption: Record<string, number> = {};
                buildingTransactions.forEach(t => {
                  const material = materials.find(m => m.id === t.materialId);
                  const category = material?.category || 'Other';
                  const unitPrice = Number(t.unitPrice) || Number(material?.unitPrice) || 0;
                  const value = (Number(t.quantity) || 0) * unitPrice;
                  categoryConsumption[category] = (categoryConsumption[category] || 0) + value;
                });

                return (
                  <motion.div
                    key={building.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -5 }}
                    className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 ring-1 ring-black/5 transition-all"
                  >
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h4 className="text-lg font-black text-gray-900 leading-tight uppercase tracking-tight">{building.name}</h4>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-2">Total Consumption</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-blue-600 tracking-tighter">₹{buildingTotalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      </div>
                    </div>

                    <div className="space-y-5">
                      {Object.entries(categoryConsumption)
                        .sort((a, b) => b[1] - a[1])
                        .map(([category, value]) => {
                          const percentage = buildingTotalValue > 0 ? (value / buildingTotalValue) * 100 : 0;
                          return (
                            <div key={category} className="space-y-2">
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                <span className="text-gray-400">{category}</span>
                                <span className="text-gray-900">{percentage.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-gray-50 h-2 rounded-full overflow-hidden shadow-inner">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  transition={{ duration: 1, ease: "circOut" }}
                                  className="bg-blue-600 h-full rounded-full"
                                />
                              </div>
                              <p className="text-[10px] text-right text-gray-500 font-bold tracking-tight">₹{value.toLocaleString()}</p>
                            </div>
                          );
                        })}
                      {Object.keys(categoryConsumption).length === 0 && (
                        <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">No Activity</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {alerts.length > 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/40 ring-1 ring-black/5 overflow-hidden"
              >
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                  <h4 className="font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Stock Alerts
                  </h4>
                </div>
                <div className="divide-y divide-gray-100">
                  {alerts.map((alert) => (
                    <div key={alert.materialId} className="p-6 flex items-center justify-between group hover:bg-amber-50 transition-colors">
                      <div>
                        <p className="font-bold text-gray-900 tracking-tight">{alert.name}</p>
                        <p className="text-xs text-gray-500 font-medium mt-1">
                          Current Stock: <span className={alert.severity === 'critical' ? 'text-red-600 font-black' : 'text-amber-600 font-black'}>
                            {alert.currentStock}
                          </span> / Min: {alert.minStock}
                        </p>
                      </div>
                      <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        alert.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {alert.severity}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="bg-white p-16 rounded-[2.5rem] border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
                <div className="p-5 bg-green-50 text-green-500 rounded-[2rem] mb-6 shadow-inner">
                  <Package className="w-10 h-10" />
                </div>
                <p className="font-black uppercase tracking-widest text-xs">All stock levels are healthy</p>
              </div>
            )}
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/40 ring-1 ring-black/5 h-fit sticky top-6"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-gray-100 text-gray-400 rounded-2xl">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h4 className="font-black text-gray-900 uppercase tracking-tight">Inventory Status</h4>
          </div>
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-gray-400">Critical Items</span>
                <span className={`px-2 py-0.5 rounded-lg ${criticalStockCount > 0 ? 'bg-red-100 text-red-600' : 'text-gray-900'}`}>{criticalStockCount}</span>
              </div>
              <div className="w-full bg-gray-50 h-3 rounded-full overflow-hidden shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${totalItems ? (criticalStockCount / totalItems) * 100 : 0}%` }}
                  transition={{ duration: 1, ease: "circOut" }}
                  className="bg-red-500 h-full rounded-full" 
                />
              </div>
            </div>
            
            <div className="pt-6 border-t border-gray-100 space-y-3">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                <span className="text-gray-400">Low Stock Items</span>
                <span className="text-amber-600">{lowStockCount}</span>
              </div>
              <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${totalItems ? (lowStockCount / totalItems) * 100 : 0}%` }}
                  transition={{ duration: 1, ease: "circOut", delay: 0.2 }}
                  className="bg-amber-500 h-full rounded-full" 
                />
              </div>
            </div>

            <div className="pt-8 mt-4">
              <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Healthy</span>
                </div>
                <p className="text-xs text-blue-800 font-bold leading-relaxed">
                  Your current inventory is well-balanced with {totalItems - lowStockCount} healthy stock levels.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
