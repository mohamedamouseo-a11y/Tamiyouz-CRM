import CRMLayout from "@/components/CRMLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { format, addHours, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, parseISO, addMonths, subMonths } from "date-fns";
import { ar } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  ExternalLink,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

type ContactType = "meeting" | "call" | "follow_up";

interface EventForm {
  summary: string;
  description: string;
  location: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  attendees: string;
  clientId: string;
  clientName: string;
  contactType: ContactType;
}

const defaultForm: EventForm = {
  summary: "",
  description: "",
  location: "",
  startDate: format(new Date(), "yyyy-MM-dd"),
  startTime: "10:00",
  endDate: format(new Date(), "yyyy-MM-dd"),
  endTime: "11:00",
  attendees: "",
  clientId: "",
  clientName: "",
  contactType: "meeting",
};

const contactTypeLabels = {
  meeting: { en: "Meeting", ar: "اجتماع", icon: Video, color: "bg-blue-100 text-blue-700 border-blue-200" },
  call: { en: "Phone Call", ar: "اتصال هاتفي", icon: Phone, color: "bg-green-100 text-green-700 border-green-200" },
  follow_up: { en: "Follow-up", ar: "متابعة", icon: Clock, color: "bg-amber-100 text-amber-700 border-amber-200" },
};

const eventColors: Record<ContactType, string> = {
  meeting: "bg-blue-500/15 text-blue-700 border-l-2 border-blue-500",
  call: "bg-green-500/15 text-green-700 border-l-2 border-green-500",
  follow_up: "bg-amber-500/15 text-amber-700 border-l-2 border-amber-500",
};

function getContactTypeFromSummary(summary: string): ContactType {
  const lower = summary.toLowerCase();
  if (lower.includes("[call]") || lower.includes("[اتصال]")) return "call";
  if (lower.includes("[follow-up]") || lower.includes("[متابعة]")) return "follow_up";
  return "meeting";
}

function buildSummaryWithType(summary: string, contactType: ContactType, isRTL: boolean): string {
  // Remove existing type tags
  let clean = summary.replace(/\[(meeting|call|follow-up|اجتماع|اتصال|متابعة)\]\s*/gi, "").trim();
  const tags: Record<ContactType, string> = {
    meeting: isRTL ? "[اجتماع]" : "[Meeting]",
    call: isRTL ? "[اتصال]" : "[Call]",
    follow_up: isRTL ? "[متابعة]" : "[Follow-up]",
  };
  return `${tags[contactType]} ${clean}`;
}

