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
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

interface EventForm {
  summary: string;
  description: string;
  location: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  attendees: string;
  leadId: string;
  leadName: string;
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
  leadId: "",
  leadName: "",
};

export default function CalendarPage() {
  const { t, lang, isRTL } = useLanguage();
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<EventForm>(defaultForm);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Fetch events for the current month view (with buffer)
  const timeMin = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }).toISOString();
  const timeMax = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }).toISOString();

  const { data: events, isLoading, refetch } = trpc.calendar.list.useQuery({
    timeMin,
    timeMax,
    maxResults: 100,
  });

  const createEvent = trpc.calendar.create.useMutation({
    onSuccess: (data) => {
      toast.success(isRTL ? "تم إنشاء الاجتماع بنجاح" : "Meeting created successfully");
      setShowCreateDialog(false);
      setForm(defaultForm);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateEvent = trpc.calendar.update.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم تحديث الاجتماع" : "Meeting updated");
      setShowEventDialog(false);
      setEditMode(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteEvent = trpc.calendar.delete.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم حذف الاجتماع" : "Meeting deleted");
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
      toast.error(isRTL ? "يرجى إدخال عنوان الاجتماع" : "Please enter a meeting title");
      return;
    }

    const startDateTime = `${form.startDate}T${form.startTime}:00+03:00`;
    const endDateTime = `${form.endDate}T${form.endTime}:00+03:00`;

    const attendeesList = form.attendees
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    createEvent.mutate({
      summary: form.summary,
      description: form.description || undefined,
      location: form.location || undefined,
      startDateTime,
      endDateTime,
      attendees: attendeesList.length > 0 ? attendeesList : undefined,
      leadId: form.leadId ? Number(form.leadId) : undefined,
      leadName: form.leadName || undefined,
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

    updateEvent.mutate({
      eventId: selectedEvent.id,
      summary: form.summary,
      description: form.description || undefined,
      location: form.location || undefined,
      startDateTime,
      endDateTime,
      attendees: attendeesList.length > 0 ? attendeesList : undefined,
    });
  };

  const handleDeleteEvent = () => {
    if (!selectedEvent) return;
    if (confirm(isRTL ? "هل أنت متأكد من حذف هذا الاجتماع؟" : "Are you sure you want to delete this meeting?")) {
      deleteEvent.mutate({ eventId: selectedEvent.id });
    }
  };

  const openEventDetail = (event: any) => {
    setSelectedEvent(event);
    setEditMode(false);

    const startDT = event.start ? parseISO(event.start) : new Date();
    const endDT = event.end ? parseISO(event.end) : addHours(startDT, 1);

    setForm({
      summary: event.summary || "",
      description: event.description || "",
      location: event.location || "",
      startDate: format(startDT, "yyyy-MM-dd"),
      startTime: format(startDT, "HH:mm"),
      endDate: format(endDT, "yyyy-MM-dd"),
      endTime: format(endDT, "HH:mm"),
      attendees: event.attendees?.map((a: any) => a.email).join(", ") || "",
      leadId: "",
      leadName: "",
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

  return (
    <CRMLayout>
      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isRTL ? "التقويم" : "Calendar"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isRTL ? "إدارة الاجتماعات والمواعيد" : "Manage meetings and appointments"}
            </p>
          </div>
          <Button onClick={() => { setForm(defaultForm); setShowCreateDialog(true); }} className="gap-2">
            <Plus size={16} />
            {isRTL ? "اجتماع جديد" : "New Meeting"}
          </Button>
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
                        isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                      }`}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((event: any, eIdx: number) => (
                          <div
                            key={eIdx}
                            className="text-[10px] md:text-xs bg-primary/10 text-primary rounded px-1 py-0.5 truncate cursor-pointer hover:bg-primary/20 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEventDetail(event);
                            }}
                            title={event.summary}
                          >
                            <span className="font-medium">{formatEventTime(event.start)}</span>{" "}
                            {event.summary}
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

        {/* Upcoming Events List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isRTL ? "الاجتماعات القادمة" : "Upcoming Meetings"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {events && events.filter((e: any) => new Date(e.start) >= new Date()).length > 0 ? (
              <div className="space-y-2">
                {events
                  .filter((e: any) => new Date(e.start) >= new Date())
                  .slice(0, 10)
                  .map((event: any) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/30 cursor-pointer transition-colors"
                      onClick={() => openEventDetail(event)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <CalendarIcon size={18} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{event.summary}</p>
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
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon size={40} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">{isRTL ? "لا توجد اجتماعات قادمة" : "No upcoming meetings"}</p>
                <Button variant="link" size="sm" onClick={() => { setForm(defaultForm); setShowCreateDialog(true); }}>
                  {isRTL ? "إنشاء اجتماع جديد" : "Create a new meeting"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Meeting Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isRTL ? "اجتماع جديد" : "New Meeting"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isRTL ? "عنوان الاجتماع" : "Meeting Title"} *</Label>
              <Input
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder={isRTL ? "مثال: اجتماع مع العميل أحمد" : "e.g. Meeting with client Ahmed"}
              />
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
                placeholder={isRTL ? "مثال: مكتب الشركة" : "e.g. Office"}
              />
            </div>
            <div>
              <Label>{isRTL ? "الوصف" : "Description"}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={isRTL ? "تفاصيل إضافية عن الاجتماع..." : "Additional meeting details..."}
                rows={3}
              />
            </div>
            <div>
              <Label>{isRTL ? "المدعوون (بريد إلكتروني)" : "Attendees (email)"}</Label>
              <Input
                value={form.attendees}
                onChange={(e) => setForm({ ...form, attendees: e.target.value })}
                placeholder={isRTL ? "email1@example.com, email2@example.com" : "email1@example.com, email2@example.com"}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isRTL ? "افصل بين الإيميلات بفاصلة" : "Separate emails with commas"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{isRTL ? "رقم العميل (اختياري)" : "Lead ID (optional)"}</Label>
                <Input
                  type="number"
                  value={form.leadId}
                  onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                  placeholder="123"
                />
              </div>
              <div>
                <Label>{isRTL ? "اسم العميل (اختياري)" : "Lead Name (optional)"}</Label>
                <Input
                  value={form.leadName}
                  onChange={(e) => setForm({ ...form, leadName: e.target.value })}
                  placeholder={isRTL ? "أحمد محمد" : "Ahmed Mohamed"}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                {isRTL ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={handleCreateSubmit} disabled={createEvent.isPending}>
                {createEvent.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
                {isRTL ? "إنشاء الاجتماع" : "Create Meeting"}
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
                ? (isRTL ? "تعديل الاجتماع" : "Edit Meeting")
                : (isRTL ? "تفاصيل الاجتماع" : "Meeting Details")}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              {editMode ? (
                <>
                  <div>
                    <Label>{isRTL ? "عنوان الاجتماع" : "Meeting Title"}</Label>
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
                      <h3 className="font-semibold text-lg">{selectedEvent.summary}</h3>
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
