import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

const navigationSections = [
  {
    label: 'OPERATIONS',
    items: [
      { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard, color: 'text-purple-600' },
      { name: 'Allocations', page: 'Allocations', icon: PieChart, color: 'text-orange-600' },
      { name: 'Locations', page: 'Locations', icon: MapPin, color: 'text-orange-600' },
      { name: 'Employees', page: 'Employees', icon: Users, color: 'text-emerald-600' },
    ]
  },
  {
    label: 'COMPLIANCE & REPORTING',
    items: [
      { name: 'Compliance', page: 'Compliance', icon: Shield, color: 'text-rose-600' },
      { name: 'Reconciliation', page: 'Reconciliation', icon: RefreshCw, color: 'text-teal-600' },
      { name: 'Employee Portal', page: 'EmployeePortal', icon: User, color: 'text-purple-600' },
    ]
  },
  {
    label: 'SUPPORT',
    items: [
      { name: 'Settings', page: 'Settings', icon: Settings, color: 'text-slate-500' },
    ]
  }
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUserAccess = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);

        // Check if user has an organization
        const memberships = await base44.entities.UserOrganizationMembership.filter({
          user_id: user.id,
          status: 'active'
        });

        // If no organization, redirect to create one
        if (memberships.length === 0 && currentPageName !== 'Welcome') {
          navigate(createPageUrl('Welcome'));
          return;
        }
      } catch (error) {
        console.error('Failed to check user access:', error);
      }
    };
    
    checkUserAccess();
  }, [currentPageName, navigate]);

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
          <div style={{ minHeight: '100px', paddingTop: '24px', paddingBottom: '24px', borderBottom: '1px solid #f1f5f9', position: 'relative', background: 'linear-gradient(to bottom, #ffffff, #fafafa)' }}>
            <AppLogo />
            <button 
              className="lg:hidden absolute top-6 right-6 p-1 text-slate-400 hover:text-slate-600"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-6 overflow-y-auto">
            {navigationSections.map((section, sectionIndex) => (
              <div key={section.label} className={sectionIndex > 0 ? 'mt-6' : ''}>
                {/* Section Label */}
                <div className="px-3 mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {section.label}
                  </p>
                </div>

                {/* Section Items */}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = currentPageName === item.page;
                    return (
                      <Link
                        key={item.name}
                        to={createPageUrl(item.page)}
                        onClick={() => setSidebarOpen(false)}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                          transition-all duration-150 relative
                          ${isActive 
                            ? 'bg-blue-50 text-indigo-600 font-semibold' 
                            : 'text-slate-600 font-normal hover:bg-slate-50 hover:text-slate-900'
                          }
                        `}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600 rounded-r-full" />
                        )}
                        <item.icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : item.color}`} />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>

                {/* Section Divider */}
                {sectionIndex < navigationSections.length - 1 && (
                  <div className="mt-4 px-3">
                    <div className="h-px bg-slate-200" />
                  </div>
                )}
                </div>
                ))}
                </div>
                ))}
                </nav>



          {/* User menu */}
          <div className="px-3 py-4">
            <div className="h-px bg-slate-200 mb-4" />
          </div>
          <div className="px-4 pb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <Avatar className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-500">
                    <AvatarFallback className="bg-transparent text-white text-sm font-medium">
                      {currentUser?.full_name?.substring(0, 2).toUpperCase() || 'US'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-slate-900">{currentUser?.full_name || 'User'}</p>
                    <p className="text-xs text-slate-500">{currentUser?.email || ''}</p>
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
            <div style={{ height: '50px', display: 'flex', alignItems: 'center' }}>
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69492be29f510e4f29fe435b/01bc0fe1b_ChatGPTImageDec28202501_53_32PM.png" 
                alt="Tiply – digital tip management"
                style={{ height: '50px', width: 'auto', maxWidth: '220px', objectFit: 'contain', display: 'block' }}
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