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
    Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import {
    getAllPromotionsAction,
    createPromotionAction,
    updatePromotionAction,
    deletePromotionAction
} from "@/lib/promo-actions";
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

export default function PromotionsManagementPage() {
    const { hasPermission } = usePermissions();
    const { toast } = useToast();
    const [promotions, setPromotions] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [editingPromo, setEditingPromo] = React.useState<any>(null);
    const [searchTerm, setSearchTerm] = React.useState("");

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
        if (hasPermission('promotions_manage') || hasPermission('settings_view')) {
            fetchPromotions();
        }
    }, [hasPermission, fetchPromotions]);

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

    if (!hasPermission('promotions_manage') && !hasPermission('settings_view')) {
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
                    <p className="text-muted-foreground">Manage animated banners shown on the login page.</p>
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
