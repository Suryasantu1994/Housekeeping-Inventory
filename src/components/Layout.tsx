import React, { useState } from 'react';
import { LayoutDashboard, List, History, Settings, Plus, Bell, FileText, Menu, ChevronLeft, ChevronRight, LogIn, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import logo from '../assets/images/hk_logo_1782666998761.jpg';
import Dashboard from './Dashboard';
import MaterialList from './MaterialList';
import TransactionHistory from './TransactionHistory';
import IssuanceCalendar from './IssuanceCalendar';
import AddMaterialForm from './AddMaterialForm';
import Requisitions from './Requisitions';
import SettingsView from './Settings';
import { useAuth } from '../contexts/AuthContext';

type View = 'dashboard' | 'inventory' | 'history' | 'calendar' | 'requisitions' | 'settings';

export default function Layout() {
  const { user, loading, signInWithGoogle, logout } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [showAddForm, setShowAddForm] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-white p-10 rounded-[2.5rem] shadow-2xl shadow-gray-200 w-full max-w-md text-center border border-gray-100"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 260, damping: 20 }}
            className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mx-auto mb-8 border border-gray-100 shadow-sm p-4"
          >
            <img src={logo} alt="Logo" className="w-full h-full object-contain" />
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-black text-gray-900 mb-3 tracking-tight"
          >
            HK MATERIALS
            </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-gray-500 font-medium mb-10 leading-relaxed"
          >
            Please sign in with your institutional account to manage inventory.
          </motion.p>
          
          <motion.button
            whileHover={{ scale: 1.02, backgroundColor: "#000000" }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-4 bg-gray-900 text-white py-4 px-6 rounded-2xl font-bold transition-all shadow-xl shadow-gray-200"
          >
            <LogIn className="w-6 h-6" />
            Continue with Google
          </motion.button>
        </motion.div>
      </div>
    );
  }

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, view: 'dashboard' as View },
    { name: 'Inventory', icon: List, view: 'inventory' as View },
    { name: 'History', icon: History, view: 'history' as View },
    { name: 'Issuance Calendar', icon: Bell, view: 'calendar' as View },
    { name: 'Requisitions', icon: FileText, view: 'requisitions' as View },
    { name: 'Settings', icon: Settings, view: 'settings' as View },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex transition-all duration-300">
      {/* Sidebar */}
      <aside 
        className={`${
          isCollapsed ? 'w-20' : 'w-64'
        } bg-white border-r border-gray-100 flex flex-col fixed inset-y-0 left-0 transition-all duration-300 z-50 overflow-hidden`}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-12">
            <div className={`flex items-center gap-3 transition-all duration-300 ${isCollapsed ? 'opacity-0 hidden' : 'opacity-100'}`}>
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-gray-100 shadow-sm">
                <img src={logo} alt="Logo" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight whitespace-nowrap">HK MATERIALS</h1>
            </div>
            {isCollapsed && (
              <div className="w-full flex justify-center mb-12">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-gray-100 shadow-sm">
                  <img src={logo} alt="Logo" className="w-full h-full object-cover" />
                </div>
              </div>
            )}
          </div>

          <nav className="space-y-2">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => setCurrentView(item.view)}
                title={isCollapsed ? item.name : ''}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                  currentView === item.view 
                    ? 'bg-gray-900 text-white shadow-lg shadow-gray-200' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
              >
                <item.icon className={`w-5 h-5 shrink-0 transition-transform ${currentView === item.view ? 'scale-110' : ''}`} />
                {!isCollapsed && <span className="font-bold text-sm whitespace-nowrap">{item.name}</span>}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-6 border-t border-gray-50">
            <button 
              onClick={() => setShowAddForm(true)}
              title={isCollapsed ? 'Add Material' : ''}
              className={`w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-100 ${isCollapsed ? 'px-0' : ''}`}
            >
              <Plus className="w-5 h-5 shrink-0" />
              {!isCollapsed && <span className="whitespace-nowrap">Add Material</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 p-8 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-3 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors shadow-sm text-gray-400 hover:text-gray-900"
            >
              {isCollapsed ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
            </button>
            <div>
              <h2 className="text-3xl font-black text-gray-900 uppercase">
                {navigation.find(n => n.view === currentView)?.name}
              </h2>
              <p className="text-gray-500 font-medium">Housekeeping Inventory Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-3 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors relative">
              <Bell className="w-5 h-5 text-gray-500" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-gray-100 group relative">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-10 h-10 rounded-full shrink-0 border-2 border-gray-100" />
              ) : (
                <div className="w-10 h-10 bg-gray-100 rounded-full shrink-0 flex items-center justify-center">
                  <span className="text-gray-500 font-bold">{user.displayName?.charAt(0) || 'U'}</span>
                </div>
              )}
              <div className="text-sm hidden sm:block">
                <p className="font-bold text-gray-900">{user.displayName || 'Staff Member'}</p>
                <p className="text-gray-500 text-xs font-medium truncate max-w-[120px]">{user.email}</p>
              </div>
              <button 
                onClick={logout}
                className="ml-2 p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-6xl">
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'inventory' && <MaterialList />}
          {currentView === 'history' && <TransactionHistory />}
          {currentView === 'calendar' && <IssuanceCalendar />}
          {currentView === 'requisitions' && <Requisitions />}
          {currentView === 'settings' && <SettingsView />}
        </div>
      </main>

      {showAddForm && <AddMaterialForm onClose={() => setShowAddForm(false)} />}
    </div>
  );
}
