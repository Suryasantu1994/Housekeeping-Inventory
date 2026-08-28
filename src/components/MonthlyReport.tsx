import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Transaction, Building } from '../types';
import { Building2, Calendar, FileText, ChevronDown, Package, IndianRupee, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface BuildingSummary {
  buildingName: string;
  totalAmount: number;
  items: {
    materialName: string;
    totalQuantity: number;
    amount: number;
  }[];
}

export default function MonthlyReport() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);

  useEffect(() => {
    const transPath = 'transactions';
    const buildPath = 'buildings';

    // We fetch all 'out' transactions for the selected year and month
    // Note: Since Firestore doesn't have a direct "month" filter on ISO strings easily without ranges,
    // we'll fetch and filter client-side for simplicity, or use ranges if performance becomes an issue.
    const qTrans = query(
      collection(db, transPath),
      where('type', '==', 'out'),
      orderBy('timestamp', 'desc')
    );

    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, transPath);
    });

    const qBuild = query(collection(db, buildPath), orderBy('name', 'asc'));
    const unsubBuild = onSnapshot(qBuild, (snapshot) => {
      setBuildings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Building)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, buildPath);
    });

    return () => {
      unsubTrans();
      unsubBuild();
    };
  }, []);

  const filteredTransactions = transactions.filter(t => {
    const date = new Date(t.timestamp);
    return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
  });

  const buildingSummaries: BuildingSummary[] = buildings.map(building => {
    const buildingTrans = filteredTransactions.filter(t => t.building === building.name);
    
    const materialMap = new Map<string, { materialName: string, totalQuantity: number, amount: number }>();
    
    let totalAmount = 0;
    buildingTrans.forEach(t => {
      const materialName = t.materialName || 'Unknown Material';
      const existing = materialMap.get(materialName) || { materialName, totalQuantity: 0, amount: 0 };
      
      const itemAmount = t.quantity * t.unitPrice;
      existing.totalQuantity += t.quantity;
      existing.amount += itemAmount;
      totalAmount += itemAmount;
      
      materialMap.set(materialName, existing);
    });

    return {
      buildingName: building.name,
      totalAmount,
      items: Array.from(materialMap.values()).sort((a, b) => b.amount - a.amount)
    };
  }).filter(summary => summary.items.length > 0) // Only show buildings with activity
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 font-bold uppercase tracking-widest">Generating Report...</div>;
  }

  const exportToPDF = (summary: BuildingSummary) => {
    const doc = new jsPDF();
    const monthName = months[selectedMonth];
    
    // Header
    doc.setFontSize(22);
    doc.text('Monthly Consumption Report', 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Building: ${summary.buildingName}`, 14, 30);
    doc.text(`Period: ${monthName} ${selectedYear}`, 14, 37);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 44);
    
    // Table
    const tableData = summary.items.map(item => [
      item.materialName,
      item.totalQuantity.toLocaleString(),
      `Rs. ${item.amount.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Material Name', 'Total Quantity', 'Total Amount']],
      body: tableData,
      foot: [['Total Consumption Value', '', `Rs. ${summary.totalAmount.toLocaleString()}`]],
      theme: 'grid',
      headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { top: 55 }
    });

    doc.save(`${summary.buildingName}_${monthName}_${selectedYear}_Consumption_Report.pdf`);
  };

  const grandTotal = buildingSummaries.reduce((acc, curr) => acc + curr.totalAmount, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none uppercase">Monthly Consumption</h2>
          <p className="text-sm text-gray-500 font-medium mt-2">Building-wise materials issuance report</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              className="pl-11 pr-10 py-3 bg-gray-50 border-none rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {months.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </div>
          
          <div className="relative">
            <select
              className="px-6 py-3 bg-gray-50 border-none rounded-xl font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900 p-8 rounded-[2rem] text-white shadow-xl shadow-gray-200">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">Grand Total Issued</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tighter">₹{grandTotal.toLocaleString()}</span>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Active Buildings</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tighter text-gray-900">{buildingSummaries.length}</span>
            <span className="text-xs font-bold text-gray-400">Total</span>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Total Items Issued</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tighter text-gray-900">
              {filteredTransactions.reduce((acc, t) => acc + t.quantity, 0).toLocaleString()}
            </span>
            <span className="text-xs font-bold text-gray-400">Units</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-4">Building Wise Breakdown</h3>
        <AnimatePresence mode="popLayout">
          {buildingSummaries.length > 0 ? (
            buildingSummaries.map((summary) => (
              <motion.div
                key={summary.buildingName}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden"
              >
                <div
                  className="w-full p-6 md:p-8 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setExpandedBuilding(expandedBuilding === summary.buildingName ? null : summary.buildingName)}
                >
                  <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:text-blue-600 transition-colors">
                      <Building2 className="w-7 h-7" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-xl font-black text-gray-900 tracking-tight">{summary.buildingName}</h4>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">
                        {summary.items.length} materials issued
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 sm:gap-8">
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Value</p>
                      <p className="text-xl font-black text-gray-900 tracking-tighter">₹{summary.totalAmount.toLocaleString()}</p>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        exportToPDF(summary);
                      }}
                      className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all active:scale-95 group/btn shadow-sm"
                      title="Export PDF"
                    >
                      <Download className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                    </button>

                    <button
                      onClick={() => setExpandedBuilding(expandedBuilding === summary.buildingName ? null : summary.buildingName)}
                      className={`p-3 rounded-xl transition-all ${expandedBuilding === summary.buildingName ? 'bg-gray-900 text-white rotate-180' : 'bg-gray-100 text-gray-400'}`}
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedBuilding === summary.buildingName && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-50"
                    >
                      <div className="p-8 space-y-4">
                        <div className="grid grid-cols-4 px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          <div className="col-span-2">Material Name</div>
                          <div className="text-center">Quantity</div>
                          <div className="text-right">Amount</div>
                        </div>
                        <div className="space-y-2">
                          {summary.items.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-4 px-4 py-4 bg-gray-50 rounded-2xl items-center hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100 group">
                              <div className="col-span-2 flex items-center gap-3">
                                <Package className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                                <span className="font-bold text-gray-900">{item.materialName}</span>
                              </div>
                              <div className="text-center font-black text-gray-600">
                                {item.totalQuantity.toLocaleString()}
                              </div>
                              <div className="text-right font-black text-gray-900 flex items-center justify-end gap-1">
                                <span className="text-[10px] text-gray-400">₹</span>
                                {item.amount.toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          ) : (
            <div className="py-20 bg-white rounded-[2.5rem] border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
              <FileText className="w-16 h-16 mb-6 opacity-20" />
              <p className="text-lg font-bold tracking-tight uppercase">No records found for {months[selectedMonth]} {selectedYear}</p>
              <p className="text-sm font-medium mt-2">Try selecting a different time period</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
