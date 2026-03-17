import CRMLayout from "@/components/CRMLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
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

const EVENT_COLORS = [
  "bg-violet-100 text-violet-700 border-violet-200",
  "bg-blue-100 text-blue-700 border-blue-200",
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-rose-100 text-rose-700 border-rose-200",
];

export default function CalendarPage() {
  const { t, lang, isRTL } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<EventForm>(defaultForm);

  const timeMin = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }).toISOString();
  const timeMax = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }).toISOString();

  const { data: events, isLoading, refetch } = trpc.calendar.list.useQuery({ timeMin, timeMax, maxResults: 100 });

  const createEvent = trpc.calendar.create.useMutation({
    onSuccess: () => { toast.success(isRTL ? "تم إنشاء الاجتماع بنجاح" : "Meeting created successfully"); setShowCreateDialog(false); setForm(defaultForm); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updateEvent = trpc.calendar.update.useMutation({
    onSuccess: () => { toast.success(isRTL ? "تم تحديث الاجتماع" : "Meeting updated"); setShowEventDialog(false); setEditMode(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteEvent = trpc.calendar.delete.useMutation({
    onSuccess: () => { toast.success(isRTL ? "تم حذف الاجتماع" : "Meeting deleted"); setShowEventDialog(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    let day = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    while (day <= end) { days.push(day); day = addDays(day, 1); }
    return days;
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    if (!events) return map;
    events.forEach((event: any) => {
      const dateStr = event.start?.split("T")[0];
      if (dateStr) { if (!map[dateStr]) map[dateStr] = []; map[dateStr].push(event); }
    });
    return map;
  }, [events]);

  const weekDays = isRTL
    ? ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handleCreateSubmit = () => {
    if (!form.summary.trim()) { toast.error(isRTL ? "يرجى إدخال عنوان الاجتماع" : "Please enter a meeting title"); return; }
    const attendeesList = form.attendees.split(",").map((e) => e.trim()).filter((e) => e.includes("@"));
    createEvent.mutate({
      summary: form.summary,
      description: form.description || undefined,
      location: form.location || undefined,
      startDateTime: `${form.startDate}T${form.startTime}:00+03:00`,
      endDateTime: `${form.endDate}T${form.endTime}:00+03:00`,
      attendees: attendeesList.length > 0 ? attendeesList : undefined,
      leadId: form.leadId ? Number(form.leadId) : undefined,
      leadName: form.leadName || undefined,
    });
  };

  const handleUpdateSubmit = () => {
    if (!selectedEvent) return;
    const attendeesList = form.attendees.split(",").map((e) => e.trim()).filter((e) => e.includes("@"));
    updateEvent.mutate({
      eventId: selectedEvent.id,
      summary: form.summary,
      description: form.description || undefined,
      location: form.location || undefined,
      startDateTime: `${form.startDate}T${form.startTime}:00+03:00`,
      endDateTime: `${form.endDate}T${form.endTime}:00+03:00`,
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
    setForm({ ...defaultForm, startDate: format(date, "yyyy-MM-dd"), endDate: format(date, "yyyy-MM-dd") });
    setShowCreateDialog(true);
  };

  const formatEventTime = (dateStr: string) => {
    try { return format(parseISO(dateStr), "HH:mm"); } catch { return ""; }
  };

  const upcomingEvents = (events ?? []).filter((e: any) => new Date(e.start) >= new Date()).slice(0, 8);

  const FormFields = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">{isRTL ? "عنوان الاجتماع" : "Meeting Title"} *</Label>
        <Input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder={isRTL ? "مثال: اجتماع مع العميل أحمد" : "e.g. Meeting with client Ahmed"} className="rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">{isRTL ? "تاريخ البداية" : "Start Date"}</Label>
          <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: e.target.value })} className="rounded-xl" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">{isRTL ? "وقت البداية" : "Start Time"}</Label>
          <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">{isRTL ? "تاريخ النهاية" : "End Date"}</Label>
          <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="rounded-xl" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">{isRTL ? "وقت النهاية" : "End Time"}</Label>
          <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="rounded-xl" />
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">{isRTL ? "الموقع" : "Location"}</Label>
        <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={isRTL ? "مثال: مكتب الشركة" : "e.g. Office"} className="rounded-xl" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">{isRTL ? "الوصف" : "Description"}</Label>
        <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={isRTL ? "تفاصيل إضافية..." : "Additional details..."} rows={3} className="rounded-xl resize-none" />
      </div>
      <div>
        <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">{isRTL ? "المدعوون (بريد إلكتروني)" : "Attendees (email)"}</Label>
        <Input value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} placeholder="email1@example.com, email2@example.com" className="rounded-xl" />
        <p className="text-xs text-slate-400 mt-1">{isRTL ? "افصل بين الإيميلات بفاصلة" : "Separate emails with commas"}</p>
      </div>
      {!isEdit && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">{isRTL ? "رقم العميل (اختياري)" : "Lead ID (optional)"}</Label>
            <Input type="number" value={form.leadId} onChange={(e) => setForm({ ...form, leadId: e.target.value })} placeholder="123" className="rounded-xl" />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600 mb-1.5 block">{isRTL ? "اسم العميل (اختياري)" : "Lead Name (optional)"}</Label>
            <Input value={form.leadName} onChange={(e) => setForm({ ...form, leadName: e.target.value })} placeholder={isRTL ? "أحمد محمد" : "Ahmed Mohamed"} className="rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <CRMLayout>
      <div className="p-4 md:p-6 space-y-5 fade-in" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 p-2.5 shadow-md">
              <CalendarIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">{isRTL ? "التقويم" : "Calendar"}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{isRTL ? "إدارة الاجتماعات والمواعيد" : "Manage meetings and appointments"}</p>
            </div>
          </div>
          <Button
            onClick={() => { setForm(defaultForm); setShowCreateDialog(true); }}
            className="gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-md shadow-violet-200"
          >
            <Plus size={16} />
            {isRTL ? "اجتماع جديد" : "New Meeting"}
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
          {/* Calendar Grid */}
          <div className="xl:col-span-3 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            {/* Month navigation */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="rounded-xl p-2 hover:bg-slate-100 transition-colors"
              >
                {isRTL ? <ChevronRight size={18} className="text-slate-600" /> : <ChevronLeft size={18} className="text-slate-600" />}
              </button>
              <h2 className="text-base font-bold text-slate-800">
                {format(currentMonth, "MMMM yyyy", { locale: isRTL ? ar : undefined })}
              </h2>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="rounded-xl p-2 hover:bg-slate-100 transition-colors"
              >
                {isRTL ? <ChevronLeft size={18} className="text-slate-600" /> : <ChevronRight size={18} className="text-slate-600" />}
              </button>
            </div>

            {/* Week day headers */}
            <div className="grid grid-cols-7 border-b border-slate-100">
              {weekDays.map((day) => (
                <div key={day} className="py-2.5 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin text-violet-400" size={32} />
              </div>
            ) : (
              <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
                {calendarDays.map((day, idx) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDate[dateStr] || [];
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={idx}
                      className={`min-h-[90px] p-1.5 cursor-pointer transition-colors group ${
                        !isCurrentMonth ? "bg-slate-50/50" : "hover:bg-violet-50/30"
                      }`}
                      onClick={() => openCreateForDate(day)}
                    >
                      <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                        isToday
                          ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm"
                          : isCurrentMonth
                          ? "text-slate-700 group-hover:bg-violet-100 group-hover:text-violet-700"
                          : "text-slate-300"
                      }`}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((event: any, eIdx: number) => (
                          <div
                            key={eIdx}
                            className={`text-[10px] rounded-md px-1.5 py-0.5 truncate cursor-pointer border transition-opacity hover:opacity-80 ${EVENT_COLORS[eIdx % EVENT_COLORS.length]}`}
                            onClick={(e) => { e.stopPropagation(); openEventDetail(event); }}
                            title={event.summary}
                          >
                            <span className="font-semibold">{formatEventTime(event.start)}</span>{" "}
                            {event.summary}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-violet-500 font-medium px-1">
                            +{dayEvents.length - 2} {isRTL ? "أكثر" : "more"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Events Sidebar */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-100">
              <div className="rounded-lg bg-violet-50 p-1.5">
                <Clock className="h-4 w-4 text-violet-600" />
              </div>
              <h2 className="text-sm font-semibold text-slate-800">
                {isRTL ? "الاجتماعات القادمة" : "Upcoming"}
              </h2>
            </div>
            <div className="p-3 space-y-2 overflow-y-auto max-h-[500px]">
              {upcomingEvents.length > 0 ? upcomingEvents.map((event: any, idx: number) => (
                <div
                  key={event.id}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-100 group"
                  onClick={() => openEventDetail(event)}
                >
                  <div className={`rounded-lg p-1.5 shrink-0 ${EVENT_COLORS[idx % EVENT_COLORS.length].split(" ").slice(0, 1).join(" ")}`}>
                    <CalendarIcon size={14} className={EVENT_COLORS[idx % EVENT_COLORS.length].split(" ")[1]} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{event.summary}</p>
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400">
                      <Clock size={9} />
                      <span>
                        {event.start ? format(parseISO(event.start), "MMM d, HH:mm", { locale: isRTL ? ar : undefined }) : ""}
                      </span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400">
                        <MapPin size={9} />
                        <span className="truncate">{event.location}</span>
                      </div>
                    )}
                  </div>
                  {event.htmlLink && (
                    <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-slate-300 hover:text-violet-500 transition-colors shrink-0">
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )) : (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <CalendarIcon size={22} className="text-slate-300" />
                  </div>
                  <p className="text-xs text-slate-400 font-medium">{isRTL ? "لا توجد اجتماعات قادمة" : "No upcoming meetings"}</p>
                  <button
                    onClick={() => { setForm(defaultForm); setShowCreateDialog(true); }}
                    className="mt-2 text-xs text-violet-500 hover:text-violet-700 font-medium"
                  >
                    {isRTL ? "+ إنشاء اجتماع" : "+ Create meeting"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Meeting Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-lg bg-violet-50 p-1.5">
                <Plus className="h-4 w-4 text-violet-600" />
              </div>
              {isRTL ? "اجتماع جديد" : "New Meeting"}
            </DialogTitle>
          </DialogHeader>
          <FormFields />
          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="rounded-xl">
              {isRTL ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={createEvent.isPending}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              {createEvent.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
              {isRTL ? "إنشاء الاجتماع" : "Create Meeting"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Detail / Edit Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="rounded-lg bg-violet-50 p-1.5">
                <CalendarIcon className="h-4 w-4 text-violet-600" />
              </div>
              {editMode ? (isRTL ? "تعديل الاجتماع" : "Edit Meeting") : (isRTL ? "تفاصيل الاجتماع" : "Meeting Details")}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              {editMode ? (
                <>
                  <FormFields isEdit />
                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                    <Button variant="outline" onClick={() => setEditMode(false)} className="rounded-xl">{isRTL ? "إلغاء" : "Cancel"}</Button>
                    <Button onClick={handleUpdateSubmit} disabled={updateEvent.isPending} className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                      {updateEvent.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
                      {isRTL ? "حفظ التغييرات" : "Save Changes"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold text-lg text-slate-800">{selectedEvent.summary}</h3>
                      {selectedEvent.status && (
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
                          selectedEvent.status === "confirmed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {selectedEvent.status === "confirmed" ? (isRTL ? "مؤكد" : "Confirmed") : selectedEvent.status}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="rounded-lg bg-violet-100 p-1.5 shrink-0">
                        <Clock size={14} className="text-violet-600" />
                      </div>
                      <span className="text-sm text-slate-600">
                        {selectedEvent.start ? format(parseISO(selectedEvent.start), "EEEE, MMM d, yyyy HH:mm", { locale: isRTL ? ar : undefined }) : ""}
                        {" — "}
                        {selectedEvent.end ? format(parseISO(selectedEvent.end), "HH:mm") : ""}
                      </span>
                    </div>

                    {selectedEvent.location && (
                      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="rounded-lg bg-emerald-100 p-1.5 shrink-0">
                          <MapPin size={14} className="text-emerald-600" />
                        </div>
                        <span className="text-sm text-slate-600">{selectedEvent.location}</span>
                      </div>
                    )}

                    {selectedEvent.description && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-600 whitespace-pre-wrap">
                        {selectedEvent.description}
                      </div>
                    )}

                    {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 mb-2">
                          <Users size={13} />
                          {isRTL ? "المدعوون" : "Attendees"}
                        </div>
                        <div className="space-y-1.5">
                          {selectedEvent.attendees.map((a: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-slate-500">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                a.responseStatus === "accepted" ? "bg-emerald-500" :
                                a.responseStatus === "declined" ? "bg-red-500" : "bg-amber-500"
                              }`} />
                              <span>{a.email}</span>
                              <span className="text-slate-400">
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
                      <a href={selectedEvent.htmlLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 font-medium">
                        <ExternalLink size={13} />
                        {isRTL ? "فتح في Google Calendar" : "Open in Google Calendar"}
                      </a>
                    )}
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                    <Button variant="outline" size="sm" onClick={() => setEditMode(true)} className="gap-1.5 rounded-xl">
                      <Edit size={13} /> {isRTL ? "تعديل" : "Edit"}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleDeleteEvent} disabled={deleteEvent.isPending} className="gap-1.5 rounded-xl">
                      {deleteEvent.isPending ? <Loader2 className="animate-spin" size={13} /> : <Trash2 size={13} />}
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
