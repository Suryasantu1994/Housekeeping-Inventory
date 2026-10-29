import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, formatFirebaseTimestamp } from '../lib/firebase';
import { Transaction, Building, Material } from '../types';
import { Building2, Calendar, FileText, ChevronDown, Package, IndianRupee, Download, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MaterialSummary {
  materialId: string;
  materialName: string;
  totalQuantity: number;
  totalAmount: number;
  unit?: string;
}

interface BuildingSummary {
  buildingId: string;
  buildingName: string;
  totalAmount: number;
  items: {
    materialId: string;
    materialName: string;
    totalQuantity: number;
    amount: number;
  }[];
}

export default function MonthlyReport() {
  const { profile: currentProfile } = useAuth();
  const [reportType, setReportType] = useState<'consumption' | 'received'>('consumption');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedBuilding, setExpandedBuilding] = useState<string | null>(null);

  useEffect(() => {
    const transPath = 'transactions';
    const buildPath = 'buildings';
    const matPath = 'materials';

    const isAdmin = currentProfile?.role === 'admin';
    const assignedBuildings = currentProfile?.assignedBuildings || [];

    // Fetch all transactions for the selected type
    let qTrans;
    if (isAdmin) {
      qTrans = query(
        collection(db, transPath),
        where('type', '==', reportType === 'consumption' ? 'out' : 'in'),
        orderBy('timestamp', 'desc')
      );
    } else if (assignedBuildings.length > 0) {
      if (reportType === 'consumption') {
        qTrans = query(
          collection(db, transPath),
          where('type', '==', 'out'),
          where('building', 'in', assignedBuildings.slice(0, 10)),
          orderBy('timestamp', 'desc')
        );
      } else {
        // Restocks are generally global, but for non-admins we might show all restocks or none.
        // Usually restocks are global inventory, so we show them all to staff if they have access.
        qTrans = query(
          collection(db, transPath),
          where('type', '==', 'in'),
          orderBy('timestamp', 'desc')
        );
      }
    }

    const unsubTrans = qTrans ? onSnapshot(qTrans, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          timestamp: formatFirebaseTimestamp(data.timestamp)
        } as Transaction;
      });
      setTransactions(docs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, transPath);
    }) : (() => {
      setTransactions([]);
      setLoading(false);
      return () => {};
    })();

    const qBuild = query(collection(db, buildPath), orderBy('name', 'asc'));
    const unsubBuild = onSnapshot(qBuild, (snapshot) => {
      setBuildings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Building)));
    });

    const qMat = query(collection(db, matPath), orderBy('name', 'asc'));
    const unsubMat = onSnapshot(qMat, (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material)));
    });

    return () => {
      unsubTrans();
      unsubBuild();
      unsubMat();
    };
  }, [currentProfile, reportType]);

  const filteredTransactions = transactions.filter(t => {
    try {
      const date = new Date(t.timestamp);
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    } catch (e) {
      return false;
    }
  });

  // Consumption Report Data
  const buildingSummaries: BuildingSummary[] = buildings.map(building => {
    const buildingTrans = filteredTransactions.filter(t => t.building === building.name);
    
    const materialMap = new Map<string, { materialId: string, materialName: string, totalQuantity: number, amount: number }>();
    
    let totalAmount = 0;
    buildingTrans.forEach(t => {
      const materialId = t.materialId || 'unknown';
      const materialName = t.materialName || 'Unknown Material';
      const existing = materialMap.get(materialId) || { materialId, materialName, totalQuantity: 0, amount: 0 };
      
      const itemAmount = t.quantity * t.unitPrice;
      existing.totalQuantity += t.quantity;
      existing.amount += itemAmount;
      totalAmount += itemAmount;
      
      materialMap.set(materialId, existing);
    });

    return {
      buildingId: building.id || building.name,
      buildingName: building.name,
      totalAmount,
      items: Array.from(materialMap.values()).sort((a, b) => b.amount - a.amount)
    };
  }).filter(summary => summary.items.length > 0)
    .sort((a, b) => b.totalAmount - a.totalAmount);

  // Received Materials Report Data
  const receivedSummaries: MaterialSummary[] = Array.from(
    filteredTransactions.reduce((acc, t) => {
      const matId = t.materialId || 'unknown';
      const matName = t.materialName || 'Unknown Material';
      const existing = acc.get(matId) || { materialId: matId, materialName: matName, totalQuantity: 0, totalAmount: 0 };
      
      existing.totalQuantity += t.quantity;
      existing.totalAmount += (t.quantity * t.unitPrice);
      
      const material = materials.find(m => m.id === matId);
      if (material) existing.unit = material.unit;
      
      acc.set(matId, existing);
      return acc;
    }, new Map<string, MaterialSummary>()).values()
  ) as MaterialSummary[];
  receivedSummaries.sort((a, b) => b.totalAmount - a.totalAmount);

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
    
    doc.setFontSize(22);
    doc.text('Monthly Consumption Report', 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Building: ${summary.buildingName}`, 14, 30);
    doc.text(`Period: ${monthName} ${selectedYear}`, 14, 37);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 44);
    
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

  const exportReceivedToPDF = () => {
    const doc = new jsPDF();
    const monthName = months[selectedMonth];
    
    doc.setFontSize(22);
    doc.text('Monthly Received Materials Report', 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Period: ${monthName} ${selectedYear}`, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 37);
    
    const tableData = receivedSummaries.map(item => [
      item.materialName,
      `${item.totalQuantity.toLocaleString()} ${item.unit || ''}`,
      `Rs. ${item.totalAmount.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Material Name', 'Total Received Qty', 'Total Value']],
      body: tableData,
      foot: [['Grand Total Received Value', '', `Rs. ${receivedSummaries.reduce((a, b) => a + b.totalAmount, 0).toLocaleString()}`]],
      theme: 'grid',
      headStyles: { fillColor: [17, 24, 39], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { top: 45 }
    });

    doc.save(`Received_Materials_${monthName}_${selectedYear}_Report.pdf`);
  };

  const grandTotal = reportType === 'consumption' 
    ? buildingSummaries.reduce((acc, curr) => acc + curr.totalAmount, 0)
    : receivedSummaries.reduce((acc, curr) => acc + curr.totalAmount, 0);

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col gap-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight leading-none uppercase">Reports</h2>
            <p className="text-sm text-gray-500 font-medium mt-2">Generate and export inventory reports</p>
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

        <div className="flex bg-gray-100 p-1.5 rounded-2xl w-fit self-center">
          <button
            onClick={() => setReportType('consumption')}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              reportType === 'consumption' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Consumption
          </button>
          <button
            onClick={() => setReportType('received')}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              reportType === 'received' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Received Materials
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`p-8 rounded-[2rem] text-white shadow-xl shadow-gray-200 transition-colors ${reportType === 'consumption' ? 'bg-gray-900' : 'bg-blue-600'}`}>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-2">
            {reportType === 'consumption' ? 'Grand Total Issued' : 'Grand Total Received'}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tighter">₹{grandTotal.toLocaleString()}</span>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">
            {reportType === 'consumption' ? 'Active Buildings' : 'Total Items'}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tighter text-gray-900">
              {reportType === 'consumption' ? buildingSummaries.length : receivedSummaries.length}
            </span>
            <span className="text-xs font-bold text-gray-400">{reportType === 'consumption' ? 'Buildings' : 'Materials'}</span>
          </div>
        </div>
        <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Total Units</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tighter text-gray-900">
              {filteredTransactions.reduce((acc, t) => acc + t.quantity, 0).toLocaleString()}
            </span>
            <span className="text-xs font-bold text-gray-400">Units</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-4">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
            {reportType === 'consumption' ? 'Building Wise Breakdown' : 'Material Wise Breakdown'}
          </h3>
          {reportType === 'received' && receivedSummaries.length > 0 && (
            <button
              onClick={exportReceivedToPDF}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Export Full Report
            </button>
          )}
        </div>

        <AnimatePresence mode="popLayout">
          {reportType === 'consumption' ? (
            buildingSummaries.length > 0 ? (
              buildingSummaries.map((summary) => (
                <motion.div
                  key={summary.buildingId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden"
                >
                  <div
                    className="w-full p-6 md:p-8 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpandedBuilding(expandedBuilding === summary.buildingId ? null : summary.buildingId)}
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
                        className={`p-3 rounded-xl transition-all ${expandedBuilding === summary.buildingId ? 'bg-gray-900 text-white rotate-180' : 'bg-gray-100 text-gray-400'}`}
                      >
                        <ChevronDown className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedBuilding === summary.buildingId && (
                      <motion.div
                        key="expanded-details"
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
                              <div key={item.materialId || idx} className="grid grid-cols-4 px-4 py-4 bg-gray-50 rounded-2xl items-center hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-100 group">
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
              <motion.div key="no-consumption-records" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <NoRecordsView months={months} selectedMonth={selectedMonth} selectedYear={selectedYear} />
              </motion.div>
            )
          ) : (
            receivedSummaries.length > 0 ? (
              <motion.div
                key="received-materials-container"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden"
              >
                <div className="p-8 space-y-6">
                  <div className="grid grid-cols-12 px-6 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <div className="col-span-6">Material Details</div>
                    <div className="col-span-3 text-center">Total Received</div>
                    <div className="col-span-3 text-right">Total Value</div>
                  </div>
                  <div className="space-y-3">
                    {receivedSummaries.map((summary, idx) => (
                      <div key={summary.materialId || idx} className="grid grid-cols-12 px-6 py-5 bg-gray-50 rounded-[1.5rem] items-center hover:bg-blue-50 transition-all group border border-transparent hover:border-blue-100">
                        <div className="col-span-6 flex items-center gap-4">
                          <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                            <Package className="w-5 h-5 text-blue-600" />
                          </div>
                          <span className="font-black text-gray-900 text-lg tracking-tight">{summary.materialName}</span>
                        </div>
                        <div className="col-span-3 text-center">
                          <span className="text-xl font-black text-gray-900 tracking-tighter">
                            {summary.totalQuantity.toLocaleString()}
                          </span>
                          <span className="ml-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{summary.unit}</span>
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="text-xl font-black text-blue-600 tracking-tighter">
                            ₹{summary.totalAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="no-received-records" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <NoRecordsView months={months} selectedMonth={selectedMonth} selectedYear={selectedYear} />
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function NoRecordsView({ months, selectedMonth, selectedYear }: { months: string[], selectedMonth: number, selectedYear: number }) {
  return (
    <div className="py-20 bg-white rounded-[2.5rem] border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
      <FileText className="w-16 h-16 mb-6 opacity-20" />
      <p className="text-lg font-bold tracking-tight uppercase">No records found for {months[selectedMonth]} {selectedYear}</p>
      <p className="text-sm font-medium mt-2">Try selecting a different time period or category</p>
    </div>
  );
}
