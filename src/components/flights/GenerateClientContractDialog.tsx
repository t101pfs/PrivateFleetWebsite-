import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { downloadBlob } from '@/lib/quotation-pdf';
import { generateClientContractPdf, type ClientContractLeg } from '@/lib/client-contract-pdf';
import { estimateFlightTime } from '@/lib/flightTime';

interface QuotationLegRaw {
  from?: string; to?: string; route_from?: string; route_to?: string;
  date?: string; departure_date?: string;
  departureTime?: string; departure_time?: string;
  passengers?: number;
}

interface FlightContact {
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  address: string | null;
}

// Odai Alhazmi always signs the Client Contract, regardless of who in Sales
// or Admin is the one generating/uploading it - not a choice, and not
// whoever happens to be logged in.
const SIGNER_NAME_EN = 'Odai Alhazmi';
const SIGNER_NAME_AR = 'عدي الحازمي';
const TITLE_EN = 'Chief Executive Officer';
const TITLE_AR = 'الرئيس التنفيذي';

interface GenerateClientContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flightId: string;
  aircraftType: string;
  paxCapacity: number | string;
  currency: string;
  suggestedPrice: number | null;
  defaultSecondPartyName: string;
}

export function GenerateClientContractDialog({
  open, onOpenChange, flightId, aircraftType, paxCapacity, currency, suggestedPrice,
  defaultSecondPartyName,
}: GenerateClientContractDialogProps) {
  const defaultTitleFor = (l: 'en' | 'ar') => (l === 'ar' ? TITLE_AR : TITLE_EN);
  const defaultSignerNameFor = (l: 'en' | 'ar') => (l === 'ar' ? SIGNER_NAME_AR : SIGNER_NAME_EN);

  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [partyType, setPartyType] = useState<'individual' | 'entity'>('individual');
  const [secondPartyName, setSecondPartyName] = useState('');
  const [secondPartyCity, setSecondPartyCity] = useState('');
  const [secondPartyId, setSecondPartyId] = useState('');
  const [secondPartyCrNumber, setSecondPartyCrNumber] = useState('');
  const [secondPartyRepresentative, setSecondPartyRepresentative] = useState('');
  const [mainPaxName, setMainPaxName] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [grossPrice, setGrossPrice] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [royalTerminal, setRoyalTerminal] = useState(false);
  const [secondPartySignerRole, setSecondPartySignerRole] = useState<'passenger' | 'representative'>('representative');
  const [isGenerating, setIsGenerating] = useState(false);

  // Shown up front so Sales can reference/quote it before the PDF even
  // exists, not just after generating — same number that ends up in the
  // contract itself and the downloaded file's name.
  const contractNumber = useMemo(
    () => `CT-${new Date().getFullYear()}-${flightId.slice(0, 6).toUpperCase()}`,
    [flightId]
  );

  useEffect(() => {
    if (open) {
      setLang('en');
      setPartyType('individual');
      setSecondPartyName(defaultSecondPartyName || '');
      setSecondPartyCity('');
      setSecondPartyId('');
      setSecondPartyCrNumber('');
      setSecondPartyRepresentative('');
      setMainPaxName(defaultSecondPartyName || '');
      setContractEndDate('');
      setGrossPrice(suggestedPrice != null ? String(Math.round(suggestedPrice)) : '');
      setSignerName(defaultSignerNameFor('en'));
      setSignerTitle(defaultTitleFor('en'));
      setRoyalTerminal(false);
      setSecondPartySignerRole('representative');
    }
  }, [open, defaultSecondPartyName, suggestedPrice]);

  // The title field is shared across both languages — swap it to the other
  // language's default only if it still matches a default, so a title
  // someone actually typed themselves never gets silently overwritten.
  const changeLang = (next: 'en' | 'ar') => {
    setLang(next);
    const from = next === 'ar' ? 'en' : 'ar';
    if (signerTitle === defaultTitleFor(from)) setSignerTitle(defaultTitleFor(next));
    if (signerName === defaultSignerNameFor(from)) setSignerName(defaultSignerNameFor(next));
  };

  const handleGenerate = async () => {
    if (!secondPartyName.trim()) { toast.error(partyType === 'entity' ? 'Enter the company name' : 'Enter the second party (client) name'); return; }
    if (partyType === 'entity' && !secondPartyCrNumber.trim()) { toast.error('Enter the commercial registration number'); return; }
    if (partyType === 'entity' && !secondPartyCity.trim()) { toast.error('Enter the company address'); return; }
    if (partyType === 'entity' && !secondPartyRepresentative.trim()) { toast.error('Enter the company representative'); return; }
    if (!mainPaxName.trim()) { toast.error('Enter the main passenger name'); return; }
    if (!contractEndDate) { toast.error('Enter when the contract ends'); return; }
    if (!grossPrice || Number(grossPrice) <= 0) { toast.error('Enter the gross charter price'); return; }
    if (!signerName.trim()) { toast.error('Choose who signs for Private Fleet Services'); return; }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('route_from, route_to, departure_date, departure_time, passengers, flight_legs, client_id, leads(company_name, first_name, last_name, address)')
        .eq('id', flightId)
        .single();
      if (error) throw error;
      const flight = data as unknown as {
        route_from: string; route_to: string; departure_date: string; departure_time: string;
        passengers: number; flight_legs: QuotationLegRaw[] | null; client_id: string | null;
        leads: FlightContact | null;
      };

      let clientContact: FlightContact | null = flight.leads;
      if (flight.client_id) {
        const { data: clientRow } = await supabase
          .from('clients')
          .select('company_name, first_name, last_name, address')
          .eq('id', flight.client_id)
          .maybeSingle();
        if (clientRow) clientContact = clientRow;
      }
      if (!secondPartyCity && clientContact?.address) setSecondPartyCity(clientContact.address);

      const legsRaw = flight.flight_legs;
      const rawLegs = Array.isArray(legsRaw) && legsRaw.length > 0
        ? legsRaw.map((l) => ({
            date: l.date || l.departure_date || flight.departure_date,
            from: l.from || l.route_from || flight.route_from,
            to: l.to || l.route_to || flight.route_to,
            departureTime: l.departureTime || l.departure_time || flight.departure_time || '',
            passengers: Number(l.passengers || flight.passengers || 1),
          }))
        : [{
            date: flight.departure_date,
            from: flight.route_from,
            to: flight.route_to,
            departureTime: flight.departure_time || '',
            passengers: Number(flight.passengers || 1),
          }];

      // Flight Duration isn't tracked anywhere upstream - worked out the
      // same way the quotation PDF already does.
      const legs: ClientContractLeg[] = rawLegs.map((leg) => ({
        ...leg,
        duration: estimateFlightTime(leg.from, leg.to)?.label,
      }));

      const today = new Date();
      const contractDateLabel = lang === 'ar'
        ? today.toLocaleDateString('en-GB')
        : `${today.toLocaleDateString('en-US', { weekday: 'long' })}, ${today.toLocaleDateString('en-GB')}`;

      const blob = await generateClientContractPdf({
        contractNumber,
        contractDateLabel,
        contractEndDate,
        partyType,
        secondPartyName: secondPartyName.trim(),
        secondPartyCity: secondPartyCity.trim() || clientContact?.address || undefined,
        secondPartyId: partyType === 'individual' ? (secondPartyId.trim() || undefined) : undefined,
        secondPartyCrNumber: partyType === 'entity' ? secondPartyCrNumber.trim() : undefined,
        secondPartyRepresentative: partyType === 'entity' ? secondPartyRepresentative.trim() : undefined,
        aircraftType,
        paxCapacity,
        legs,
        mainPaxName: mainPaxName.trim(),
        grossPrice: Number(grossPrice),
        currency,
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim() || defaultTitleFor(lang),
        royalTerminal,
        secondPartySignerRole,
      }, lang);

      downloadBlob(blob, `${contractNumber}-${lang}.pdf`);
      toast.success('Contract generated — choose it below to upload once it looks right');
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate contract');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Client Contract</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Contract Number</Label>
            <p className="text-sm font-medium rounded-md border bg-secondary/30 px-3 py-2 mt-1">{contractNumber}</p>
          </div>

          <div>
            <Label className="text-xs">Language</Label>
            <div className="flex gap-2 mt-1">
              <Button type="button" size="sm" variant={lang === 'en' ? 'default' : 'outline'} onClick={() => changeLang('en')}>English</Button>
              <Button type="button" size="sm" variant={lang === 'ar' ? 'default' : 'outline'} onClick={() => changeLang('ar')}>العربية (Arabic)</Button>
            </div>
          </div>

          <div>
            <Label className="text-xs">Second Party Type (نوع الطرف الثاني)</Label>
            <div className="flex gap-2 mt-1">
              <Button type="button" size="sm" variant={partyType === 'individual' ? 'default' : 'outline'} onClick={() => setPartyType('individual')}>
                Individual (فرد)
              </Button>
              <Button type="button" size="sm" variant={partyType === 'entity' ? 'default' : 'outline'} onClick={() => setPartyType('entity')}>
                Entity / Company (شركة)
              </Button>
            </div>
          </div>

          {partyType === 'individual' ? (
            <>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="gcc_name" className="text-xs">Client Name (اسم الطرف الثاني)</Label>
                  <Input
                    id="gcc_name"
                    value={secondPartyName}
                    onChange={(e) => setSecondPartyName(e.target.value)}
                    placeholder={lang === 'ar' ? 'بالعربية' : 'Mr. ...'}
                  />
                </div>
                <div>
                  <Label htmlFor="gcc_city" className="text-xs">City / District (المدينة / الحي)</Label>
                  <Input id="gcc_city" value={secondPartyCity} onChange={(e) => setSecondPartyCity(e.target.value)} placeholder="Jeddah" />
                </div>
              </div>
              <div>
                <Label htmlFor="gcc_id" className="text-xs">ID Number, optional (رقم الهوية، اختياري)</Label>
                <Input id="gcc_id" value={secondPartyId} onChange={(e) => setSecondPartyId(e.target.value)} placeholder="Leave blank if not known yet" />
              </div>
            </>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="gcc_company_name" className="text-xs">Company Name (اسم الشركة)</Label>
                  <Input
                    id="gcc_company_name"
                    value={secondPartyName}
                    onChange={(e) => setSecondPartyName(e.target.value)}
                    placeholder={lang === 'ar' ? 'بالعربية' : 'Company Ltd.'}
                  />
                </div>
                <div>
                  <Label htmlFor="gcc_cr" className="text-xs">CR Number (رقم السجل التجاري)</Label>
                  <Input id="gcc_cr" value={secondPartyCrNumber} onChange={(e) => setSecondPartyCrNumber(e.target.value)} placeholder="4030xxxxxx" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="gcc_company_address" className="text-xs">Address (العنوان)</Label>
                  <Input
                    id="gcc_company_address"
                    value={secondPartyCity}
                    onChange={(e) => setSecondPartyCity(e.target.value)}
                    placeholder={lang === 'ar' ? 'بالعربية' : 'Jeddah, ...'}
                  />
                </div>
                <div>
                  <Label htmlFor="gcc_representative" className="text-xs">Company Representative (ممثل الشركة)</Label>
                  <Input
                    id="gcc_representative"
                    value={secondPartyRepresentative}
                    onChange={(e) => setSecondPartyRepresentative(e.target.value)}
                    placeholder={lang === 'ar' ? 'بالعربية' : 'Mr. ...'}
                  />
                </div>
              </div>
            </>
          )}
          <div>
            <Label htmlFor="gcc_pax" className="text-xs">Main Passenger Name</Label>
            <Input
              id="gcc_pax"
              value={mainPaxName}
              onChange={(e) => setMainPaxName(e.target.value)}
              placeholder={lang === 'ar' ? 'بالعربية' : undefined}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <Label htmlFor="gcc_end" className="text-xs">Contract Ends</Label>
              <Input id="gcc_end" type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="gcc_price" className="text-xs">Gross Charter Price ({currency})</Label>
              <Input id="gcc_price" type="number" min="0" value={grossPrice} onChange={(e) => setGrossPrice(e.target.value)} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <Label htmlFor="gcc_signer" className="text-xs">Signing for Private Fleet Services</Label>
              <Input
                id="gcc_signer"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder={lang === 'ar' ? 'بالعربية' : 'e.g. Odai Alhazmi'}
              />
            </div>
            <div>
              <Label htmlFor="gcc_title" className="text-xs">Their Title</Label>
              <Input id="gcc_title" value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} placeholder="e.g. Chief Executive Officer" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Second Party Signs As (الراكب الرئيسي / ممثل الراكب)</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                size="sm"
                variant={secondPartySignerRole === 'representative' ? 'default' : 'outline'}
                onClick={() => setSecondPartySignerRole('representative')}
              >
                Passenger Representative (ممثل الراكب)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={secondPartySignerRole === 'passenger' ? 'default' : 'outline'}
                onClick={() => setSecondPartySignerRole('passenger')}
              >
                Main Passenger (الراكب الرئيسي)
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md border p-3">
            <Checkbox
              id="gcc_royal_terminal"
              checked={royalTerminal}
              onCheckedChange={(checked) => setRoyalTerminal(checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="gcc_royal_terminal" className="text-sm font-normal cursor-pointer">
                Royal Terminal fees apply
              </Label>
              <p className="text-xs text-muted-foreground">
                Checked: "Royal terminal" is listed as included in the price. Unchecked: it's listed as excluded. Applies to both English and Arabic.
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Aircraft, route and passenger count are pulled straight from this flight — review the downloaded PDF, then upload it below.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
            Generate & Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
