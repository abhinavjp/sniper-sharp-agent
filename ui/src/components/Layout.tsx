import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex h-screen bg-slate-100 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-200 font-sans overflow-hidden transition-all duration-300">
      {/* Subtle background gradients for dark mode atmosphere */}
      <div className="hidden dark:block fixed -top-40 -left-40 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="hidden dark:block fixed top-1/2 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none"></div>
      
      <Sidebar />
      <main className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
