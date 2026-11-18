"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Megaphone,
    Info,
    Droplets,
    Plus,
    Pencil,
    Trash2,
    Save,
    X,
    Calendar,
    Bell,
    CheckCircle2,
    Search,
    Upload,
    Link as LinkIcon,
    Image as ImageIcon,
    FileImage,
    Sparkles,
    RotateCcw,
    Palette,
    Type,
    Layers,
    Sliders,
    Eye,
    Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/constants/auth";
import {
    getAllPromotionsAction,
    createPromotionAction,
    updatePromotionAction,
    deletePromotionAction,
    getLoginHeroSettingsAction,
    updateLoginHeroSettingsAction
} from "@/lib/promo-actions";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ICONS = [
    { name: 'Megaphone', icon: <Megaphone className="h-4 w-4" /> },
    { name: 'Info', icon: <Info className="h-4 w-4" /> },
    { name: 'Droplets', icon: <Droplets className="h-4 w-4" /> },
    { name: 'Calendar', icon: <Calendar className="h-4 w-4" /> },
    { name: 'Bell', icon: <Bell className="h-4 w-4" /> },
    { name: 'CheckCircle2', icon: <CheckCircle2 className="h-4 w-4" /> },
];

const HEADLINE_COLORS = [
    { name: 'Pure White', value: '#ffffff' },
    { name: 'Soft Slate', value: '#e2e8f0' },
    { name: 'Warm Cream', value: '#fef3c7' },
    { name: 'Ice Cyan', value: '#e0f2fe' },
    { name: 'Light Emerald', value: '#d1fae5' },
    { name: 'Amber Gold', value: '#fde68a' },
];

const HIGHLIGHT_COLORS = [
    { name: 'Electric Blue', value: '#60a5fa' },
    { name: 'Neon Cyan', value: '#22d3ee' },
    { name: 'Emerald', value: '#34d399' },
    { name: 'Purple', value: '#a78bfa' },
    { name: 'Rose Pink', value: '#fb7185' },
    { name: 'Amber Gold', value: '#fbbf24' },
];

const DESC_COLORS = [
    { name: 'Soft White (70%)', value: 'rgba(255, 255, 255, 0.7)' },
    { name: 'Bright White', value: '#ffffff' },
    { name: 'Muted Slate', value: '#94a3b8' },
    { name: 'Pale Cyan', value: '#bae6fd' },
];

const CARD_THEMES = [
    { id: 'glass', name: 'Deep Glass', desc: 'Glassmorphism dark effect' },
    { id: 'midnight', name: 'Midnight Obsidian', desc: 'Solid obsidian dark slate' },
    { id: 'ocean', name: 'Oceanic Teal', desc: 'Cyan & navy gradient' },
    { id: 'emerald', name: 'Emerald Forest', desc: 'Emerald & teal gradient' },
    { id: 'indigo', name: 'Royal Indigo', desc: 'Indigo & purple gradient' },
    { id: 'custom', name: 'Custom CSS', desc: 'User custom gradient or solid' },
];

const DEFAULT_HERO_CONFIG = {
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
};

