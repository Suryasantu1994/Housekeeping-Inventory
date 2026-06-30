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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Dashboard Overview</h2>
          <p className="text-sm text-gray-500 font-medium italic">Key performance indicators & inventory insights</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm self-start">
          <div className="flex items-center gap-2 px-3">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter:</span>
            <input
              type="date"
              className="bg-transparent border-none text-sm font-bold focus:ring-0 outline-none p-0 cursor-pointer"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
          </div>
          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
              title="Clear Filter"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Materials</p>
              <h3 className="text-2xl font-bold text-gray-900">{totalItems}</h3>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${lowStockCount > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
              <AlertTriangle className={`w-6 h-6 ${lowStockCount > 0 ? 'text-amber-600' : 'text-green-600'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Low Stock Items</p>
              <h3 className="text-2xl font-bold text-gray-900">{lowStockCount}</h3>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <Wallet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Stock Value</p>
              <h3 className="text-2xl font-bold text-gray-900">₹{totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-xl">
              <Receipt className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Issued Value</p>
              <h3 className="text-2xl font-bold text-gray-900">₹{totalIssuedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onClick={() => setShowIndentModal(true)}
          className="bg-white p-6 rounded-2xl border border-gray-900 shadow-sm ring-1 ring-gray-900/5 cursor-pointer hover:bg-gray-50 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-900 rounded-xl group-hover:scale-110 transition-transform">
              <PieChart className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Stock Indent</p>
              <h3 className="text-2xl font-bold text-gray-900">₹{totalStockIndent.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showIndentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIndentModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-900 text-white">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Stock Indent Breakdown</h2>
                  <p className="text-gray-400 text-xs font-bold mt-1 tracking-widest uppercase">Current Stock + Issued Values</p>
                </div>
                <button 
                  onClick={() => setShowIndentModal(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 max-h-[60vh] overflow-y-auto">
                <div className="space-y-4">
                  {(Object.entries(categoryBreakdown) as [string, { stockValue: number; issuedValue: number }][])
                    .sort((a, b) => (b[1].stockValue + b[1].issuedValue) - (a[1].stockValue + a[1].issuedValue))
                    .map(([category, values]) => {
                      const total = values.stockValue + values.issuedValue;
                      return (
                        <div key={category} className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between group hover:bg-blue-50 transition-colors">
                          <div>
                            <h4 className="font-bold text-gray-900 tracking-tight">{category}</h4>
                            <div className="flex gap-4 mt-1">
                              <span className="text-[10px] font-bold text-gray-400 uppercase">Stock: ₹{values.stockValue.toLocaleString()}</span>
                              <span className="text-[10px] font-bold text-gray-400 uppercase">Issued: ₹{values.issuedValue.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-black text-gray-900">₹{total.toLocaleString()}</div>
                            <div className="w-32 h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                              <div 
                                className="h-full bg-blue-600 rounded-full transition-all duration-1000"
                                style={{ width: `${(total / totalStockIndent) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm font-black text-gray-500 uppercase tracking-widest">Total Valuation</span>
                <span className="text-3xl font-black text-gray-900 tracking-tighter">₹{totalStockIndent.toLocaleString()}</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                  CONSUMPTION TRENDS
                </h3>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Monthly Usage Value (Last 6 Months)</p>
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

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Building2 className="w-6 h-6 text-blue-600" />
                BUILDING ANALYSIS
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h4 className="font-black text-gray-900 leading-tight uppercase">{building.name}</h4>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Total Consumption</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-blue-600">₹{buildingTotalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {Object.entries(categoryConsumption)
                        .sort((a, b) => b[1] - a[1])
                        .map(([category, value]) => {
                          const percentage = buildingTotalValue > 0 ? (value / buildingTotalValue) * 100 : 0;
                          return (
                            <div key={category} className="space-y-1">
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                <span className="text-gray-500">{category}</span>
                                <span className="text-gray-900">{percentage.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-gray-50 h-1.5 rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  className="bg-blue-600 h-full rounded-full"
                                />
                              </div>
                              <p className="text-[10px] text-right text-gray-400 font-bold">₹{value.toLocaleString()}</p>
                            </div>
                          );
                        })}
                      {Object.keys(categoryConsumption).length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-4 italic">No consumption recorded</p>
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
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Stock Alerts
                  </h4>
                </div>
                <div className="divide-y divide-gray-100">
                  {alerts.map((alert) => (
                    <div key={alert.materialId} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{alert.name}</p>
                        <p className="text-sm text-gray-500">
                          Stock: <span className={alert.severity === 'critical' ? 'text-red-600 font-bold' : 'text-amber-600 font-medium'}>
                            {alert.currentStock}
                          </span> / Min: {alert.minStock}
                        </p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        alert.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {alert.severity}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
                <Package className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium">All stock levels are healthy</p>
              </div>
            )}
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
        >
          <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-gray-400" />
            Inventory Status
          </h4>
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500 font-medium">Critical Items</span>
              <span className={`font-bold ${criticalStockCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{criticalStockCount}</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-red-500 h-full transition-all duration-500" 
                style={{ width: `${totalItems ? (criticalStockCount / totalItems) * 100 : 0}%` }}
              />
            </div>
            
            <div className="pt-4 border-t border-gray-50 flex justify-between items-center text-sm">
              <span className="text-gray-500 font-medium">Low Stock Items</span>
              <span className="font-bold text-amber-600">{lowStockCount}</span>
            </div>
            <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-amber-500 h-full transition-all duration-500" 
                style={{ width: `${totalItems ? (lowStockCount / totalItems) * 100 : 0}%` }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