export default function AMCalendarPage() {
  const { t, lang, isRTL } = useLanguage();
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<EventForm>(defaultForm);

  // Fetch clients for the dropdown
  const { data: clientsData } = trpc.accountManagement.listClients.useQuery({
    limit: 500,
    offset: 0,
  });

  // Fetch events for the current month view (with buffer)
  const timeMin = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }).toISOString();
  const timeMax = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }).toISOString();

  const { data: events, isLoading, refetch } = trpc.calendar.list.useQuery({
    timeMin,
    timeMax,
    maxResults: 100,
  });

  const createEvent = trpc.calendar.create.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم إنشاء الموعد بنجاح" : "Appointment created successfully");
      setShowCreateDialog(false);
      setForm(defaultForm);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateEvent = trpc.calendar.update.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم تحديث الموعد" : "Appointment updated");
      setShowEventDialog(false);
      setEditMode(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteEvent = trpc.calendar.delete.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم حذف الموعد" : "Appointment deleted");
      setShowEventDialog(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // Calendar grid computation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    const days: Date[] = [];
    let day = calStart;
    while (day <= calEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    if (!events) return map;
    events.forEach((event: any) => {
      const dateStr = event.start ? event.start.split("T")[0] : "";
      if (dateStr) {
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(event);
      }
    });
    return map;
  }, [events]);

  const weekDays = isRTL
    ? ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handleCreateSubmit = () => {
    if (!form.summary.trim()) {
      toast.error(isRTL ? "يرجى إدخال عنوان الموعد" : "Please enter an appointment title");
      return;
    }

    const startDateTime = `${form.startDate}T${form.startTime}:00+03:00`;
    const endDateTime = `${form.endDate}T${form.endTime}:00+03:00`;

    const attendeesList = form.attendees
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    const summaryWithType = buildSummaryWithType(form.summary, form.contactType, isRTL);

    createEvent.mutate({
      summary: summaryWithType,
      description: form.description || undefined,
      location: form.location || undefined,
      startDateTime,
      endDateTime,
      attendees: attendeesList.length > 0 ? attendeesList : undefined,
      leadId: form.clientId ? Number(form.clientId) : undefined,
      leadName: form.clientName || undefined,
    });
  };

  const handleUpdateSubmit = () => {
    if (!selectedEvent) return;

    const startDateTime = `${form.startDate}T${form.startTime}:00+03:00`;
    const endDateTime = `${form.endDate}T${form.endTime}:00+03:00`;

    const attendeesList = form.attendees
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    const summaryWithType = buildSummaryWithType(form.summary, form.contactType, isRTL);

    updateEvent.mutate({
      eventId: selectedEvent.id,
      summary: summaryWithType,
      description: form.description || undefined,
      location: form.location || undefined,
      startDateTime,
      endDateTime,
      attendees: attendeesList.length > 0 ? attendeesList : undefined,
    });
  };

  const handleDeleteEvent = () => {
    if (!selectedEvent) return;
    if (confirm(isRTL ? "هل أنت متأكد من حذف هذا الموعد؟" : "Are you sure you want to delete this appointment?")) {
      deleteEvent.mutate({ eventId: selectedEvent.id });
    }
  };

  const openEventDetail = (event: any) => {
    setSelectedEvent(event);
    setEditMode(false);

    const startDT = event.start ? parseISO(event.start) : new Date();
    const endDT = event.end ? parseISO(event.end) : addHours(startDT, 1);
    const contactType = getContactTypeFromSummary(event.summary || "");
    const cleanSummary = (event.summary || "").replace(/\[(meeting|call|follow-up|اجتماع|اتصال|متابعة)\]\s*/gi, "").trim();

    setForm({
      summary: cleanSummary,
      description: event.description || "",
      location: event.location || "",
      startDate: format(startDT, "yyyy-MM-dd"),
      startTime: format(startDT, "HH:mm"),
      endDate: format(endDT, "yyyy-MM-dd"),
      endTime: format(endDT, "HH:mm"),
      attendees: event.attendees?.map((a: any) => a.email).join(", ") || "",
      clientId: "",
      clientName: "",
      contactType,
    });

    setShowEventDialog(true);
  };

  const openCreateForDate = (date: Date) => {
    setForm({
      ...defaultForm,
      startDate: format(date, "yyyy-MM-dd"),
      endDate: format(date, "yyyy-MM-dd"),
    });
    setShowCreateDialog(true);
  };

  const formatEventTime = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), "HH:mm");
    } catch {
      return "";
    }
  };

  const getEventColor = (summary: string) => {
    const type = getContactTypeFromSummary(summary);
    return eventColors[type];
  };

  return (
    <CRMLayout>
      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRTL ? "تقويم إدارة الحسابات" : "Account Management Calendar"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isRTL ? "إدارة مواعيد التواصل مع العملاء - اجتماعات، اتصالات، ومتابعات" : "Manage client appointments - meetings, calls, and follow-ups"}
            </p>
          </div>
          <Button onClick={() => { setForm(defaultForm); setShowCreateDialog(true); }} className="gap-2">
            <Plus size={16} />
            {isRTL ? "موعد جديد" : "New Appointment"}
          </Button>
        </div>

        {/* Contact Type Legend */}
        <div className="flex flex-wrap gap-3">
          {(Object.entries(contactTypeLabels) as [ContactType, typeof contactTypeLabels.meeting][]).map(([key, val]) => {
            const Icon = val.icon;
            return (
              <div key={key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${val.color}`}>
                <Icon size={12} />
                {isRTL ? val.ar : val.en}
              </div>
            );
          })}
        </div>

        {/* Calendar Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                {isRTL ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </Button>
              <CardTitle className="text-lg">
                {format(currentMonth, "MMMM yyyy", { locale: isRTL ? ar : undefined })}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                {isRTL ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-2 md:p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-muted-foreground" size={32} />
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {/* Week day headers */}
                {weekDays.map((day) => (
                  <div key={day} className="bg-muted px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
                    {day}
                  </div>
                ))}

                {/* Calendar days */}
                {calendarDays.map((day, idx) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDate[dateStr] || [];
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={idx}
                      className={`bg-card min-h-[80px] md:min-h-[100px] p-1 cursor-pointer hover:bg-accent/30 transition-colors ${
                        !isCurrentMonth ? "opacity-40" : ""
                      }`}
                      onClick={() => openCreateForDate(day)}
                    >
                      <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? "bg-primary text-primary-foreground" : ""
                      }`}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((event: any, eIdx: number) => (
                          <div
                            key={eIdx}
                            className={`text-[10px] md:text-xs rounded px-1 py-0.5 truncate cursor-pointer hover:opacity-80 transition-opacity ${getEventColor(event.summary || "")}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEventDetail(event);
                            }}
                            title={event.summary}
                          >
                            <span className="font-medium">{formatEventTime(event.start)}</span>{" "}
                            {(event.summary || "").replace(/\[(meeting|call|follow-up|اجتماع|اتصال|متابعة)\]\s*/gi, "")}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-muted-foreground text-center">
                            +{dayEvents.length - 3} {isRTL ? "أكثر" : "more"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Appointments List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isRTL ? "المواعيد القادمة" : "Upcoming Appointments"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events && events.filter((e: any) => new Date(e.start) >= new Date()).length > 0 ? (
              <div className="space-y-2">
                {events
                  .filter((e: any) => new Date(e.start) >= new Date())
                  .slice(0, 10)
                  .map((event: any) => {
                    const contactType = getContactTypeFromSummary(event.summary || "");
                    const typeInfo = contactTypeLabels[contactType];
                    const TypeIcon = typeInfo.icon;
                    const cleanSummary = (event.summary || "").replace(/\[(meeting|call|follow-up|اجتماع|اتصال|متابعة)\]\s*/gi, "");

                    return (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/30 cursor-pointer transition-colors"
                        onClick={() => openEventDetail(event)}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${typeInfo.color}`}>
                          <TypeIcon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{cleanSummary}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${typeInfo.color}`}>
                              {isRTL ? typeInfo.ar : typeInfo.en}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock size={12} />
                            <span>
                              {event.start ? format(parseISO(event.start), "MMM d, HH:mm", { locale: isRTL ? ar : undefined }) : ""}
                              {" - "}
                              {event.end ? format(parseISO(event.end), "HH:mm") : ""}
                            </span>
                            {event.location && (
                              <>
                                <MapPin size={12} />
                                <span className="truncate">{event.location}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {event.htmlLink && (
                          <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">{isRTL ? "لا توجد مواعيد قادمة" : "No upcoming appointments"}</p>
                <Button variant="link" size="sm" onClick={() => { setForm(defaultForm); setShowCreateDialog(true); }}>
                  {isRTL ? "إنشاء موعد جديد" : "Create a new appointment"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Appointment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isRTL ? "موعد جديد" : "New Appointment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Contact Type Selector */}
            <div>
              <Label>{isRTL ? "نوع التواصل" : "Contact Type"} *</Label>
              <div className="flex gap-2 mt-1.5">
                {(Object.entries(contactTypeLabels) as [ContactType, typeof contactTypeLabels.meeting][]).map(([key, val]) => {
                  const Icon = val.icon;
                  const isSelected = form.contactType === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, contactType: key as ContactType })}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                        isSelected
                          ? `${val.color} ring-2 ring-offset-1 ring-current`
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon size={14} />
                      {isRTL ? val.ar : val.en}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>{isRTL ? "العنوان" : "Title"} *</Label>
              <Input
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder={isRTL ? "مثال: متابعة مع العميل أحمد" : "e.g. Follow-up with client Ahmed"}
              />
            </div>

            {/* Client Selector */}
            <div>
              <Label>{isRTL ? "العميل" : "Client"}</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.clientId}
                onChange={(e) => {
                  const selectedClient = clientsData?.clients?.find((c: any) => String(c.id) === e.target.value);
                  setForm({
                    ...form,
                    clientId: e.target.value,
                    clientName: selectedClient?.companyName || selectedClient?.contactName || "",
                  });
                }}
              >
                <option value="">{isRTL ? "اختر عميل (اختياري)" : "Select client (optional)"}</option>
                {clientsData?.clients?.map((client: any) => (
                  <option key={client.id} value={String(client.id)}>
                    {client.companyName || client.contactName} {client.contactName ? `- ${client.contactName}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isRTL ? "تاريخ البداية" : "Start Date"}</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: e.target.value })}
                />
              </div>
              <div>
                <Label>{isRTL ? "وقت البداية" : "Start Time"}</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isRTL ? "تاريخ النهاية" : "End Date"}</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
              <div>
                <Label>{isRTL ? "وقت النهاية" : "End Time"}</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>{isRTL ? "الموقع" : "Location"}</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder={isRTL ? "مثال: مكتب الشركة / أونلاين" : "e.g. Office / Online"}
              />
            </div>
            <div>
              <Label>{isRTL ? "الوصف" : "Description"}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={isRTL ? "تفاصيل إضافية عن الموعد..." : "Additional appointment details..."}
                rows={3}
              />
            </div>
            <div>
              <Label>{isRTL ? "المدعوون (بريد إلكتروني)" : "Attendees (email)"}</Label>
              <Input
                value={form.attendees}
                onChange={(e) => setForm({ ...form, attendees: e.target.value })}
                placeholder="email1@example.com, email2@example.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? "افصل بين الإيميلات بفاصلة" : "Separate emails with commas"}
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={handleCreateSubmit} disabled={createEvent.isPending}>
                {createEvent.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
                {isRTL ? "إنشاء الموعد" : "Create Appointment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Detail / Edit Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editMode
                ? (isRTL ? "تعديل الموعد" : "Edit Appointment")
                : (isRTL ? "تفاصيل الموعد" : "Appointment Details")}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              {editMode ? (
                <>
                  {/* Contact Type Selector */}
                  <div>
                    <Label>{isRTL ? "نوع التواصل" : "Contact Type"}</Label>
                    <div className="flex gap-2 mt-1.5">
                      {(Object.entries(contactTypeLabels) as [ContactType, typeof contactTypeLabels.meeting][]).map(([key, val]) => {
                        const Icon = val.icon;
                        const isSelected = form.contactType === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setForm({ ...form, contactType: key as ContactType })}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                              isSelected
                                ? `${val.color} ring-2 ring-offset-1 ring-current`
                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <Icon size={14} />
                            {isRTL ? val.ar : val.en}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <Label>{isRTL ? "العنوان" : "Title"}</Label>
                    <Input
                      value={form.summary}
                      onChange={(e) => setForm({ ...form, summary: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{isRTL ? "تاريخ البداية" : "Start Date"}</Label>
                      <Input
                        type="date"
                        value={form.startDate}
                        onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>{isRTL ? "وقت البداية" : "Start Time"}</Label>
                      <Input
                        type="time"
                        value={form.startTime}
                        onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{isRTL ? "تاريخ النهاية" : "End Date"}</Label>
                      <Input
                        type="date"
                        value={form.endDate}
                        onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>{isRTL ? "وقت النهاية" : "End Time"}</Label>
                      <Input
                        type="time"
                        value={form.endTime}
                        onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>{isRTL ? "الموقع" : "Location"}</Label>
                    <Input
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>{isRTL ? "الوصف" : "Description"}</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>{isRTL ? "المدعوون" : "Attendees"}</Label>
                    <Input
                      value={form.attendees}
                      onChange={(e) => setForm({ ...form, attendees: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <Button variant="outline" onClick={() => setEditMode(false)}>
                      {isRTL ? "إلغاء" : "Cancel"}
                    </Button>
                    <Button onClick={handleUpdateSubmit} disabled={updateEvent.isPending}>
                      {updateEvent.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
                      {isRTL ? "حفظ التغييرات" : "Save Changes"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <div>
                      {(() => {
                        const contactType = getContactTypeFromSummary(selectedEvent.summary || "");
                        const typeInfo = contactTypeLabels[contactType];
                        const TypeIcon = typeInfo.icon;
                        const cleanSummary = (selectedEvent.summary || "").replace(/\[(meeting|call|follow-up|اجتماع|اتصال|متابعة)\]\s*/gi, "");
                        return (
                          <>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${typeInfo.color}`}>
                                <TypeIcon size={12} />
                                {isRTL ? typeInfo.ar : typeInfo.en}
                              </span>
                            </div>
                            <h3 className="font-semibold text-lg">{cleanSummary}</h3>
                          </>
                        );
                      })()}
                      {selectedEvent.status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          selectedEvent.status === "confirmed"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {selectedEvent.status === "confirmed"
                            ? (isRTL ? "مؤكد" : "Confirmed")
                            : selectedEvent.status}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock size={14} />
                      <span>
                        {selectedEvent.start
                          ? format(parseISO(selectedEvent.start), "EEEE, MMM d, yyyy HH:mm", { locale: isRTL ? ar : undefined })
                          : ""}
                        {" - "}
                        {selectedEvent.end ? format(parseISO(selectedEvent.end), "HH:mm") : ""}
                      </span>
                    </div>

                    {selectedEvent.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin size={14} />
                        <span>{selectedEvent.location}</span>
                      </div>
                    )}

                    {selectedEvent.description && (
                      <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                        {selectedEvent.description}
                      </div>
                    )}

                    {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium mb-1">
                          <Users size={14} />
                          {isRTL ? "المدعوون" : "Attendees"}
                        </div>
                        <div className="space-y-1">
                          {selectedEvent.attendees.map((a: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className={`w-2 h-2 rounded-full ${
                                a.responseStatus === "accepted" ? "bg-green-500" :
                                a.responseStatus === "declined" ? "bg-red-500" :
                                "bg-yellow-500"
                              }`} />
                              <span>{a.email}</span>
                              <span className="text-xs opacity-60">
                                ({a.responseStatus === "accepted" ? (isRTL ? "قبل" : "Accepted") :
                                  a.responseStatus === "declined" ? (isRTL ? "رفض" : "Declined") :
                                  (isRTL ? "في الانتظار" : "Pending")})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedEvent.htmlLink && (
                      <a
                        href={selectedEvent.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <ExternalLink size={14} />
                        {isRTL ? "فتح في Google Calendar" : "Open in Google Calendar"}
                      </a>
                    )}
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={() => setEditMode(true)} className="gap-1">
                      <Edit size={14} />
                      {isRTL ? "تعديل" : "Edit"}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteEvent}
                      disabled={deleteEvent.isPending}
                      className="gap-1"
                    >
                      {deleteEvent.isPending ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                      {isRTL ? "حذف" : "Delete"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </CRMLayout>
  );
}
