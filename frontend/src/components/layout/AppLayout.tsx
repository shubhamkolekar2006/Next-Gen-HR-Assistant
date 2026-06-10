import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { ChatBubble } from '../chatbot/ChatBubble';

export const AppLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="relative flex h-screen bg-white overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-white">
          <Outlet />
        </main>
      </div>
      <ChatBubble />
      {isSidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setIsSidebarOpen(false)}
          />
          <aside className="fixed left-0 top-0 bottom-0 z-50">
            <Sidebar
              onNavigate={() => setIsSidebarOpen(false)}
              onClose={() => setIsSidebarOpen(false)}
            />
          </aside>
        </>
      )}
    </div>
  );
};

