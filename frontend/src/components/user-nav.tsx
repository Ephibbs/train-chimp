"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type User = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function UserNav({ user }: { user: User }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/signout');
    router.refresh();
  };

  return (
    <div className="relative">
      <button
        className="flex items-center space-x-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
          {user?.name?.[0] || user?.email?.[0] || "U"}
        </div>
        <span>{user?.name || user?.email}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 w-56 mt-2 origin-top-right bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
          <div className="py-1" role="menu" aria-orientation="vertical">
            <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
              <p className="font-medium">{user?.name}</p>
              <p className="text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
            </div>
            <hr className="border-gray-100 dark:border-gray-700" />
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
              role="menuitem"
            >
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Your Profile</span>
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
              role="menuitem"
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </button>
            <hr className="border-gray-100 dark:border-gray-700" />
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
              role="menuitem"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 