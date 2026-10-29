import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, AlertTriangle, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { parseShiftSchedulePdf, type ParseResult, type ParsedShiftCell } from '@/lib/shiftSchedulePdf';

interface PersonOption {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opsUsers: PersonOption[];
  pairPool: PersonOption[];
}

// Plain Levenshtein edit distance - catches transliteration spelling
// variants (e.g. a legend reading "Khalid" for an account registered as
// "Khaled") that startsWith/includes can't, since the difference sits in
// the middle of the word rather than at an edge.
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Best-effort match for a short name pulled off the PDF ("Khalid", "Maria")
// against a full account name ("Khaled Elzeer", "Mariah Baaqeel") - the
// legend and row labels never spell out full names. Never auto-trusted
// silently: every row in the review table still shows its own picker so a
// wrong or absent match is just one click to fix before anything saves.
function matchPerson(rawName: string, pool: PersonOption[]): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const target = norm(rawName);
  if (!target) return null;
  let best: { id: string; score: number } | null = null;
  for (const p of pool) {
    const candidates = [p.full_name || '', ...(p.full_name || '').split(/\s+/), p.email.split('@')[0]];
    for (const c of candidates) {
      const cNorm = norm(c);
      if (!cNorm) continue;
      let score = 0;
      if (cNorm === target) score = 100;
      else if (cNorm.startsWith(target) || target.startsWith(cNorm)) score = 80 - Math.abs(cNorm.length - target.length);
      else if (cNorm.includes(target) || target.includes(cNorm)) score = 50;
      else {
        // A couple of swapped/substituted letters in an otherwise-matching
        // name ("khalid" vs "khaled") - only on reasonably long words, so a
        // short name can't accidentally edit-distance its way into a
        // completely different short name.
        const maxLen = Math.max(target.length, cNorm.length);
        const dist = maxLen >= 4 ? levenshtein(target, cNorm) : Infinity;
        if (dist <= 2 && dist / maxLen <= 0.3) score = 60 - dist * 10;
      }
      if (score > 0 && (!best || score > best.score)) best = { id: p.user_id, score };
    }
  }
  return best && best.score >= 50 ? best.id : null;
}

interface ReviewRow {
  key: string;
  date: string;
  shiftType: 'day' | 'night';
  colorHex: string;
  opsId: string | null;
  pair1Id: string | null;
  pair2Id: string | null;
  pairedRawNames: [string, string] | null;
  rawName: string | null;
}

