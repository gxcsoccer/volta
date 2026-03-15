"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [secretInput, setSecretInput] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const secret = localStorage.getItem("volta_secret");
    setAuthed(!!secret);
    setChecking(false);
  }, []);

  const handleLogin = () => {
    if (!secretInput.trim()) return;
    localStorage.setItem("volta_secret", secretInput.trim());
    setAuthed(true);
    setSecretInput("");
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto mt-20 space-y-4">
        <h1 className="text-xl font-bold text-center">Admin Access</h1>
        <div className="flex gap-2">
          <input
            type="password"
            placeholder="Enter admin secret..."
            value={secretInput}
            onChange={(e) => setSecretInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="flex-1 bg-gray-800/60 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-yellow-400/50 transition-colors"
          />
          <button
            onClick={handleLogin}
            className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-gray-950 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  const navItems = [
    { href: "/admin", label: "Agents" },
    { href: "/admin/skills", label: "Skills" },
  ];

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-48 shrink-0">
        <div className="sticky top-20 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium px-3 mb-2">
            Admin
          </div>
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-yellow-400/10 text-yellow-400 font-medium"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                }`}
              >
                {item.label}
              </a>
            );
          })}
          <hr className="border-gray-800/60 my-3" />
          <a
            href="/"
            className="block px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Back to Arena
          </a>
          <button
            onClick={() => {
              localStorage.removeItem("volta_secret");
              setAuthed(false);
            }}
            className="block w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-red-400 transition-colors cursor-pointer"
          >
            Lock Admin
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
