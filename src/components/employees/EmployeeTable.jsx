import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoreHorizontal, TrendingUp, Wallet } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function EmployeeTable({ employees = [], onEdit, onViewHistory, onViewWallet }) {
  const formatCurrency = (value) => {
    return `£${((value || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
  };

  const roleColors = {
    server: "bg-blue-50 text-blue-700 border-blue-200",
    bartender: "bg-purple-50 text-purple-700 border-purple-200",
    host: "bg-pink-50 text-pink-700 border-pink-200",
    kitchen: "bg-amber-50 text-amber-700 border-amber-200",
    manager: "bg-indigo-50 text-indigo-700 border-indigo-200",
    runner: "bg-emerald-50 text-emerald-700 border-emerald-200",
    other: "bg-slate-50 text-slate-700 border-slate-200"
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '??';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border-0 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
            <TableHead className="font-semibold text-slate-600">Employee</TableHead>
            <TableHead className="font-semibold text-slate-600">Role</TableHead>
            <TableHead className="font-semibold text-slate-600">Weight</TableHead>
            <TableHead className="font-semibold text-slate-600 text-right">Total Earned</TableHead>
            <TableHead className="font-semibold text-slate-600 text-right">Pending</TableHead>
            <TableHead className="font-semibold text-slate-600">Status</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                <p>No employees synced yet</p>
                <p className="text-sm mt-1">Connect Square to sync your team members</p>
              </TableCell>
            </TableRow>
          ) : (
            employees.map((employee) => (
              <TableRow key={employee.id} className="hover:bg-slate-50/50 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-500">
                      <AvatarFallback className="bg-transparent text-white text-xs font-medium">
                        {getInitials(employee.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-slate-900">{employee.full_name}</p>
                      <p className="text-sm text-slate-500">{employee.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`capitalize ${roleColors[employee.role] || roleColors.other}`}>
                    {employee.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium text-slate-700">
                    {employee.role_weight}x
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(employee.total_tips_earned)}
                    </span>
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="text-sm text-amber-600 font-medium">
                    {formatCurrency(employee.pending_tips)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={employee.employment_status === 'active' 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : "bg-slate-50 text-slate-700 border-slate-200"
                    }
                  >
                    {employee.employment_status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4 text-slate-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit?.(employee)}>
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewHistory?.(employee)}>
                        View Tip History
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewWallet?.(employee)}>
                        <Wallet className="w-4 h-4 mr-2" />
                        Wallet Pass
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}