import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Toaster } from 'sonner';
import { 
  LayoutDashboard, 
  MapPin, 
  Users, 
  PieChart, 
  Shield, 
  Settings,
  Menu,
  X,
  LogOut,
  ChevronRight,
  User,
  RefreshCw,
  Activity
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { base44 } from '@/api/base44Client';
import AppLogo from '@/components/common/AppLogo';

const navigation = [
  { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard },
  { name: 'Locations', page: 'Locations', icon: MapPin },
  { name: 'Employees', page: 'Employees', icon: Users },
  { name: 'Allocations', page: 'Allocations', icon: PieChart },
  { name: 'Compliance', page: 'Compliance', icon: Shield },
  { name: 'Settings', page: 'Settings', icon: Settings },
  { name: 'Square Help', page: 'SquareTroubleshoot', icon: Activity },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" richColors />
      
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-slate-200 
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div style={{ minHeight: '72px', paddingTop: '16px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9', position: 'relative' }}>
            <AppLogo />
            <button 
              className="lg:hidden absolute top-6 right-6 p-1 text-slate-400 hover:text-slate-600"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.page)}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    transition-all duration-150
                    ${isActive 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }
                  `}
                >
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {item.name}
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto text-indigo-400" />}
                </Link>
              );
            })}
          </nav>

          {/* Additional Links */}
          <div className="px-3 py-2 space-y-1 border-t border-slate-100">
            <Link
              to={createPageUrl('Reconciliation')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <RefreshCw className="w-5 h-5 text-slate-400" />
              Reconciliation
            </Link>
            <Link
              to={createPageUrl('EmployeePortal')}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            >
              <User className="w-5 h-5 text-slate-400" />
              Employee Portal
            </Link>
          </div>

          {/* User menu */}
          <div className="p-4 border-t border-slate-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <Avatar className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-500">
                    <AvatarFallback className="bg-transparent text-white text-sm font-medium">
                      AD
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-slate-900">Admin User</p>
                    <p className="text-xs text-slate-500">admin@demo.com</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl('Settings')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl('ButtonWiringChecklist')}>
                    <Activity className="w-4 h-4 mr-2" />
                    Button Checklist
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl('SmokeTest')}>
                    <Activity className="w-4 h-4 mr-2" />
                    Smoke Tests
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-rose-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-sm border-b border-slate-200 lg:hidden">
          <div className="flex items-center justify-between h-16 px-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-slate-600 hover:text-slate-900"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div style={{ height: '40px', display: 'flex', alignItems: 'center' }}>
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69492be29f510e4f29fe435b/01bc0fe1b_ChatGPTImageDec28202501_53_32PM.png" 
                alt="Tiply – digital tip management"
                style={{ height: '40px', width: 'auto', maxWidth: '180px', objectFit: 'contain', display: 'block' }}
              />
            </div>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        </header>

        {/* Page content */}
        <main>
          {children}
        </main>
      </div>
    </div>
  );
}