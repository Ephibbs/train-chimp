import { Sidebar } from "@/components/sidebar";
import { UserNav } from "@/components/user-nav";
import { getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  
  if (!user) {
    redirect("/auth/signin");
  }

  // Format user data for the UserNav component
  const formattedUser = {
    id: user.id,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    email: user.email,
    image: user.user_metadata?.avatar_url,
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-800 shadow">
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <UserNav user={formattedUser} />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
} 