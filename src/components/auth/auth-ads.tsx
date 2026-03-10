"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Droplets, Info, Megaphone, Calendar, Bell, CheckCircle2 } from "lucide-react";
import { getActivePromotionsAction } from "@/lib/promo-actions";

interface Ad {
    id: string;
    title: string;
    description: string;
    icon_name: string;
    tag: string;
    display_duration?: number;
    image_url?: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
    'Megaphone': <Megaphone className="h-8 w-8 text-blue-300" />,
    'Info': <Info className="h-8 w-8 text-yellow-300" />,
    'Droplets': <Droplets className="h-8 w-8 text-teal-300" />,
    'Calendar': <Calendar className="h-8 w-8 text-purple-300" />,
    'Bell': <Bell className="h-8 w-8 text-amber-300" />,
    'CheckCircle2': <CheckCircle2 className="h-8 w-8 text-green-300" />,
};

export function AuthAds() {
    const [ads, setAds] = React.useState<Ad[]>([]);
    const [currentAd, setCurrentAd] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        async function loadAds() {
            const result = await getActivePromotionsAction();
            if (result.success && result.data && result.data.length > 0) {
                setAds(result.data);
            }
            setIsLoading(false);
        }
        loadAds();
    }, []);

    React.useEffect(() => {
        if (ads.length <= 1) return;

        const duration = ads[currentAd].display_duration || 5000;
        const timer = setTimeout(() => {
            setCurrentAd((prev) => (prev + 1) % ads.length);
        }, duration);

        return () => clearTimeout(timer);
    }, [ads.length, currentAd, ads]);

    if (isLoading) {
        return (
            <div className="hidden lg:flex flex-col justify-center max-w-xl w-full pr-12 animate-pulse">
                <div className="h-12 w-64 bg-white/10 rounded-lg mb-4" />
                <div className="h-4 w-full bg-white/5 rounded mb-12" />
                <Card className="glass-card p-8 border-none h-[220px] opacity-50" />
            </div>
        );
    }

    if (ads.length === 0) return null;

    return (
        <div className="hidden lg:flex flex-col justify-center flex-1 pr-12 animate-in fade-in slide-in-from-left-8 duration-700">
            <div className="mb-12">
                <h2 className="text-4xl font-extrabold text-white mb-4 tracking-tight">
                    Modernizing <span className="text-blue-400 underline decoration-blue-500/30 underline-offset-8">Utility Services</span>
                </h2>
                <p className="text-xl text-white/60 font-light leading-relaxed">
                    Access your account, track consumption, and manage payments effortlessly in one unified portal.
                </p>
            </div>

            <Card className="glass-card p-8 border-none relative overflow-hidden group min-h-[220px]">
                {/* Background Image if available */}
                {ads[currentAd].image_url && (
                    <div className="absolute inset-0 z-0 opacity-20 transition-opacity duration-700 group-hover:opacity-30">
                        <img
                            src={ads[currentAd].image_url}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    </div>
                )}

                <div className="absolute top-6 right-6 z-20 transition-all duration-500 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] group-hover:drop-shadow-[0_0_25px_rgba(255,255,255,0.8)] group-hover:scale-110">
                    <div className="animate-pulse">
                        {ICON_MAP[ads[currentAd].icon_name] || <Megaphone className="h-8 w-8 text-blue-300" />}
                    </div>
                </div>

                <div className="relative z-10 transition-all duration-500 transform">
                    <div className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-widest mb-4">
                        {ads[currentAd].tag}
                    </div>

                    <h3 className="text-2xl font-bold text-white mb-3 flex items-center gap-3">
                        {ads[currentAd].title}
                    </h3>

                    <p className="text-lg text-white/70 leading-relaxed min-h-[80px]">
                        {ads[currentAd].description}
                    </p>

                    <div className="mt-8 flex gap-2">
                        {ads.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentAd ? "w-8 bg-blue-400" : "w-1.5 bg-white/20"
                                    }`}
                            />
                        ))}
                    </div>
                </div>
            </Card>

            <div className="mt-12 grid grid-cols-2 gap-6 opacity-60 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-3 text-white/80">
                    <div className="p-2 rounded-lg bg-white/5"><Calendar className="h-5 w-5" /></div>
                    <span className="text-sm font-medium">Quick Bill Access</span>
                </div>
                <div className="flex items-center gap-3 text-white/80">
                    <div className="p-2 rounded-lg bg-white/5"><Droplets className="h-5 w-5" /></div>
                    <span className="text-sm font-medium">Usage Analytics</span>
                </div>
            </div>
        </div>
    );
}
