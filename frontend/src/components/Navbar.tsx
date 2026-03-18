"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import { Gamepad2, Trophy, Home, Menu, X, Swords, Calendar, BarChart3, Bot, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/tournaments", label: "Tournaments", icon: Swords },
  { href: "/seasons", label: "Seasons", icon: Calendar },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/autonomous", label: "Autonomous", icon: Bot },
  { href: "/services", label: "Services", icon: Store },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50">
      {/* Glass background with gradient border bottom */}
      <div className="relative">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-[#0a0e1a]/90 backdrop-blur-xl" />

        {/* Bottom border */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[1px]"
          style={{
            backgroundImage: "linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.08), transparent)",
          }}
        />

        {/* Content */}
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <Image
                src="/logo.svg"
                alt="Claw Wars"
                width={34}
                height={34}
                className="relative rounded-lg"
              />
            </div>
            <span className="font-pixel text-sm tracking-wide">
              <span className="text-claw-red">CLAW</span>
              <span className="text-gray-300 ml-1">WARS</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300 rounded-lg",
                    isActive
                      ? "text-white"
                      : "text-gray-400 hover:text-gray-200"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-all duration-300",
                      isActive && "drop-shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                    )}
                  />
                  <span>{link.label}</span>

                  {/* Active glowing underline */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-active-glow"
                      className="absolute -bottom-[1px] left-2 right-2 h-[2px]"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                      }}
                    >
                      {/* The glow line */}
                      <div className="w-full h-full bg-gradient-to-r from-red-500 via-orange-400 to-red-500 rounded-full" />
                      {/* The glow effect beneath */}
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-orange-400 to-red-500 rounded-full blur-sm opacity-80" />
                    </motion.div>
                  )}

                  {/* Hover background */}
                  {!isActive && (
                    <div className="absolute inset-0 rounded-lg bg-white/[0.03] opacity-0 hover:opacity-100 transition-opacity duration-300" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side: Wallet + Mobile toggle */}
          <div className="flex items-center gap-3">
            <div className="[&_button]:!rounded-xl [&_button]:!font-semibold [&_button]:!text-sm">
              <ConnectButton
                showBalance={false}
                chainStatus="icon"
                accountStatus={{
                  smallScreen: "avatar",
                  largeScreen: "full",
                }}
              />
            </div>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="sm:hidden relative p-2 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <AnimatePresence mode="wait">
                {mobileOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="h-5 w-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu className="h-5 w-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="sm:hidden overflow-hidden relative"
          >
            {/* Glass backdrop for mobile menu */}
            <div className="absolute inset-0 bg-[#020617]/90 backdrop-blur-2xl" />
            <div className="relative px-4 py-3 space-y-1">
              {navLinks.map((link, index) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/" && pathname.startsWith(link.href));
                const Icon = link.icon;

                return (
                  <motion.div
                    key={link.href}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.08, duration: 0.3 }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300",
                        isActive
                          ? "text-white bg-white/[0.06] border border-white/[0.08]"
                          : "text-gray-400 hover:text-white hover:bg-white/[0.03]"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300",
                          isActive
                            ? "bg-red-500/15 text-red-400"
                            : "bg-white/[0.04] text-gray-500"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span>{link.label}</span>
                      {isActive && (
                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                      )}
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {/* Bottom gradient line */}
            <div
              className="h-[1px] animate-gradient"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.3), rgba(168, 85, 247, 0.3), transparent)",
                backgroundSize: "200% 100%",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