export function ShiftScheduleUploadDialog({ open, onOpenChange, opsUsers, pairPool }: Props) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const allPeople = useMemo(() => [...opsUsers, ...pairPool], [opsUsers, pairPool]);

  const reset = () => { setFile(null); setParsed(null); setRows([]); };

  const handleFile = async (f: File) => {
    setFile(f);
    setParsing(true);
    setParsed(null);
    try {
      const result = await parseShiftSchedulePdf(f);
      setParsed(result);
      const built: ReviewRow[] = result.cells.map((cell: ParsedShiftCell, i) => ({
        key: `${cell.date}-${cell.shiftType}-${i}`,
        date: cell.date,
        shiftType: cell.shiftType,
        colorHex: cell.colorHex,
        opsId: cell.matchedLegendName ? matchPerson(cell.matchedLegendName, opsUsers) : null,
        pair1Id: cell.pairedRawNames ? matchPerson(cell.pairedRawNames[0], pairPool) : null,
        pair2Id: cell.pairedRawNames ? matchPerson(cell.pairedRawNames[1], pairPool) : null,
        pairedRawNames: cell.pairedRawNames,
        rawName: cell.matchedLegendName,
      }));
      setRows(built);
      if (result.cells.length > 0) toast.success(`Read ${result.cells.length} shift cells - check everything below before saving`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to read the PDF');
      reset();
    } finally {
      setParsing(false);
    }
  };

  const unresolvedCount = rows.filter((r) => !r.opsId || (r.shiftType === 'day' && (!r.pair1Id || !r.pair2Id))).length;

  const dateRange = useMemo(() => {
    if (rows.length === 0) return null;
    const dates = rows.map((r) => r.date).sort();
    return { start: dates[0], end: dates[dates.length - 1] };
  }, [rows]);

  const commit = useMutation({
    mutationFn: async () => {
      if (!dateRange) throw new Error('Nothing to save');
      if (unresolvedCount > 0) throw new Error('Fix the unmatched people highlighted below first');

      // Replace, not merge - re-uploading a corrected PDF for a month
      // should cleanly overwrite what's there, not risk duplicate rows.
      const { error: delErr } = await supabase
        .from('shift_schedules')
        .delete()
        .gte('shift_date', dateRange.start)
        .lte('shift_date', dateRange.end);
      if (delErr) throw delErr;

      const payload = rows.map((r) => ({
        shift_date: r.date,
        shift_type: r.shiftType,
        ops_id: r.opsId,
        paired_user_id_1: r.shiftType === 'day' ? r.pair1Id : null,
        paired_user_id_2: r.shiftType === 'day' ? r.pair2Id : null,
      }));
      const { error } = await supabase.from('shift_schedules').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-schedules'] });
      toast.success(`Saved ${rows.length} shifts (${dateRange?.start} to ${dateRange?.end})`);
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const personLabel = (id: string | null) => {
    if (!id) return null;
    const p = allPeople.find((x) => x.user_id === id);
    return p ? (p.full_name || p.email) : null;
  };

  const groupedByDate = useMemo(() => {
    const map = new Map<string, ReviewRow[]>();
    for (const r of rows) {
      const list = map.get(r.date) || [];
      list.push(r);
      map.set(r.date, list);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Schedule PDF</DialogTitle>
        </DialogHeader>

        {!parsed && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload the monthly "Operations Daily Shifts Schedule" PDF. It reads the actual cell colors against
              that PDF's own legend - nothing saves until you've checked the result below.
            </p>
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 cursor-pointer hover:bg-secondary/30 transition-colors">
              <FileUp className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium">{file ? file.name : 'Click to choose a PDF'}</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </label>
            {parsing && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Reading the schedule...
              </div>
            )}
          </div>
        )}

        {parsed && (
          <div className="space-y-4">
            {parsed.monthLabel && <p className="text-sm font-medium">{parsed.monthLabel}</p>}

            {parsed.legend.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {parsed.legend.map((l, i) => (
                  <Badge key={i} variant="outline" className="gap-1.5 font-normal">
                    <span className="h-3 w-3 rounded-full inline-block border" style={{ backgroundColor: l.colorHex }} />
                    {l.rawName}
                  </Badge>
                ))}
              </div>
            )}

            {parsed.warnings.length > 0 && (
              <div className="rounded-md border border-warning/40 bg-warning/5 p-3 space-y-1">
                {parsed.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" /> {w}
                  </p>
                ))}
              </div>
            )}

            {unresolvedCount > 0 && (
              <p className="text-sm text-destructive font-medium">
                {unresolvedCount} row{unresolvedCount === 1 ? '' : 's'} need a person picked by hand before this can save.
              </p>
            )}

            <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
              {groupedByDate.map(([date, dayRows]) => (
                <div key={date} className="rounded-md border p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">{format(new Date(date + 'T00:00:00'), 'EEEE, MMM d, yyyy')}</p>
                  {dayRows.map((r) => {
                    const needsOps = !r.opsId;
                    const needsPair = r.shiftType === 'day' && (!r.pair1Id || !r.pair2Id);
                    return (
                      <div key={r.key} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="h-3 w-3 rounded-full inline-block border shrink-0" style={{ backgroundColor: r.colorHex }} title={r.colorHex} />
                        <span className="w-14 shrink-0 text-muted-foreground">{r.shiftType === 'day' ? 'Day' : 'Night'}</span>
                        <Select value={r.opsId || ''} onValueChange={(v) => setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, opsId: v } : x)))}>
                          <SelectTrigger className={`h-8 w-44 ${needsOps ? 'border-destructive' : ''}`}>
                            <SelectValue placeholder={r.rawName ? `"${r.rawName}" - pick who` : 'Pick who'} />
                          </SelectTrigger>
                          <SelectContent>
                            {opsUsers.map((o) => <SelectItem key={o.user_id} value={o.user_id}>{o.full_name || o.email}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {r.shiftType === 'day' && (
                          <>
                            <span className="text-muted-foreground text-xs">with</span>
                            <Select value={r.pair1Id || ''} onValueChange={(v) => setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, pair1Id: v } : x)))}>
                              <SelectTrigger className={`h-8 w-36 ${!r.pair1Id ? 'border-destructive' : ''}`}>
                                <SelectValue placeholder={r.pairedRawNames?.[0] || 'Pick'} />
                              </SelectTrigger>
                              <SelectContent>
                                {pairPool.map((o) => <SelectItem key={o.user_id} value={o.user_id}>{o.full_name || o.email}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <span className="text-muted-foreground text-xs">&amp;</span>
                            <Select value={r.pair2Id || ''} onValueChange={(v) => setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, pair2Id: v } : x)))}>
                              <SelectTrigger className={`h-8 w-36 ${!r.pair2Id ? 'border-destructive' : ''}`}>
                                <SelectValue placeholder={r.pairedRawNames?.[1] || 'Pick'} />
                              </SelectTrigger>
                              <SelectContent>
                                {pairPool.map((o) => <SelectItem key={o.user_id} value={o.user_id}>{o.full_name || o.email}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        {!needsOps && !needsPair && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {personLabel(r.opsId)}{r.shiftType === 'day' ? ` · ${personLabel(r.pair1Id)} & ${personLabel(r.pair2Id)}` : ''}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {dateRange && (
              <p className="text-xs text-muted-foreground">
                Saving will replace any existing shifts from {format(new Date(dateRange.start + 'T00:00:00'), 'MMM d')} to {format(new Date(dateRange.end + 'T00:00:00'), 'MMM d, yyyy')}.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          {parsed && (
            <Button onClick={() => commit.mutate()} disabled={commit.isPending || unresolvedCount > 0 || rows.length === 0}>
              {commit.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Save {rows.length} Shifts
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