export default function PromotionsManagementPage() {
    const { hasPermission } = usePermissions();
    const canManage = hasPermission(PERMISSIONS.PROMOTIONS_MANAGE) || hasPermission(PERMISSIONS.SETTINGS_MANAGE);
    const canView = canManage || hasPermission(PERMISSIONS.PROMOTIONS_VIEW) || hasPermission(PERMISSIONS.SETTINGS_VIEW);

    const { toast } = useToast();
    const [promotions, setPromotions] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingPromo, setEditingPromo] = React.useState<any>(null);
    const [searchTerm, setSearchTerm] = React.useState("");

    // Login screen hero header text and styles state
    const [heroForm, setHeroForm] = React.useState(DEFAULT_HERO_CONFIG);
    const [isSavingHero, setIsSavingHero] = React.useState(false);
    const [isLoadingHero, setIsLoadingHero] = React.useState(true);

    const [formData, setFormData] = React.useState({
        title: "",
        description: "",
        tag: "",
        icon_name: "Megaphone",
        is_active: true,
        display_order: 0,
        display_duration: 5000,
        image_url: ""
    });

    const [imageSourceMode, setImageSourceMode] = React.useState<"file" | "url">("file");
    const [isDragging, setIsDragging] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const getImageFormatBadge = (url: string) => {
        if (!url) return null;
        if (url.startsWith('data:image/svg+xml') || url.toLowerCase().includes('.svg')) return 'SVG Vector';
        if (url.startsWith('data:image/gif') || url.toLowerCase().includes('.gif')) return 'GIF Graphic';
        if (url.startsWith('data:image/png') || url.toLowerCase().includes('.png')) return 'PNG Image';
        if (url.startsWith('data:image/webp') || url.toLowerCase().includes('.webp')) return 'WebP Image';
        if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg') || url.toLowerCase().match(/\.jpe?g/)) return 'JPEG Image';
        if (url.startsWith('data:image/avif') || url.toLowerCase().includes('.avif')) return 'AVIF Image';
        if (url.startsWith('data:image/bmp') || url.toLowerCase().includes('.bmp')) return 'BMP Graphic';
        return 'Graphic Image';
    };

    const handleFileSelected = (file: File) => {
        if (!file) return;

        const isImage = file.type.startsWith('image/') || file.name.match(/\.(png|jpe?g|webp|gif|svg|avif|bmp|ico|tiff?)$/i);

        if (!isImage) {
            toast({
                variant: "destructive",
                title: "Invalid File Format",
                description: "Please select a valid image or graphic file (PNG, JPG, WebP, GIF, SVG, AVIF, BMP)."
            });
            return;
        }

        if (file.size > 8 * 1024 * 1024) {
            toast({
                variant: "destructive",
                title: "File Too Large",
                description: "Image size should be less than 8MB."
            });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            if (result) {
                setFormData(prev => ({ ...prev, image_url: result }));
                toast({
                    title: "Image Uploaded",
                    description: `${file.name} attached successfully.`
                });
            }
        };
        reader.readAsDataURL(file);
    };

    const fetchHeroSettings = React.useCallback(async () => {
        setIsLoadingHero(true);
        const result = await getLoginHeroSettingsAction();
        if (result.success && result.data) {
            setHeroForm({
                title: result.data.title ?? "Modernizing",
                highlight: result.data.highlight ?? "Utility Services",
                description: result.data.description ?? "Access your account, track consumption, and manage payments effortlessly in one unified portal.",
                styles: {
                    fontFamily: result.data.styles?.fontFamily ?? "sans",
                    fontWeight: result.data.styles?.fontWeight ?? "extrabold",
                    headlineColor: result.data.styles?.headlineColor ?? "#ffffff",
                    highlightColor: result.data.styles?.highlightColor ?? "#60a5fa",
                    accentStyle: result.data.styles?.accentStyle ?? "underline",
                    descColor: result.data.styles?.descColor ?? "rgba(255, 255, 255, 0.7)",
                    cardBg: result.data.styles?.cardBg ?? "glass",
                    customCardBg: result.data.styles?.customCardBg ?? "",
                    ambientGlow: result.data.styles?.ambientGlow ?? "blue",
                }
            });
        }
        setIsLoadingHero(false);
    }, []);

    const fetchPromotions = React.useCallback(async () => {
        setIsLoading(true);
        const result = await getAllPromotionsAction();
        if (result.success) {
            setPromotions(result.data ?? []);
        } else {
            toast({
                variant: "destructive",
                title: "Error",
                description: result.message || "Failed to load promotions",
            });
        }
        setIsLoading(false);
    }, [toast]);

    React.useEffect(() => {
        if (canView) {
            fetchPromotions();
            fetchHeroSettings();
        }
    }, [canView, fetchPromotions, fetchHeroSettings]);

    // Auto-refresh: re-fetch promotions when DataRefreshProvider signals new data
    React.useEffect(() => {
        const handleDataRefreshed = () => {
            if (canView) {
                fetchPromotions();
                fetchHeroSettings();
            }
        };
        window.addEventListener('data-refreshed', handleDataRefreshed);
        return () => window.removeEventListener('data-refreshed', handleDataRefreshed);
    }, [canView, fetchPromotions, fetchHeroSettings]);

    const handleSaveHero = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setIsSavingHero(true);
        const result = await updateLoginHeroSettingsAction(heroForm);
        if (result.success) {
            toast({
                title: "Login Hero Text Updated",
                description: "The login page title, highlighted emphasis, and description have been updated.",
            });
        } else {
            toast({
                variant: "destructive",
                title: "Failed to Update Hero Text",
                description: result.message || "Could not save hero settings.",
            });
        }
        setIsSavingHero(false);
    };

    const handleResetHero = async () => {
        setHeroForm(DEFAULT_HERO_CONFIG);
        setIsSavingHero(true);
        const result = await updateLoginHeroSettingsAction(DEFAULT_HERO_CONFIG);
        if (result.success) {
            toast({
                title: "Reset to Default",
                description: "Login hero text, typography, colors, and background restored to default values.",
            });
        } else {
            toast({
                variant: "destructive",
                title: "Reset Failed",
                description: result.message,
            });
        }
        setIsSavingHero(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (editingPromo) {
            const result = await updatePromotionAction(editingPromo.id, formData);
            if (result.success) {
                toast({ title: "Success", description: "Promotion updated successfully" });
                setIsDialogOpen(false);
                fetchPromotions();
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
        } else {
            const result = await createPromotionAction(formData);
            if (result.success) {
                toast({ title: "Success", description: "Promotion created successfully" });
                setIsDialogOpen(false);
                fetchPromotions();
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
        }
    };

    const handleEdit = (promo: any) => {
        setEditingPromo(promo);
        const imgUrl = promo.image_url || "";
        setFormData({
            title: promo.title || "",
            description: promo.description || "",
            tag: promo.tag,
            icon_name: promo.icon_name || "Megaphone",
            is_active: promo.is_active,
            display_order: promo.display_order || 0,
            display_duration: promo.display_duration || 5000,
            image_url: imgUrl
        });
        if (imgUrl.startsWith('data:')) {
            setImageSourceMode("file");
        } else if (imgUrl.startsWith('http')) {
            setImageSourceMode("url");
        }
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this promotion?")) {
            const result = await deletePromotionAction(id);
            if (result.success) {
                toast({ title: "Success", description: "Promotion deleted successfully" });
                fetchPromotions();
            } else {
                toast({ variant: "destructive", title: "Error", description: result.message });
            }
        }
    };

    const handleToggleActive = async (promo: any) => {
        const result = await updatePromotionAction(promo.id, { is_active: !promo.is_active });
        if (result.success) {
            fetchPromotions();
        } else {
            toast({ variant: "destructive", title: "Error", description: result.message });
        }
    };

    const filteredPromotions = promotions.filter(p =>
        (p.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.tag || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!canView) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <Card className="max-w-md text-center">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2 text-red-500">
                            <X className="h-6 w-6" /> Forbidden
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>You do not have permission to manage promotions.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Promotions Management</h1>
                    <p className="text-muted-foreground">Manage animated banners and headline copy shown on the login page.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open);
                    if (!open) {
                        setEditingPromo(null);
                        setFormData({
                            title: "",
                            description: "",
                            tag: "",
                            icon_name: "Megaphone",
                            is_active: true,
                            display_order: 0,
                            display_duration: 5000,
                            image_url: ""
                        });
                    }
                }}>
                    <DialogTrigger asChild>
                        <Button className="shrink-0">
                            <Plus className="mr-2 h-4 w-4" /> Add Promotion
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                        <form onSubmit={handleSubmit}>
                            <DialogHeader>
                                <DialogTitle>{editingPromo ? "Edit Promotion" : "Add New Promotion"}</DialogTitle>
                                <DialogDescription>
                                    This will be displayed in the glassmorphism carousel on the login page.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="title">Title (Optional)</Label>
                                    <Input
                                        id="title"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g. Digital Payment Simplified"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="tag">Tag/Category</Label>
                                    <Input
                                        id="tag"
                                        value={formData.tag}
                                        onChange={e => setFormData({ ...formData, tag: e.target.value })}
                                        placeholder="e.g. Feature Update"
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="description">Description (Optional)</Label>
                                    <Input
                                        id="description"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Brief details about the promotion..."
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-semibold">Banner Graphic / Image (Optional)</Label>
                                        <div className="flex items-center bg-muted rounded-lg p-0.5 text-xs">
                                            <button
                                                type="button"
                                                onClick={() => setImageSourceMode("file")}
                                                className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 font-medium ${
                                                    imageSourceMode === "file"
                                                        ? "bg-background text-foreground shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                <Upload className="h-3 w-3" /> Upload File
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setImageSourceMode("url")}
                                                className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 font-medium ${
                                                    imageSourceMode === "url"
                                                        ? "bg-background text-foreground shadow-sm"
                                                        : "text-muted-foreground hover:text-foreground"
                                                }`}
                                            >
                                                <LinkIcon className="h-3 w-3" /> Image URL
                                            </button>
                                        </div>
                                    </div>

                                    {imageSourceMode === "file" ? (
                                        <div
                                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                            onDragLeave={() => setIsDragging(false)}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setIsDragging(false);
                                                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                                    handleFileSelected(e.dataTransfer.files[0]);
                                                }
                                            }}
                                            onClick={() => fileInputRef.current?.click()}
                                            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                                                isDragging
                                                    ? "border-primary bg-primary/10"
                                                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                                            }`}
                                        >
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.svg,.avif,.bmp,.ico"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files && e.target.files[0]) {
                                                        handleFileSelected(e.target.files[0]);
                                                    }
                                                }}
                                            />
                                            <div className="p-2.5 rounded-full bg-primary/10 text-primary">
                                                <Upload className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-foreground">Click to upload image or drag & drop</p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                    Supports SVG vector graphics, PNG, JPG, WebP, GIF, AVIF, BMP (Max 8MB)
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            <Input
                                                id="image_url"
                                                value={formData.image_url}
                                                onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                                                placeholder="https://example.com/banner-graphic.png"
                                            />
                                            <p className="text-[10px] text-muted-foreground">Enter a direct image URL link to display as promo background.</p>
                                        </div>
                                    )}

                                    {/* Live Graphic / Image Preview */}
                                    {formData.image_url && (
                                        <div className="relative mt-1 rounded-lg border bg-slate-900 text-white p-2.5 overflow-hidden flex items-center justify-between gap-3 shadow-sm">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="relative w-14 h-11 rounded border border-white/20 overflow-hidden bg-black/50 flex-shrink-0 flex items-center justify-center">
                                                    <img
                                                        src={formData.image_url}
                                                        alt="Promo Graphic Preview"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium text-white truncate">Graphic Preview</span>
                                                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-300 font-bold border border-blue-400/30">
                                                            {getImageFormatBadge(formData.image_url)}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 truncate max-w-[200px]">
                                                        {formData.image_url.startsWith('data:') ? 'Uploaded local file graphic' : formData.image_url}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 shrink-0"
                                                onClick={() => setFormData({ ...formData, image_url: "" })}
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="icon">Icon</Label>
                                        <Select
                                            value={formData.icon_name}
                                            onValueChange={val => setFormData({ ...formData, icon_name: val })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select icon" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ICONS.map(i => (
                                                    <SelectItem key={i.name} value={i.name}>
                                                        <div className="flex items-center gap-2">
                                                            {i.icon} {i.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="order">Display Order</Label>
                                        <Input
                                            id="order"
                                            type="number"
                                            value={formData.display_order}
                                            onChange={e => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="duration">Duration (Seconds)</Label>
                                        <Input
                                            id="duration"
                                            type="number"
                                            value={formData.display_duration / 1000}
                                            onChange={e => setFormData({ ...formData, display_duration: (parseFloat(e.target.value) || 0) * 1000 })}
                                            step="0.5"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <Switch
                                        id="is_active"
                                        checked={formData.is_active}
                                        onCheckedChange={checked => setFormData({ ...formData, is_active: checked })}
                                    />
                                    <Label htmlFor="is_active">Visible on Login Page</Label>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" className="w-full">
                                    <Save className="mr-2 h-4 w-4" /> {editingPromo ? "Save Changes" : "Create Promotion"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Login Screen Hero Text Customizer */}
            <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-blue-500" />
                                Login Screen Hero & Style Customizer
                            </CardTitle>
                            <CardDescription>
                                Customize headline text, font typography, color palette, and background theme shown on the login page.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleResetHero}
                                disabled={isSavingHero || !canManage}
                                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                            >
                                <RotateCcw className="h-3.5 w-3.5" /> Reset to Default
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleSaveHero}
                                disabled={isSavingHero || !canManage}
                                className="h-8 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {isSavingHero ? (
                                    <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Save className="h-3.5 w-3.5" />
                                )}
                                Save Customization
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-2">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Editor Tabs */}
                        <div className="lg:col-span-7">
                            <Tabs defaultValue="content" className="w-full">
                                <TabsList className="grid grid-cols-4 w-full mb-4">
                                    <TabsTrigger value="content" className="text-xs flex items-center gap-1.5">
                                        <Type className="h-3.5 w-3.5" /> Text
                                    </TabsTrigger>
                                    <TabsTrigger value="typography" className="text-xs flex items-center gap-1.5">
                                        <Sliders className="h-3.5 w-3.5" /> Font
                                    </TabsTrigger>
                                    <TabsTrigger value="colors" className="text-xs flex items-center gap-1.5">
                                        <Palette className="h-3.5 w-3.5" /> Colors
                                    </TabsTrigger>
                                    <TabsTrigger value="background" className="text-xs flex items-center gap-1.5">
                                        <Layers className="h-3.5 w-3.5" /> Background
                                    </TabsTrigger>
                                </TabsList>

                                {/* TAB 1: CONTENT */}
                                <TabsContent value="content" className="space-y-4 pt-1">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="hero-title" className="text-xs font-semibold">
                                                Primary Headline
                                            </Label>
                                            <Input
                                                id="hero-title"
                                                value={heroForm.title}
                                                onChange={(e) => setHeroForm(prev => ({ ...prev, title: e.target.value }))}
                                                placeholder="e.g. Modernizing"
                                                disabled={!canManage}
                                                className="h-9"
                                            />
                                            <p className="text-[11px] text-muted-foreground">Leading title word(s).</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="hero-highlight" className="text-xs font-semibold">
                                                Highlighted Accent Text
                                            </Label>
                                            <Input
                                                id="hero-highlight"
                                                value={heroForm.highlight}
                                                onChange={(e) => setHeroForm(prev => ({ ...prev, highlight: e.target.value }))}
                                                placeholder="e.g. Utility Services"
                                                disabled={!canManage}
                                                className="h-9 font-medium text-blue-600 dark:text-blue-400"
                                            />
                                            <p className="text-[11px] text-muted-foreground">Word(s) rendered with styled emphasis.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label htmlFor="hero-desc" className="text-xs font-semibold">
                                            Subtitle / Intro Description
                                        </Label>
                                        <Textarea
                                            id="hero-desc"
                                            rows={3}
                                            value={heroForm.description}
                                            onChange={(e) => setHeroForm(prev => ({ ...prev, description: e.target.value }))}
                                            placeholder="Access your account, track consumption, and manage payments effortlessly in one unified portal."
                                            disabled={!canManage}
                                            className="resize-none text-sm"
                                        />
                                        <p className="text-[11px] text-muted-foreground">
                                            Displayed directly below the headline on the public login pages.
                                        </p>
                                    </div>
                                </TabsContent>

                                {/* TAB 2: TYPOGRAPHY & FONT STYLE */}
                                <TabsContent value="typography" className="space-y-4 pt-1">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold">Font Family</Label>
                                            <Select
                                                value={heroForm.styles.fontFamily}
                                                onValueChange={(val) => setHeroForm(prev => ({
                                                    ...prev,
                                                    styles: { ...prev.styles, fontFamily: val }
                                                }))}
                                                disabled={!canManage}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue placeholder="Select font family" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="sans">Modern Sans (Inter / Clean)</SelectItem>
                                                    <SelectItem value="serif">Classic Serif (Editorial / Elegant)</SelectItem>
                                                    <SelectItem value="mono">Monospace (Technical / Precise)</SelectItem>
                                                    <SelectItem value="display">Display Uppercase (Bold Impact)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[11px] text-muted-foreground">Headline font typeface family.</p>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold">Font Weight</Label>
                                            <Select
                                                value={heroForm.styles.fontWeight}
                                                onValueChange={(val) => setHeroForm(prev => ({
                                                    ...prev,
                                                    styles: { ...prev.styles, fontWeight: val }
                                                }))}
                                                disabled={!canManage}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue placeholder="Select weight" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="medium">Medium (500)</SelectItem>
                                                    <SelectItem value="semibold">Semi-Bold (600)</SelectItem>
                                                    <SelectItem value="bold">Bold (700)</SelectItem>
                                                    <SelectItem value="extrabold">Extra Bold (800 - Default)</SelectItem>
                                                    <SelectItem value="black">Heavy Black (900)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[11px] text-muted-foreground">Visual boldness of the headline.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Accent Highlight Style</Label>
                                        <Select
                                            value={heroForm.styles.accentStyle}
                                            onValueChange={(val) => setHeroForm(prev => ({
                                                ...prev,
                                                styles: { ...prev.styles, accentStyle: val }
                                            }))}
                                            disabled={!canManage}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Select accent style" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="underline">Underline with Translucent Glow (Default)</SelectItem>
                                                <SelectItem value="gradient">Vibrant Gradient Text Clip</SelectItem>
                                                <SelectItem value="badge">Highlighted Pill Badge Tag</SelectItem>
                                                <SelectItem value="plain">Solid Colored Plain Text</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[11px] text-muted-foreground">How the highlighted accent word(s) are decorated.</p>
                                    </div>
                                </TabsContent>

                                {/* TAB 3: COLORS */}
                                <TabsContent value="colors" className="space-y-4 pt-1">
                                    {/* Primary Headline Color */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold">Primary Headline Color</Label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={heroForm.styles.headlineColor.startsWith('#') ? heroForm.styles.headlineColor : '#ffffff'}
                                                    onChange={(e) => setHeroForm(prev => ({
                                                        ...prev,
                                                        styles: { ...prev.styles, headlineColor: e.target.value }
                                                    }))}
                                                    disabled={!canManage}
                                                    className="w-6 h-6 rounded cursor-pointer border border-muted bg-transparent p-0"
                                                />
                                                <span className="text-[11px] font-mono text-muted-foreground">
                                                    {heroForm.styles.headlineColor}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {HEADLINE_COLORS.map(c => (
                                                <button
                                                    key={c.value}
                                                    type="button"
                                                    onClick={() => setHeroForm(prev => ({
                                                        ...prev,
                                                        styles: { ...prev.styles, headlineColor: c.value }
                                                    }))}
                                                    className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 border transition-all ${
                                                        heroForm.styles.headlineColor === c.value
                                                            ? 'border-primary ring-1 ring-primary font-semibold bg-muted'
                                                            : 'border-muted hover:border-foreground/30 bg-background'
                                                    }`}
                                                >
                                                    <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: c.value }} />
                                                    {c.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Highlight Accent Color */}
                                    <div className="space-y-2 pt-2 border-t">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold">Accent Highlight Color</Label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={heroForm.styles.highlightColor.startsWith('#') ? heroForm.styles.highlightColor : '#60a5fa'}
                                                    onChange={(e) => setHeroForm(prev => ({
                                                        ...prev,
                                                        styles: { ...prev.styles, highlightColor: e.target.value }
                                                    }))}
                                                    disabled={!canManage}
                                                    className="w-6 h-6 rounded cursor-pointer border border-muted bg-transparent p-0"
                                                />
                                                <span className="text-[11px] font-mono text-muted-foreground">
                                                    {heroForm.styles.highlightColor}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {HIGHLIGHT_COLORS.map(c => (
                                                <button
                                                    key={c.value}
                                                    type="button"
                                                    onClick={() => setHeroForm(prev => ({
                                                        ...prev,
                                                        styles: { ...prev.styles, highlightColor: c.value }
                                                    }))}
                                                    className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 border transition-all ${
                                                        heroForm.styles.highlightColor === c.value
                                                            ? 'border-primary ring-1 ring-primary font-semibold bg-muted'
                                                            : 'border-muted hover:border-foreground/30 bg-background'
                                                    }`}
                                                >
                                                    <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: c.value }} />
                                                    {c.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Subtitle / Description Color */}
                                    <div className="space-y-2 pt-2 border-t">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-semibold">Description / Subtitle Color</Label>
                                            <span className="text-[11px] font-mono text-muted-foreground">
                                                {heroForm.styles.descColor}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {DESC_COLORS.map(c => (
                                                <button
                                                    key={c.value}
                                                    type="button"
                                                    onClick={() => setHeroForm(prev => ({
                                                        ...prev,
                                                        styles: { ...prev.styles, descColor: c.value }
                                                    }))}
                                                    className={`px-2 py-1 rounded text-[11px] flex items-center gap-1.5 border transition-all ${
                                                        heroForm.styles.descColor === c.value
                                                            ? 'border-primary ring-1 ring-primary font-semibold bg-muted'
                                                            : 'border-muted hover:border-foreground/30 bg-background'
                                                    }`}
                                                >
                                                    <span className="w-2.5 h-2.5 rounded-full border border-black/20" style={{ backgroundColor: c.value }} />
                                                    {c.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* TAB 4: BACKGROUND & THEME */}
                                <TabsContent value="background" className="space-y-4 pt-1">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold">Promotional Card Background Theme</Label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {CARD_THEMES.map(theme => (
                                                <button
                                                    key={theme.id}
                                                    type="button"
                                                    onClick={() => setHeroForm(prev => ({
                                                        ...prev,
                                                        styles: { ...prev.styles, cardBg: theme.id }
                                                    }))}
                                                    disabled={!canManage}
                                                    className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between gap-1.5 ${
                                                        heroForm.styles.cardBg === theme.id
                                                            ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
                                                            : 'border-muted hover:border-foreground/30 bg-card'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between w-full">
                                                        <span className="text-xs font-bold">{theme.name}</span>
                                                        {heroForm.styles.cardBg === theme.id && (
                                                            <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-muted-foreground line-clamp-1">{theme.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {heroForm.styles.cardBg === 'custom' && (
                                        <div className="space-y-1.5 pt-2">
                                            <Label htmlFor="custom-bg" className="text-xs font-semibold">
                                                Custom CSS Background
                                            </Label>
                                            <Input
                                                id="custom-bg"
                                                value={heroForm.styles.customCardBg || ''}
                                                onChange={(e) => setHeroForm(prev => ({
                                                    ...prev,
                                                    styles: { ...prev.styles, customCardBg: e.target.value }
                                                }))}
                                                placeholder="e.g. linear-gradient(135deg, #091e3a 0%, #2f80ed 100%)"
                                                disabled={!canManage}
                                                className="h-9 font-mono text-xs"
                                            />
                                            <p className="text-[11px] text-muted-foreground">
                                                Accepts any CSS background value (gradient, hex, rgba).
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-2 pt-2 border-t">
                                        <Label className="text-xs font-semibold">Ambient Header Glow</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { id: 'blue', name: 'Electric Blue', bg: 'bg-blue-500' },
                                                { id: 'cyan', name: 'Neon Cyan', bg: 'bg-cyan-500' },
                                                { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-500' },
                                                { id: 'purple', name: 'Purple', bg: 'bg-purple-500' },
                                                { id: 'none', name: 'Disabled (None)', bg: 'bg-gray-400' },
                                            ].map(g => (
                                                <button
                                                    key={g.id}
                                                    type="button"
                                                    onClick={() => setHeroForm(prev => ({
                                                        ...prev,
                                                        styles: { ...prev.styles, ambientGlow: g.id }
                                                    }))}
                                                    disabled={!canManage}
                                                    className={`px-2.5 py-1 rounded text-[11px] flex items-center gap-1.5 border transition-all ${
                                                        heroForm.styles.ambientGlow === g.id
                                                            ? 'border-primary ring-1 ring-primary font-semibold bg-muted'
                                                            : 'border-muted hover:border-foreground/30 bg-background'
                                                    }`}
                                                >
                                                    <span className={`w-2.5 h-2.5 rounded-full ${g.bg}`} />
                                                    {g.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>

                        {/* Live Login Page Preview */}
                        <div className="lg:col-span-5">
                            <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-[#0c2233] via-[#081826] to-[#040f1a] p-5 text-white shadow-xl relative overflow-hidden min-h-[300px]">
                                {/* Ambient glow in preview */}
                                {heroForm.styles.ambientGlow !== 'none' && (
                                    <div
                                        className={`absolute -top-10 -left-10 w-44 h-44 rounded-full blur-3xl pointer-events-none -z-0 opacity-40 ${
                                            heroForm.styles.ambientGlow === 'cyan' ? 'bg-cyan-500' :
                                            heroForm.styles.ambientGlow === 'emerald' ? 'bg-emerald-500' :
                                            heroForm.styles.ambientGlow === 'purple' ? 'bg-purple-500' :
                                            'bg-blue-500'
                                        }`}
                                    />
                                )}

                                <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2 relative z-10">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                                        <Sparkles className="h-3 w-3" /> Live Login Screen Preview
                                    </span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/20">
                                        Real-Time
                                    </span>
                                </div>

                                <div className="relative z-10 space-y-2 mb-5">
                                    <h3
                                        className={`text-xl sm:text-2xl tracking-tight leading-snug ${
                                            heroForm.styles.fontFamily === 'serif' ? 'font-serif' :
                                            heroForm.styles.fontFamily === 'mono' ? 'font-mono' :
                                            heroForm.styles.fontFamily === 'display' ? 'font-sans uppercase tracking-tight' :
                                            'font-sans'
                                        } ${
                                            heroForm.styles.fontWeight === 'black' ? 'font-black' :
                                            heroForm.styles.fontWeight === 'extrabold' ? 'font-extrabold' :
                                            heroForm.styles.fontWeight === 'bold' ? 'font-bold' :
                                            heroForm.styles.fontWeight === 'semibold' ? 'font-semibold' :
                                            heroForm.styles.fontWeight === 'medium' ? 'font-medium' :
                                            'font-extrabold'
                                        }`}
                                        style={{ color: heroForm.styles.headlineColor || '#ffffff' }}
                                    >
                                        {heroForm.title || "Modernizing"}{" "}
                                        {heroForm.highlight && (
                                            heroForm.styles.accentStyle === 'gradient' ? (
                                                <span
                                                    className="bg-clip-text text-transparent font-black"
                                                    style={{
                                                        backgroundImage: `linear-gradient(135deg, ${heroForm.styles.highlightColor || '#60a5fa'}, #38bdf8)`
                                                    }}
                                                >
                                                    {heroForm.highlight}
                                                </span>
                                            ) : heroForm.styles.accentStyle === 'badge' ? (
                                                <span
                                                    className="inline-block px-2 py-0.5 rounded border text-xs align-middle ml-1.5 font-bold"
                                                    style={{
                                                        color: heroForm.styles.highlightColor || '#60a5fa',
                                                        backgroundColor: (heroForm.styles.highlightColor || '#60a5fa') + '25',
                                                        borderColor: (heroForm.styles.highlightColor || '#60a5fa') + '50',
                                                    }}
                                                >
                                                    {heroForm.highlight}
                                                </span>
                                            ) : heroForm.styles.accentStyle === 'plain' ? (
                                                <span style={{ color: heroForm.styles.highlightColor || '#60a5fa' }}>
                                                    {heroForm.highlight}
                                                </span>
                                            ) : (
                                                <span
                                                    className="underline underline-offset-4"
                                                    style={{
                                                        color: heroForm.styles.highlightColor || '#60a5fa',
                                                        textDecorationColor: (heroForm.styles.highlightColor || '#60a5fa') + '66'
                                                    }}
                                                >
                                                    {heroForm.highlight}
                                                </span>
                                            )
                                        )}
                                    </h3>
                                    <p
                                        className="text-xs font-light leading-relaxed line-clamp-3"
                                        style={{ color: heroForm.styles.descColor || 'rgba(255, 255, 255, 0.7)' }}
                                    >
                                        {heroForm.description || "Access your account, track consumption, and manage payments effortlessly in one unified portal."}
                                    </p>
                                </div>

                                {/* Mini Banner Card Preview */}
                                <div
                                    className={`relative z-10 p-3 rounded-lg text-xs transition-all ${
                                        heroForm.styles.cardBg === 'midnight' ? 'bg-slate-950/85 border border-slate-800' :
                                        heroForm.styles.cardBg === 'ocean' ? 'bg-gradient-to-br from-cyan-950/80 via-blue-950/85 to-slate-950/95 border border-blue-900/40' :
                                        heroForm.styles.cardBg === 'emerald' ? 'bg-gradient-to-br from-emerald-950/80 via-teal-950/85 to-slate-950/95 border border-emerald-900/40' :
                                        heroForm.styles.cardBg === 'indigo' ? 'bg-gradient-to-br from-indigo-950/80 via-purple-950/85 to-slate-950/95 border border-indigo-900/40' :
                                        heroForm.styles.cardBg === 'custom' ? 'border border-white/10' :
                                        'glass-card border-none'
                                    }`}
                                    style={heroForm.styles.cardBg === 'custom' && heroForm.styles.customCardBg ? { background: heroForm.styles.customCardBg } : undefined}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                                            CARD PREVIEW
                                        </span>
                                        <Droplets className="h-3.5 w-3.5 text-teal-300" />
                                    </div>
                                    <div className="text-[11px] font-bold text-white mb-0.5">Save Water, Save Life</div>
                                    <div className="text-[10px] text-white/60 line-clamp-1">Reporting leaks promptly helps conserve resources.</div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-white/40 relative z-10">
                                    <span>AAWSA Public Portal</span>
                                    <span>Live Preview</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Banner List</CardTitle>
                        <div className="relative w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search banners..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px]">Order</TableHead>
                                        <TableHead>Preview</TableHead>
                                        <TableHead>Promotion Info</TableHead>
                                        <TableHead>Duration</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredPromotions.length > 0 ? (
                                        filteredPromotions.map((promo) => (
                                            <TableRow key={promo.id}>
                                                <TableCell className="font-mono">{promo.display_order}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-lg bg-primary/10 text-primary w-min">
                                                            {ICONS.find(i => i.name === promo.icon_name)?.icon || <Megaphone className="h-4 w-4" />}
                                                        </div>
                                                        {promo.image_url && (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-10 h-10 rounded border overflow-hidden bg-gray-900 flex-shrink-0 flex items-center justify-center shadow-sm">
                                                                    <img src={promo.image_url} alt="Preview" className="w-full h-full object-cover" />
                                                                </div>
                                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                                                                    {getImageFormatBadge(promo.image_url)}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold flex items-center gap-2">
                                                            {promo.title}
                                                            <span className="text-[10px] uppercase bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground font-semibold tracking-wider">
                                                                {promo.tag}
                                                            </span>
                                                        </span>
                                                        <span className="text-sm text-muted-foreground line-clamp-1">{promo.description}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Switch
                                                        checked={promo.is_active}
                                                        onCheckedChange={() => handleToggleActive(promo)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs font-mono">{promo.display_duration / 1000}s</span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(promo)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(promo.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                                No promotions found. Click &quot;Add Promotion&quot; to create one.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2 text-blue-700 dark:text-blue-300">
                            <Info className="h-4 w-4" /> Placement
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
                            The promotions are rotated based on their individual set durations (default 5s) on the main login screen.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
