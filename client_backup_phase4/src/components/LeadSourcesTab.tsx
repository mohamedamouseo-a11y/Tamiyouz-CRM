import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus,
  Plug,
  PlugZap,
  Trash2,
  RefreshCw,
  Eye,
  Settings2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  TestTube2,
  Download,
  FileSpreadsheet,
  History,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface LeadSource {
  id: number;
  sourceName: string;
  status: string;
  isEnabled: boolean;
  sheetUrl: string | null;
  spreadsheetId: string | null;
  worksheetMode: string;
  worksheetName: string | null;
  syncFrequencyMinutes: number;
  uniqueKeyPriority: string;
  assignmentRule: string;
  fixedOwnerId: number | null;
  fieldMapping: Record<string, string> | null;
  lastSyncTime: string | null;
  lastSyncResult: string | null;
  lastSyncRowCount: number;
}

// ─── CRM Field Options ───────────────────────────────────────────────────────
const CRM_FIELDS = [
  { value: "externalId", label: "External ID (Meta Lead ID)" },
  { value: "name", label: "Full Name" },
  { value: "phone", label: "Phone" },
  { value: "country", label: "Country" },
  { value: "businessProfile", label: "Business Profile / Website" },
  { value: "leadQuality", label: "Lead Quality" },
  { value: "campaignName", label: "Campaign Name" },
  { value: "stage", label: "Stage / Status" },
  { value: "notes", label: "Sales Notes" },
  { value: "mediaBuyerNotes", label: "Media Buyer Notes" },
  { value: "leadTime", label: "Lead Time (created_time)" },
  { value: "_sourceMetadata.ad_name", label: "→ Source Metadata: Ad Name" },
  { value: "_sourceMetadata.adset_name", label: "→ Source Metadata: Adset Name" },
  { value: "_sourceMetadata.form_name", label: "→ Source Metadata: Form Name" },
  { value: "_sourceMetadata.platform", label: "→ Source Metadata: Platform" },
  { value: "_sourceMetadata.is_organic", label: "→ Source Metadata: Is Organic" },
  { value: "_ignore", label: "⊘ Ignore this column" },
];

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: any; icon: any; label: string }> = {
    Connected: { variant: "default", icon: <CheckCircle2 className="w-3 h-3" />, label: "Connected" },
    PermissionMissing: { variant: "destructive", icon: <XCircle className="w-3 h-3" />, label: "Permission Missing" },
    MappingError: { variant: "secondary", icon: <AlertTriangle className="w-3 h-3" />, label: "Mapping Error" },
    Disabled: { variant: "outline", icon: <XCircle className="w-3 h-3" />, label: "Disabled" },
  };
  const c = config[status] || config.Disabled;
  return (
    <Badge variant={c.variant} className="gap-1">
      {c.icon} {c.label}
    </Badge>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LeadSourcesTab() {
  const { t } = useLanguage();
  const utils = trpc.useUtils();

  // Queries
  const sourcesQuery = trpc.leadSources.list.useQuery();
  const usersQuery = trpc.users.list.useQuery();

  // Mutations
  const createMutation = trpc.leadSources.create.useMutation({
    onSuccess: () => { utils.leadSources.list.invalidate(); toast.success("Lead source created"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMutation = trpc.leadSources.update.useMutation({
    onSuccess: () => { utils.leadSources.list.invalidate(); toast.success("Updated"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.leadSources.delete.useMutation({
    onSuccess: () => { utils.leadSources.list.invalidate(); toast.success("Source removed"); },
    onError: (e) => toast.error(e.message),
  });
  const testConnectionMutation = trpc.leadSources.testConnection.useMutation();
  const syncNowMutation = trpc.leadSources.syncNow.useMutation({
    onSuccess: (data) => {
      utils.leadSources.list.invalidate();
      toast.success(`Sync complete: ${data.rowsImported} imported, ${data.rowsSkipped} skipped`);
    },
    onError: (e) => toast.error(e.message),
  });
  const dryRunMutation = trpc.leadSources.dryRun.useMutation({
    onSuccess: (data) => {
      toast.success(`Dry run: ${data.rowsImported} would be imported, ${data.rowsSkipped} would be skipped`);
    },
    onError: (e) => toast.error(e.message),
  });

  // State
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [selectedSource, setSelectedSource] = useState<LeadSource | null>(null);
  const [deleteSourceId, setDeleteSourceId] = useState<number | null>(null);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);

  // Add form state
  const [newSource, setNewSource] = useState({
    sourceName: "",
    sheetUrl: "",
    worksheetMode: "pick" as "pick" | "all",
    worksheetName: "",
    syncFrequencyMinutes: 5,
    uniqueKeyPriority: "meta_lead_id" as "meta_lead_id" | "phone",
    assignmentRule: "round_robin" as "round_robin" | "fixed_owner" | "by_campaign",
    fixedOwnerId: undefined as number | undefined,
  });

  // Test connection state
  const [worksheets, setWorksheets] = useState<Array<{ title: string; rowCount: number; gid?: string }>>([]);
  const [testResult, setTestResult] = useState<{ success: boolean; title?: string; error?: string } | null>(null);

  // Mapping state
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);

  // Preview state
  const [previewData, setPreviewData] = useState<{ headers: string[]; rows: Record<string, string>[]; totalRows: number } | null>(null);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleTestConnection = async () => {
    const url = newSource.sheetUrl || selectedSource?.sheetUrl;
    if (!url) { toast.error("Please enter a Google Sheet URL"); return; }
    setTestResult(null);
    const result = await testConnectionMutation.mutateAsync({ sheetUrl: url });
    setTestResult(result as any);
    if (result.success) {
      setWorksheets(result.worksheets);
      if (result.worksheets.length > 0 && !newSource.worksheetName) {
        setNewSource(prev => ({ ...prev, worksheetName: result.worksheets[0].title }));
      }
    }
  };

  const handleCreate = async () => {
    if (!newSource.sourceName) { toast.error("Source name is required"); return; }
    await createMutation.mutateAsync(newSource as any);
    setShowAddDialog(false);
    setNewSource({
      sourceName: "", sheetUrl: "", worksheetMode: "pick", worksheetName: "",
      syncFrequencyMinutes: 5, uniqueKeyPriority: "meta_lead_id",
      assignmentRule: "round_robin", fixedOwnerId: undefined,
    });
    setTestResult(null);
    setWorksheets([]);
  };

  const handleOpenMapping = async (source: LeadSource) => {
    setSelectedSource(source);
    if (source.spreadsheetId && source.worksheetName) {
      try {
        const preview = await utils.leadSources.preview.fetch({
          spreadsheetId: source.spreadsheetId,
          worksheetName: source.worksheetName,
          maxRows: 5,
        });
        if (preview.success) {
          setSheetHeaders(preview.headers);
          // Use existing mapping or suggest new one
          if (source.fieldMapping && Object.keys(source.fieldMapping).length > 0) {
            setFieldMapping(source.fieldMapping);
          } else {
            const suggested = await utils.leadSources.suggestMapping.fetch({ headers: preview.headers });
            setFieldMapping(suggested);
          }
        }
      } catch (e: any) {
        toast.error("Failed to fetch sheet headers: " + e.message);
      }
    }
    setShowMappingDialog(true);
  };

  const handleSaveMapping = async () => {
    if (!selectedSource) return;
    // Filter out _ignore mappings
    const cleanMapping: Record<string, string> = {};
    for (const [k, v] of Object.entries(fieldMapping)) {
      if (v !== "_ignore") cleanMapping[k] = v;
    }
    await updateMutation.mutateAsync({
      id: selectedSource.id,
      fieldMapping: cleanMapping,
      status: "Connected",
    });
    setShowMappingDialog(false);
  };

  const handlePreview = async (source: LeadSource) => {
    setSelectedSource(source);
    if (!source.spreadsheetId || !source.worksheetName) {
      toast.error("Sheet not configured"); return;
    }
    try {
      const data = await utils.leadSources.preview.fetch({
        spreadsheetId: source.spreadsheetId,
        worksheetName: source.worksheetName,
        maxRows: 10,
      });
      setPreviewData(data as any);
      setShowPreviewDialog(true);
    } catch (e: any) {
      toast.error("Preview failed: " + e.message);
    }
  };

  const handleToggleEnabled = async (source: LeadSource) => {
    await updateMutation.mutateAsync({
      id: source.id,
      isEnabled: !source.isEnabled,
      status: !source.isEnabled ? "Connected" : "Disabled",
    });
  };

  const handleViewLogs = async (source: LeadSource) => {
    setSelectedSource(source);
    try {
      const logs = await utils.leadSources.syncLogs.fetch({ sourceId: source.id, limit: 20 });
      setSyncLogs(logs);
      setShowLogsDialog(true);
    } catch (e: any) {
      toast.error("Failed to load sync logs: " + e.message);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  const sources = sourcesQuery.data ?? [];
  const usersList = usersQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Lead Sources (Integrations)</h3>
          <p className="text-sm text-muted-foreground">
            Connect Google Sheets to auto-import leads from Meta Lead Gen and other sources.
            Sheets must be shared as "Anyone with the link".
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Lead Source
        </Button>
      </div>

      {/* Sources List */}
      {sources.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h4 className="text-lg font-medium mb-2">No Lead Sources</h4>
            <p className="text-muted-foreground mb-4">
              Add a Google Sheet source to start importing leads automatically.
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Lead Source
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sources.map((source: LeadSource) => (
            <Card key={source.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{source.sourceName}</CardTitle>
                    <StatusBadge status={source.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={source.isEnabled}
                      onCheckedChange={() => handleToggleEnabled(source)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {source.isEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-muted-foreground">Worksheet:</span>
                    <p className="font-medium">{source.worksheetName || "Not set"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sync Frequency:</span>
                    <p className="font-medium">Every {source.syncFrequencyMinutes} min</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Assignment:</span>
                    <p className="font-medium capitalize">{source.assignmentRule.replace(/_/g, " ")}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Sync:</span>
                    <p className="font-medium">
                      {source.lastSyncTime
                        ? new Date(source.lastSyncTime).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                </div>
                {source.lastSyncResult && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Last result: {source.lastSyncResult}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenMapping(source)}>
                    <Settings2 className="w-3 h-3 mr-1" /> Field Mapping
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handlePreview(source)}>
                    <Eye className="w-3 h-3 mr-1" /> Preview Data
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => dryRunMutation.mutate({ id: source.id })}
                    disabled={dryRunMutation.isPending}
                  >
                    <TestTube2 className="w-3 h-3 mr-1" /> Dry Run (5 rows)
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => syncNowMutation.mutate({ id: source.id })}
                    disabled={syncNowMutation.isPending}
                  >
                    {syncNowMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Play className="w-3 h-3 mr-1" />
                    )}
                    Sync Now
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleViewLogs(source)}>
                    <History className="w-3 h-3 mr-1" /> Sync Logs
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { setDeleteSourceId(source.id); setShowDeleteDialog(true); }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Add Lead Source Dialog ──────────────────────────────────────────── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Lead Source</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Source Name *</Label>
              <Input
                placeholder="e.g., Meta - Ramadan - Form A"
                value={newSource.sourceName}
                onChange={(e) => setNewSource(prev => ({ ...prev, sourceName: e.target.value }))}
              />
            </div>
            <div>
              <Label>Google Sheet URL</Label>
              <p className="text-xs text-muted-foreground mb-1">
                Sheet must be shared as "Anyone with the link" (Viewer or Editor)
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={newSource.sheetUrl}
                  onChange={(e) => setNewSource(prev => ({ ...prev, sheetUrl: e.target.value }))}
                />
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testConnectionMutation.isPending}
                >
                  {testConnectionMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PlugZap className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {testResult && (
                <p className={`text-xs mt-1 ${testResult.success ? "text-green-600" : "text-red-600"}`}>
                  {testResult.success ? `✓ Connected: ${testResult.title}` : `✗ ${testResult.error}`}
                </p>
              )}
            </div>
            {worksheets.length > 0 && (
              <div>
                <Label>Worksheet</Label>
                <Select
                  value={newSource.worksheetName}
                  onValueChange={(v) => setNewSource(prev => ({ ...prev, worksheetName: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select worksheet" /></SelectTrigger>
                  <SelectContent>
                    {worksheets.map((ws) => (
                      <SelectItem key={ws.title} value={ws.title}>
                        {ws.title} ({ws.rowCount} rows)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Sync Frequency</Label>
                <Select
                  value={String(newSource.syncFrequencyMinutes)}
                  onValueChange={(v) => setNewSource(prev => ({ ...prev, syncFrequencyMinutes: Number(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Every 1 min</SelectItem>
                    <SelectItem value="5">Every 5 min</SelectItem>
                    <SelectItem value="15">Every 15 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dedupe Key</Label>
                <Select
                  value={newSource.uniqueKeyPriority}
                  onValueChange={(v: any) => setNewSource(prev => ({ ...prev, uniqueKeyPriority: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta_lead_id">Meta Lead ID</SelectItem>
                    <SelectItem value="phone">Phone Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Assignment Rule</Label>
              <Select
                value={newSource.assignmentRule}
                onValueChange={(v: any) => setNewSource(prev => ({ ...prev, assignmentRule: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="fixed_owner">Fixed Owner</SelectItem>
                  <SelectItem value="by_campaign">By Campaign</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newSource.assignmentRule === "fixed_owner" && (
              <div>
                <Label>Assign to User</Label>
                <Select
                  value={newSource.fixedOwnerId ? String(newSource.fixedOwnerId) : ""}
                  onValueChange={(v) => setNewSource(prev => ({ ...prev, fixedOwnerId: Number(v) }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    {usersList.filter((u: any) => u.role === "SalesAgent" && u.isActive).map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Source
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Field Mapping Dialog ────────────────────────────────────────────── */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Field Mapping: {selectedSource?.sourceName}</DialogTitle>
          </DialogHeader>
          {sheetHeaders.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No headers found. Make sure the sheet has data and the worksheet is configured.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Map each Google Sheet column to a CRM field. Unmapped columns will be stored in custom fields.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sheet Column</TableHead>
                    <TableHead>→</TableHead>
                    <TableHead>CRM Field</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheetHeaders.map((header) => (
                    <TableRow key={header}>
                      <TableCell className="font-mono text-sm">{header}</TableCell>
                      <TableCell>→</TableCell>
                      <TableCell>
                        <Select
                          value={fieldMapping[header] || `_customField.${header}`}
                          onValueChange={(v) => setFieldMapping(prev => ({ ...prev, [header]: v }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CRM_FIELDS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                            ))}
                            <SelectItem value={`_customField.${header}`}>
                              → Custom Field: {header}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMappingDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveMapping} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Preview Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {selectedSource?.sourceName}</DialogTitle>
          </DialogHeader>
          {previewData ? (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Showing {previewData.rows.length} of {previewData.totalRows} total rows
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {previewData.headers.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.rows.map((row, i) => (
                      <TableRow key={i}>
                        {previewData.headers.map((h) => (
                          <TableCell key={h} className="whitespace-nowrap max-w-[200px] truncate">
                            {row[h] || ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">Loading preview...</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Sync Logs Dialog ────────────────────────────────────────────────── */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sync Logs: {selectedSource?.sourceName}</DialogTitle>
          </DialogHeader>
          {syncLogs.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No sync logs yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>Imported</TableHead>
                  <TableHead>Skipped</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status === "success" ? "default" : log.status === "partial" ? "secondary" : "destructive"}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.rowsProcessed}</TableCell>
                    <TableCell>{log.rowsImported}</TableCell>
                    <TableCell>{log.rowsSkipped}</TableCell>
                    <TableCell>{log.rowsError}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">
                      {log.errorMessage || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─────────────────────────────────────────────── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Lead Source?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disable the sync and soft-delete the source. Previously imported leads will be kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSourceId) deleteMutation.mutate({ id: deleteSourceId });
                setShowDeleteDialog(false);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
