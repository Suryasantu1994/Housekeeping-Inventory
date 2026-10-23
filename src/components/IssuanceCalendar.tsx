import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Transaction, Material } from '../types';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, Building2, Clock, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function IssuanceCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    const tQuery = query(
      collection(db, 'transactions'),
      where('type', '==', 'out'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeT = onSnapshot(tQuery, 
      (snapshot) => {
        const tData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        setTransactions(tData);
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'transactions')
    );

    const unsubscribeM = onSnapshot(collection(db, 'materials'), 
      (snapshot) => {
        const mData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
        setMaterials(mData);
      }
    );

    return () => {
      unsubscribeT();
      unsubscribeM();
    };
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getTransactionsForDay = (day: Date) => {
    return transactions.filter(t => isSameDay(new Date(t.timestamp), day));
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 font-bold uppercase tracking-widest text-xs">Loading calendar...</div>;
  }

  const selectedDayTransactions = selectedDate ? getTransactionsForDay(selectedDate) : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase leading-none">Issuance Calendar</h2>
          <p className="text-sm text-gray-500 font-bold mt-2 flex items-center gap-2 opacity-60">
            <CalendarIcon className="w-4 h-4" />
            Track material distribution by date
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 ring-1 ring-black/5">
          <button 
            onClick={prevMonth}
            className="p-3 hover:bg-gray-50 rounded-2xl text-gray-400 hover:text-gray-900 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-4 min-w-[160px] text-center">
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
          </div>
          <button 
            onClick={nextMonth}
            className="p-3 hover:bg-gray-50 rounded-2xl text-gray-400 hover:text-gray-900 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-gray-100 shadow-2xl shadow-gray-200/40 ring-1 ring-black/5 overflow-hidden">
        {/* Calendar Header */}
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-6 text-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const dayTransactions = getTransactionsForDay(day);
            const totalValue = dayTransactions.reduce((acc, t) => {
              const material = materials.find(m => m.id === t.materialId);
              return acc + (t.quantity * (material?.unitPrice || 0));
            }, 0);

            return (
              <motion.div
                key={day.toString()}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.01 }}
                onClick={() => dayTransactions.length > 0 && setSelectedDate(day)}
                className={`min-h-[140px] p-4 border-r border-b border-gray-50 transition-all cursor-default relative group ${
                  !isSameMonth(day, monthStart) ? 'bg-gray-50/30' : 'bg-white'
                } ${dayTransactions.length > 0 ? 'hover:bg-blue-50/50 cursor-pointer' : ''}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-black tracking-tighter ${
                    isToday(day) 
                      ? 'bg-blue-600 text-white w-8 h-8 flex items-center justify-center rounded-xl shadow-lg shadow-blue-200' 
                      : !isSameMonth(day, monthStart) ? 'text-gray-300' : 'text-gray-400'
                  }`}>
                    {format(day, 'd')}
                  </span>
                  {dayTransactions.length > 0 && (
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg group-hover:scale-110 transition-transform">
                      {dayTransactions.length} items
                    </span>
                  )}
                </div>

                <div className="space-y-1 mt-4">
                  {dayTransactions.slice(0, 2).map((t, i) => (
                    <div key={t.id} className="text-[9px] font-bold text-gray-500 truncate bg-white/80 p-1 rounded-lg border border-gray-100 shadow-sm">
                      {t.materialName || 'Material'} ({t.quantity})
                    </div>
                  ))}
                  {dayTransactions.length > 2 && (
                    <div className="text-[9px] font-black text-gray-400 pl-1">
                      + {dayTransactions.length - 2} more
                    </div>
                  )}
                </div>

                {totalValue > 0 && (
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="text-[10px] font-black text-gray-900 tracking-tight">
                      ₹{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDate(null)}
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
                  <h2 className="text-3xl font-black uppercase tracking-tight leading-none">
                    {format(selectedDate, 'MMMM d, yyyy')}
                  </h2>
                  <p className="text-gray-400 text-[10px] font-black mt-2 tracking-widest uppercase">Issuance Details</p>
                </div>
                <button 
                  onClick={() => setSelectedDate(null)}
                  className="p-3 hover:bg-white/10 rounded-2xl transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-10 max-h-[60vh] overflow-y-auto space-y-4">
                {selectedDayTransactions.map((t) => {
                  const material = materials.find(m => m.id === t.materialId);
                  const total = t.quantity * (material?.unitPrice || 0);
                  
                  return (
                    <div key={t.id} className="group p-6 bg-gray-50 rounded-[2rem] flex items-center justify-between hover:bg-blue-50 transition-all duration-300">
                      <div className="flex items-center gap-5">
                        <div className="p-4 bg-white text-gray-900 rounded-2xl shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                          <Package className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <h4 className="text-lg font-black text-gray-900 tracking-tight">{t.materialName || 'Material'}</h4>
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {t.building || 'General'}
                            </span>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(t.timestamp), 'p')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-gray-900 tracking-tighter">
                          {t.quantity} <span className="text-xs text-gray-400 uppercase tracking-widest">{material?.unit}</span>
                        </div>
                        <div className="text-[10px] font-bold text-gray-400 mt-1">
                          Total: ₹{total.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-10 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Daily Total Value</span>
                <span className="text-4xl font-black text-gray-900 tracking-tighter">
                  ₹{selectedDayTransactions.reduce((acc, t) => {
                    const material = materials.find(m => m.id === t.materialId);
                    return acc + (t.quantity * (material?.unitPrice || 0));
                  }, 0).toLocaleString()}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
