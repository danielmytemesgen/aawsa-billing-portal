
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Bell, Send, Lock, Trash2, Edit, MessageSquareWarning, Megaphone, CheckCircle2, History, PlusCircle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  addNotification,
  deleteNotification,
  getNotifications,
  subscribeToNotifications,
  initializeNotifications,
  getBranches,
  subscribeToBranches,
  initializeBranches,
  updateNotification
} from "@/lib/data-store";
import type { DomainNotification } from "@/lib/data-store";
import type { Branch } from "../branches/branch-types";
import { usePermissions } from "@/hooks/use-permissions";
import { Alert, AlertTitle } from "@/components/ui/alert";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ALL_STAFF_VALUE = "all-staff-target";

const formSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters.").max(100, "Title is too long."),
  message: z.string().min(10, "Message must be at least 10 characters.").max(1000, "Message is too long."),
  target_branch_id: z.string().min(1, "You must select a target."),
});

type NotificationFormValues = z.infer<typeof formSchema>;

interface UserProfile {
  name?: string;
  role?: string;
  branchId?: string;
}

export default function AdminNotificationsPage() {
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [sentNotifications, setSentNotifications] = React.useState<DomainNotification[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const [notificationToDelete, setNotificationToDelete] = React.useState<DomainNotification | null>(null);
  const [editingNotification, setEditingNotification] = React.useState<DomainNotification | null>(null);

  React.useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));

    Promise.all([initializeNotifications(true), initializeBranches(true)]).then(() => {
      setSentNotifications(getNotifications());
      setBranches(getBranches());
      setIsLoading(false);
    });

    const unsubNotifications = subscribeToNotifications(setSentNotifications);
    const unsubBranches = subscribeToBranches(setBranches);

    return () => {
      unsubNotifications();
      unsubBranches();
    };
  }, []);

  const form = useForm<NotificationFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      message: "",
      target_branch_id: user?.role?.toLowerCase() === 'staff management' ? user.branchId : ALL_STAFF_VALUE,
    },

  });

  const editForm = useForm<NotificationFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      message: "",
      target_branch_id: ALL_STAFF_VALUE,
    },
  });

  const filteredAndSortedNotifications = React.useMemo(() => {
    let notificationsToDisplay = [...sentNotifications];

    const canSeeAll = hasPermission('notifications_view_all') || hasPermission('notifications_create');

    if (!canSeeAll && user?.branchId) {
      notificationsToDisplay = sentNotifications.filter(n =>
        n.targetBranchId === null || n.targetBranchId === user.branchId
      );
    }

    return notificationsToDisplay.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sentNotifications, user]);


  async function onSubmit(data: NotificationFormValues) {
    if (!user?.name) {
      toast({ variant: "destructive", title: "Error", description: "Could not find sender name. Please log in again." });
      return;
    }

    const targetBranchId = data.target_branch_id === ALL_STAFF_VALUE ? null : data.target_branch_id;

    const result = await addNotification({
      title: data.title,
      message: data.message,
      targetBranchId: targetBranchId,
      senderName: user.name,
    });

    if (result.success) {
      const displayTargetName = targetBranchId === null
        ? "All Staff"
        : branches.find(b => b.id === targetBranchId)?.name || "the selected branch";
      toast({ title: "Notification Sent", description: `Your message has been sent to ${displayTargetName}.` });
      form.reset({
        title: "",
        message: "",
        target_branch_id: user?.role?.toLowerCase() === 'staff management' ? user.branchId : ALL_STAFF_VALUE,
      });
    } else {
      toast({ variant: "destructive", title: "Failed to Send", description: result.message });
    }
  }

  const handleDelete = (notification: DomainNotification) => {
    setNotificationToDelete(notification);
  };

  const confirmDelete = async () => {
    if (notificationToDelete) {
      const result = await deleteNotification(notificationToDelete.id);
      if (result.success) {
        toast({ title: "Notification Deleted", description: `The notification has been removed.` });
      } else {
        toast({ variant: "destructive", title: "Delete Failed", description: result.message });
      }
      setNotificationToDelete(null);
    }
  };

  const handleEdit = (notification: DomainNotification) => {
    setEditingNotification(notification);
    editForm.reset({
      title: notification.title,
      message: notification.message,
      target_branch_id: notification.targetBranchId || ALL_STAFF_VALUE,
    });
  };

  const onEditSubmit = async (data: NotificationFormValues) => {
    if (!editingNotification) return;

    const targetBranchId = data.target_branch_id === ALL_STAFF_VALUE ? null : data.target_branch_id;

    const result = await updateNotification(editingNotification.id, {
      title: data.title,
      message: data.message,
      targetBranchId: targetBranchId,
    });

    if (result.success) {
      toast({ title: "Notification Updated", description: "The notification has been successfully updated." });
      setEditingNotification(null);
    } else {
      toast({ variant: "destructive", title: "Update Failed", description: result.message });
    }
  };

  const getDisplayTargetName = (targetId: string | null) => {
    if (targetId === null) return "All Staff";
    return branches.find(b => b.id === targetId)?.name || `ID: ${targetId}`;
  };

  const canCreateNotifications = hasPermission('notifications_create');
  const canViewNotifications = hasPermission('notifications_view') || hasPermission('notifications_view_all');
  const canEditNotifications = hasPermission('notifications_edit');
  const canDeleteNotifications = hasPermission('notifications_delete');
  const isBranchManager = user?.role?.toLowerCase() === 'staff management' && user.branchId;
  const canCreateSms = hasPermission('sms_send') || hasPermission('notifications_create');

  if (!canViewNotifications) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold">Notifications</h1>
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <CardDescription>You do not have permission to view this page.</CardDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Notifications Management</h1>
          <p className="text-slate-500 mt-1">Broadcast messages to staff and manage notification history.</p>
        </div>
      </div>

      {/* Stats Header */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="group relative overflow-hidden bg-white border-none shadow-md hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest bg-blue-100/50 px-2 py-0.5 rounded-sm inline-block mb-2">Total Sent</p>
                <p className="text-4xl font-extrabold text-slate-900">{sentNotifications.length}</p>
              </div>
              <div className="h-14 w-14 bg-blue-100/80 rounded-2xl flex items-center justify-center text-blue-600 rotate-3 group-hover:rotate-6 transition-transform">
                <Megaphone className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1 font-semibold text-blue-600">Active broadcasting</span>
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden bg-white border-none shadow-md hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest bg-emerald-100/50 px-2 py-0.5 rounded-sm inline-block mb-2">Branch Targets</p>
                <p className="text-4xl font-extrabold text-slate-900">{sentNotifications.filter(n => n.targetBranchId !== null).length}</p>
              </div>
              <div className="h-14 w-14 bg-emerald-100/80 rounded-2xl flex items-center justify-center text-emerald-600 -rotate-3 group-hover:rotate-0 transition-transform">
                <CheckCircle2 className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1 font-bold text-emerald-600">
                {Math.round((sentNotifications.filter(n => n.targetBranchId !== null).length / (sentNotifications.length || 1)) * 100)}% 
              </span>
              <span className="ml-1 italic">targeted messages</span>
            </div>
          </CardContent>
        </Card>

        <Card className="group relative overflow-hidden bg-white border-none shadow-md hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest bg-indigo-100/50 px-2 py-0.5 rounded-sm inline-block mb-2">Last 24 Hours</p>
                <p className="text-4xl font-extrabold text-slate-900">
                  {sentNotifications.filter(n => new Date(n.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000).length}
                </p>
              </div>
              <div className="h-14 w-14 bg-indigo-100/80 rounded-2xl flex items-center justify-center text-indigo-600 rotate-6 transition-transform">
                <History className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1 font-semibold text-indigo-600">Recent outreach</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {canCreateSms && (
        <Card className="shadow-lg border-none bg-gradient-to-br from-white to-slate-50 group hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                  <MessageSquareWarning className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-900">SMS Notifications</CardTitle>
                  <CardDescription className="text-slate-500">Engage bulk meter customers directly via SMS.</CardDescription>
                </div>
              </div>
              <Link href="/admin/notifications/sms">
                <Button className="bg-orange-600 hover:bg-orange-700 shadow-md group-hover:scale-105 transition-all">
                  Go to SMS Page <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-8 lg:grid-cols-5">
        {canCreateNotifications && (
          <Card className="shadow-xl lg:col-span-2 border-none bg-white">
            <CardHeader className="border-b bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">Compose Message</CardTitle>
                  <CardDescription>Send an urgent broadcast to staff.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., System Maintenance" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Enter your notification message here..." {...field} rows={6} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="target_branch_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Send To</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select target..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {!isBranchManager && <SelectItem value={ALL_STAFF_VALUE}>All Staff</SelectItem>}
                            {branches
                              .filter(branch => !isBranchManager || branch.id === user.branchId)
                              .map(branch => (
                                branch?.id ? (
                                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                                ) : null
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" disabled={form.formState.isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-base font-bold shadow-lg shadow-blue-200">
                    <Send className="mr-2 h-5 w-5" />
                    {form.formState.isSubmitting ? "Broadcasting..." : "Send Notification"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        <Card className={`shadow-xl border-none bg-white ${canCreateNotifications ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
          <CardHeader className="border-b bg-slate-50/50">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                <History className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Sent History</CardTitle>
                <CardDescription>Track all sent broadcasts and communications.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-0">
            <ScrollArea className="h-[550px]">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="font-bold text-slate-700 h-12">Message Content</TableHead>
                      <TableHead className="font-bold text-slate-700 h-12">Target Group</TableHead>
                      <TableHead className="font-bold text-slate-700 h-12">Timestamp</TableHead>
                      <TableHead className="text-right font-bold text-slate-700 h-12 pr-6">Management</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-500 italic">Loading broadcasts...</TableCell></TableRow>
                    ) : filteredAndSortedNotifications.length > 0 ? (
                      filteredAndSortedNotifications.map(n => (
                        <TableRow key={n.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="max-w-[300px] py-4">
                            <p className="font-bold text-slate-900 text-sm">{n.title}</p>
                            <p className="text-xs text-slate-500 line-clamp-2 mt-1 leading-relaxed">{n.message}</p>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge variant="secondary" className={`${n.targetBranchId ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'} font-bold px-2 py-0.5`}>
                              {getDisplayTargetName(n.targetBranchId)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-slate-600 py-4 tabular-nums">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-right pr-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {canEditNotifications && (
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(n)} className="h-9 w-9 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {canDeleteNotifications && (
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(n)} className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-32 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                          <Bell className="h-10 w-10 opacity-10" />
                          <p className="font-medium">No broadcasts sent yet.</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!notificationToDelete} onOpenChange={(open) => !open && setNotificationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the notification &quot;{notificationToDelete?.title}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editingNotification} onOpenChange={(open) => !open && setEditingNotification(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Notification</DialogTitle>
            <DialogDescription>
              Make changes to the notification here. Click save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="target_branch_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Send To</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select target..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {!isBranchManager && <SelectItem value={ALL_STAFF_VALUE}>All Staff</SelectItem>}
                        {branches
                          .filter(branch => !isBranchManager || branch.id === user?.branchId)
                          .map(branch => (
                            branch?.id ? (
                              <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                            ) : null
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={editForm.formState.isSubmitting}>
                  {editForm.formState.isSubmitting ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
