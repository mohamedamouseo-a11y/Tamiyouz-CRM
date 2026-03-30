import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { Bell, Calendar, Check, Clock, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-blue-100 text-blue-700 border-blue-200",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  High: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-orange-100 text-orange-700",
  Done: "bg-green-100 text-green-700",
  Cancelled: "bg-gray-100 text-gray-500",
};

export default function LeadReminders({ leadId }: { leadId: number }) {
  const { t, language } = useLanguage();
  const isRTL = language === "ar";
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("09:00");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");

  const utils = trpc.useUtils();
  const { data: reminders, isLoading } = trpc.leadReminders.getByLead.useQuery({ leadId });
  const createMutation = trpc.leadReminders.create.useMutation({
    onSuccess: () => {
      utils.leadReminders.getByLead.invalidate({ leadId });
      utils.leadReminders.getToday.invalidate();
      utils.leadReminders.getCalendar.invalidate();
      toast.success(isRTL ? "تم إضافة التذكير" : "Reminder added");
      resetForm();
    },
  });
  const markDoneMutation = trpc.leadReminders.markDone.useMutation({
    onSuccess: () => {
      utils.leadReminders.getByLead.invalidate({ leadId });
      utils.leadReminders.getToday.invalidate();
      utils.leadReminders.getCalendar.invalidate();
      toast.success(isRTL ? "تم إكمال التذكير" : "Reminder completed");
    },
  });
  const deleteMutation = trpc.leadReminders.delete.useMutation({
    onSuccess: () => {
      utils.leadReminders.getByLead.invalidate({ leadId });
      utils.leadReminders.getToday.invalidate();
      utils.leadReminders.getCalendar.invalidate();
      toast.success(isRTL ? "تم حذف التذكير" : "Reminder deleted");
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setTitle("");
    setDescription("");
    setReminderDate("");
    setReminderTime("09:00");
    setPriority("Medium");
  };

  const handleSubmit = () => {
    if (!title.trim() || !reminderDate) {
      toast.error(isRTL ? "يرجى ملء العنوان والتاريخ" : "Please fill title and date");
      return;
    }
    createMutation.mutate({
      leadId,
      title: title.trim(),
      description: description.trim() || null,
      reminderDate,
      reminderTime,
      priority,
    });
  };

  const isOverdue = (dateStr: string) => {
    return new Date(dateStr) < new Date() ;
  };

  const pendingReminders = reminders?.filter((r: any) => r.status === "Pending") ?? [];
  const doneReminders = reminders?.filter((r: any) => r.status === "Done") ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Bell size={14} />
          {t("reminders" as any)}
          {pendingReminders.length > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">{pendingReminders.length}</Badge>
          )}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="h-7 text-xs gap-1">
          {showForm ? <X size={12} /> : <Plus size={12} />}
          {showForm ? (isRTL ? "إلغاء" : "Cancel") : t("addReminder" as any)}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <div>
              <Label className="text-xs">{t("reminderTitle" as any)}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isRTL ? "مثال: متابعة العميل" : "e.g. Follow up with client"}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">{t("reminderDescription" as any)}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={isRTL ? "تفاصيل إضافية..." : "Additional details..."}
                className="text-sm mt-1 min-h-[60px]"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">{t("reminderDate" as any)}</Label>
                <Input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">{t("reminderTime" as any)}</Label>
                <Input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">{t("reminderPriority" as any)}</Label>
                <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">{t("priorityLow" as any)}</SelectItem>
                    <SelectItem value="Medium">{t("priorityMedium" as any)}</SelectItem>
                    <SelectItem value="High">{t("priorityHigh" as any)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending} className="w-full h-8 text-xs">
              {createMutation.isPending ? "..." : t("addReminder" as any)}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="py-6 text-center text-muted-foreground text-xs">{isRTL ? "جاري التحميل..." : "Loading..."}</div>
        ) : pendingReminders.length === 0 && doneReminders.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-xs">{t("noReminders" as any)}</div>
        ) : (
          <div className="space-y-2">
            {pendingReminders.map((reminder: any) => (
              <div
                key={reminder.id}
                className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors ${
                  isOverdue(reminder.reminderDate) ? "border-red-200 bg-red-50/50" : "border-border bg-background"
                }`}
              >
                <button
                  onClick={() => markDoneMutation.mutate({ id: reminder.id })}
                  className="mt-0.5 w-5 h-5 rounded-full border-2 border-muted-foreground/30 hover:border-green-500 hover:bg-green-50 flex items-center justify-center transition-colors shrink-0"
                >
                  <Check size={10} className="text-transparent hover:text-green-500" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{reminder.title}</span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[reminder.priority]}`}>
                      {t((`priority${reminder.priority}`) as any)}
                    </Badge>
                    {isOverdue(reminder.reminderDate) && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        {isRTL ? "متأخر" : "Overdue"}
                      </Badge>
                    )}
                  </div>
                  {reminder.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{reminder.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      {format(new Date(reminder.reminderDate), "dd/MM/yyyy")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {reminder.reminderTime}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => deleteMutation.mutate({ id: reminder.id })}
                  className="text-muted-foreground/50 hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {doneReminders.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">{t("completedReminders" as any)} ({doneReminders.length})</p>
                {doneReminders.slice(0, 3).map((reminder: any) => (
                  <div key={reminder.id} className="flex items-center gap-3 p-2 rounded-lg opacity-60">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <Check size={10} className="text-green-600" />
                    </div>
                    <span className="text-sm line-through text-muted-foreground flex-1 truncate">{reminder.title}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(reminder.completedAt || reminder.createdAt), "dd/MM")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
