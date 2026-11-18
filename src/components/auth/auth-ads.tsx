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

const FALLBACK_ADS: Ad[] = [
    {
        id: "default-utility",
        title: "Save Water, Save Life",
        description: "Reporting leaks promptly helps conserve our precious resources. Contact us at 9xx for any issues.",
        icon_name: "Droplets",
        tag: "UTILITY",
        display_duration: 5000,
    }
];

export interface LoginHeroStyles {
    fontFamily: string;
    fontWeight: string;
    headlineColor: string;
    highlightColor: string;
    accentStyle: string;
    descColor: string;
    cardBg: string;
    customCardBg?: string;
    ambientGlow: string;
}

export function AuthAds() {
    const [ads, setAds] = React.useState<Ad[]>([]);
    const [currentAd, setCurrentAd] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(true);
    const [heroSettings, setHeroSettings] = React.useState<{
        title: string;
        highlight: string;
        description: string;
        styles: LoginHeroStyles;
    }>({
        title: "Modernizing",
        highlight: "Utility Services",
        description: "Access your account, track consumption, and manage payments effortlessly in one unified portal.",
        styles: {
            fontFamily: "sans",
            fontWeight: "extrabold",
            headlineColor: "#ffffff",
            highlightColor: "#60a5fa",
            accentStyle: "underline",
            descColor: "rgba(255, 255, 255, 0.7)",
            cardBg: "glass",
            customCardBg: "",
            ambientGlow: "blue",
        }
    });

    React.useEffect(() => {
        async function loadAds() {
            try {
                const result = await getActivePromotionsAction();
                if (result?.success) {
                    if (result.hero) {
                        setHeroSettings({
                            title: result.hero.title ?? "Modernizing",
                            highlight: result.hero.highlight ?? "Utility Services",
                            description: result.hero.description ?? "Access your account, track consumption, and manage payments effortlessly in one unified portal.",
                            styles: {
                                fontFamily: result.hero.styles?.fontFamily ?? "sans",
                                fontWeight: result.hero.styles?.fontWeight ?? "extrabold",
                                headlineColor: result.hero.styles?.headlineColor ?? "#ffffff",
                                highlightColor: result.hero.styles?.highlightColor ?? "#60a5fa",
                                accentStyle: result.hero.styles?.accentStyle ?? "underline",
                                descColor: result.hero.styles?.descColor ?? "rgba(255, 255, 255, 0.7)",
                                cardBg: result.hero.styles?.cardBg ?? "glass",
                                customCardBg: result.hero.styles?.customCardBg ?? "",
                                ambientGlow: result.hero.styles?.ambientGlow ?? "blue",
                            }
                        });
                    }
                    if (result.data && result.data.length > 0) {
                        setAds(result.data);
                    }
                }
            } catch (err) {
                console.warn('[auth-ads] Failed to load ads:', err);
            } finally {
                setIsLoading(false);
            }
        }
        loadAds();
    }, []);

    const displayAds = ads.length > 0 ? ads : FALLBACK_ADS;

    React.useEffect(() => {
        if (displayAds.length <= 1) return;

        const safeIndex = currentAd % displayAds.length;
        const duration = displayAds[safeIndex]?.display_duration || 5000;
        const timer = setTimeout(() => {
            setCurrentAd((prev) => (prev + 1) % displayAds.length);
        }, duration);

        return () => clearTimeout(timer);
    }, [displayAds.length, currentAd, displayAds]);

    if (isLoading) {
        return (
            <div className="flex flex-col justify-center max-w-xl w-full pr-0 lg:pr-12 animate-pulse mb-8 lg:mb-0">
                <div className="h-12 w-64 bg-white/10 rounded-lg mb-4" />
                <div className="h-4 w-full bg-white/5 rounded mb-12" />
                <Card className="glass-card p-8 border-none h-[220px] opacity-50" />
            </div>
        );
    }

    const currentPromo = displayAds[currentAd % displayAds.length];
    const styles = heroSettings.styles;

    // Font Family class resolver
    const fontFamilyClass =
        styles.fontFamily === 'serif' ? 'font-serif' :
        styles.fontFamily === 'mono' ? 'font-mono' :
        styles.fontFamily === 'display' ? 'font-sans uppercase tracking-tight' :
        'font-sans';

    // Font Weight class resolver
    const fontWeightClass =
        styles.fontWeight === 'black' ? 'font-black' :
        styles.fontWeight === 'extrabold' ? 'font-extrabold' :
        styles.fontWeight === 'bold' ? 'font-bold' :
        styles.fontWeight === 'semibold' ? 'font-semibold' :
        styles.fontWeight === 'medium' ? 'font-medium' :
        'font-extrabold';

    // Card background resolver
    const cardBgClass =
        styles.cardBg === 'midnight' ? 'bg-slate-950/85 border border-slate-800 backdrop-blur-xl shadow-2xl' :
        styles.cardBg === 'ocean' ? 'bg-gradient-to-br from-cyan-950/80 via-blue-950/85 to-slate-950/95 border border-blue-900/40 backdrop-blur-xl shadow-2xl' :
        styles.cardBg === 'emerald' ? 'bg-gradient-to-br from-emerald-950/80 via-teal-950/85 to-slate-950/95 border border-emerald-900/40 backdrop-blur-xl shadow-2xl' :
        styles.cardBg === 'indigo' ? 'bg-gradient-to-br from-indigo-950/80 via-purple-950/85 to-slate-950/95 border border-indigo-900/40 backdrop-blur-xl shadow-2xl' :
        styles.cardBg === 'custom' ? 'border border-white/10 backdrop-blur-xl shadow-2xl' :
        'glass-card border-none';

    // Custom card inline style (when custom CSS is specified)
    const customCardStyle = styles.cardBg === 'custom' && styles.customCardBg
        ? { background: styles.customCardBg }
        : undefined;

    return (
        <div className="flex flex-col justify-center flex-1 pr-0 lg:pr-12 animate-in fade-in slide-in-from-left-8 duration-700 w-full relative">
            {/* Ambient background glow */}
            {styles.ambientGlow !== 'none' && (
                <div
                    className={`absolute -top-16 -left-16 w-80 h-80 rounded-full blur-3xl pointer-events-none -z-10 opacity-30 ${
                        styles.ambientGlow === 'cyan' ? 'bg-cyan-500' :
                        styles.ambientGlow === 'emerald' ? 'bg-emerald-500' :
                        styles.ambientGlow === 'purple' ? 'bg-purple-500' :
                        'bg-blue-500'
                    }`}
                />
            )}

            <div className="mb-8 lg:mb-12 text-center lg:text-left">
                <h2
                    className={`text-3xl lg:text-4xl mb-4 tracking-tight leading-tight ${fontFamilyClass} ${fontWeightClass}`}
                    style={{ color: styles.headlineColor || '#ffffff' }}
                >
                    {heroSettings.title}{" "}
                    {heroSettings.highlight && (
                        styles.accentStyle === 'gradient' ? (
                            <span
                                className="bg-clip-text text-transparent font-black"
                                style={{
                                    backgroundImage: `linear-gradient(135deg, ${styles.highlightColor || '#60a5fa'}, #38bdf8)`
                                }}
                            >
                                {heroSettings.highlight}
                            </span>
                        ) : styles.accentStyle === 'badge' ? (
                            <span
                                className="inline-block px-3 py-1 rounded-lg border text-lg align-middle ml-2 font-bold"
                                style={{
                                    color: styles.highlightColor || '#60a5fa',
                                    backgroundColor: (styles.highlightColor || '#60a5fa') + '25',
                                    borderColor: (styles.highlightColor || '#60a5fa') + '50',
                                }}
                            >
                                {heroSettings.highlight}
                            </span>
                        ) : styles.accentStyle === 'plain' ? (
                            <span style={{ color: styles.highlightColor || '#60a5fa' }}>
                                {heroSettings.highlight}
                            </span>
                        ) : (
                            <span
                                className="underline underline-offset-8"
                                style={{
                                    color: styles.highlightColor || '#60a5fa',
                                    textDecorationColor: (styles.highlightColor || '#60a5fa') + '66'
                                }}
                            >
                                {heroSettings.highlight}
                            </span>
                        )
                    )}
                </h2>
                {heroSettings.description && (
                    <p
                        className="text-lg lg:text-xl font-light leading-relaxed max-w-2xl mx-auto lg:mx-0"
                        style={{ color: styles.descColor || 'rgba(255, 255, 255, 0.7)' }}
                    >
                        {heroSettings.description}
                    </p>
                )}
            </div>

            <Card
                className={`p-8 relative overflow-hidden group min-h-[220px] transition-all duration-500 ${cardBgClass}`}
                style={customCardStyle}
            >
                {/* Background Image if available */}
                {currentPromo?.image_url && (
                    <div className="absolute inset-0 z-0 transition-opacity duration-700">
                        <img
                            src={currentPromo.image_url}
                            alt=""
                            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent z-10" />
                    </div>
                )}

                <div className="absolute top-6 right-6 z-20 transition-all duration-500 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] group-hover:drop-shadow-[0_0_25px_rgba(255,255,255,0.8)] group-hover:scale-110">
                    <div className="animate-pulse">
                        {ICON_MAP[currentPromo?.icon_name || ""] || <Megaphone className="h-8 w-8 text-blue-300" />}
                    </div>
                </div>

                <div className="relative z-10 transition-all duration-500 transform">
                    <div className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-widest mb-4">
                        {currentPromo?.tag || "UTILITY"}
                    </div>

                    {currentPromo?.title && (
                        <h3 className="text-2xl font-bold text-white mb-3 flex items-center gap-3">
                            {currentPromo.title}
                        </h3>
                    )}

                    {currentPromo?.description && (
                        <p className="text-lg text-white/70 leading-relaxed min-h-[60px]">
                            {currentPromo.description}
                        </p>
                    )}

                    <div className="mt-8 flex gap-2">
                        {displayAds.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === (currentAd % displayAds.length) ? "w-8 bg-blue-400" : "w-1.5 bg-white/20"
                                    }`}
                            />
                        ))}
                    </div>
                </div>
            </Card>

            <div className="mt-8 lg:mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 opacity-60 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-3 text-white/80 justify-center lg:justify-start">
                    <div className="p-2 rounded-lg bg-white/5"><Calendar className="h-5 w-5" /></div>
                    <span className="text-sm font-medium">Quick Bill Access</span>
                </div>
                <div className="flex items-center gap-3 text-white/80 justify-center lg:justify-start">
                    <div className="p-2 rounded-lg bg-white/5"><Droplets className="h-5 w-5" /></div>
                    <span className="text-sm font-medium">Usage Analytics</span>
                </div>
            </div>
        </div>
    );
}
