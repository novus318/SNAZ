"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  CalendarDays, 
  Users, 
  Truck, 
  Package, 
  DollarSign, 
  FileText, 
  BarChart,
  Menu,
  X,
  Home,
  Sun,
  Moon,
  Building2,
  LogOut
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navigationItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: Home
  },
  {
    title: "Analytics", 
    href: "/analytics",
    icon: BarChart
  },
  {
    title: "Drivers",
    href: "/drivers",
    icon: Truck
  },
  {
    title: "Companies",
    href: "/companies",
    icon: Building2
  },
  {
    title: "Customers",
    href: "/customers", 
    icon: Users
  },
  {
    title: "Food Categories",
    href: "/categories",
    icon: Package
  },
  {
    title: "Lunch Orders",
    href: "/orders/lunch",
    icon: Sun
  },
  {
    title: "Dinner Orders",
    href: "/orders/dinner",
    icon: Moon
  },
  {
    title: "Bills",
    href: "/bills",
    icon: FileText
  },
  {
    title: "Payments",
    href: "/payments",
    icon: DollarSign
  }
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { logout, user } = useAuth();

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar overlay for mobile */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed top-0 left-0 z-40 h-screen w-56 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 leading-tight">SNAZ</h1>
                <p className="text-[10px] text-gray-500">Catering System</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="lg:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-3">
            <ul className="space-y-1.5">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        isActive 
                          ? "bg-blue-50 text-blue-700 border border-blue-200" 
                          : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                      )}
                    >
                      <Icon className={cn(
                        "w-4 h-4",
                        isActive ? "text-blue-700" : "text-gray-500"
                      )} />
                      <span>{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User Info & Logout */}
          <div className="p-3 border-t border-gray-200 space-y-3">
            {/* User Info */}
            <div className="px-3 py-2 bg-gray-50 rounded-md">
              <div className="text-xs font-medium text-gray-700">{user?.username}</div>
              <div className="text-[10px] text-gray-500 capitalize">{user?.role}</div>
            </div>
            
            {/* Logout Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="w-full justify-start text-gray-700 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-gray-100">
            <div className="text-[11px] text-gray-500 text-center leading-tight">
              <p>SNAZ Catering v1.0</p>
              <p className="mt-1">© 2024 All rights reserved</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
