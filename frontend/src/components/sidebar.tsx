"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  MessageCircle, 
  Database, 
  FlaskConical, 
  Settings, 
  HelpCircle 
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  
  const navItems = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "Chat", href: "/chat", icon: MessageCircle },
    { name: "Datasets", href: "/datasets", icon: Database },
    { name: "Fine-tunes", href: "/finetunes", icon: FlaskConical },
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "Help", href: "/help", icon: HelpCircle },
  ];

  return (
    <div className="w-64 bg-white dark:bg-gray-800 shadow-lg overflow-y-auto">
      <div className="px-6 py-6">
        <Link href="/" className="flex items-center">
          <span className="text-2xl">🐵</span>
          <span className="ml-2 text-xl font-bold">TrainChimp</span>
        </Link>
      </div>
      <nav className="mt-5 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center px-3 py-2 text-sm font-medium rounded-md",
                isActive
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              )}
            >
              <item.icon
                className={cn(
                  "mr-3 h-5 w-5",
                  isActive
                    ? "text-blue-500 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400"
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
} 