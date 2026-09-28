import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { downloadBlob } from '@/lib/quotation-pdf';
import { generateClientContractPdf, type ClientContractLeg } from '@/lib/client-contract-pdf';

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

interface GenerateClientContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flightId: string;
  aircraftType: string;
  paxCapacity: number | string;
  currency: string;
  suggestedPrice: number | null;
  defaultSecondPartyName: string;
  defaultSignerName: string;
}

export function GenerateClientContractDialog({
  open, onOpenChange, flightId, aircraftType, paxCapacity, currency, suggestedPrice,
  defaultSecondPartyName, defaultSignerName,
}: GenerateClientContractDialogProps) {
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [secondPartyName, setSecondPartyName] = useState('');
  const [secondPartyCity, setSecondPartyCity] = useState('');
  const [secondPartyId, setSecondPartyId] = useState('');
  const [mainPaxName, setMainPaxName] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [grossPrice, setGrossPrice] = useState('');
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      setLang('en');
      setSecondPartyName(defaultSecondPartyName || '');
      setSecondPartyCity('');
      setSecondPartyId('');
      setMainPaxName(defaultSecondPartyName || '');
      setContractEndDate('');
      setGrossPrice(suggestedPrice != null ? String(Math.round(suggestedPrice)) : '');
      setSignerName(defaultSignerName || '');
      setSignerTitle('');
    }
  }, [open, defaultSecondPartyName, defaultSignerName, suggestedPrice]);

  const handleGenerate = async () => {
    if (!secondPartyName.trim()) { toast.error('Enter the second party (client) name'); return; }
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
      const legs: ClientContractLeg[] = (Array.isArray(legsRaw) && legsRaw.length > 0
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
          }]);

      const today = new Date();
      const contractDateLabel = lang === 'ar'
        ? today.toLocaleDateString('en-GB')
        : `${today.toLocaleDateString('en-US', { weekday: 'long' })}, ${today.toLocaleDateString('en-GB')}`;

      const contractNumber = `CT-${today.getFullYear()}-${flightId.slice(0, 6).toUpperCase()}`;

      const blob = await generateClientContractPdf({
        contractNumber,
        contractDateLabel,
        contractEndDate,
        secondPartyName: secondPartyName.trim(),
        secondPartyCity: secondPartyCity.trim() || clientContact?.address || undefined,
        secondPartyId: secondPartyId.trim() || undefined,
        aircraftType,
        paxCapacity,
        legs,
        mainPaxName: mainPaxName.trim(),
        grossPrice: Number(grossPrice),
        currency,
        signerName: signerName.trim(),
        signerTitle: signerTitle.trim() || 'Authorized Signatory',
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
            <Label className="text-xs">Language</Label>
            <div className="flex gap-2 mt-1">
              <Button type="button" size="sm" variant={lang === 'en' ? 'default' : 'outline'} onClick={() => setLang('en')}>English</Button>
              <Button type="button" size="sm" variant={lang === 'ar' ? 'default' : 'outline'} onClick={() => setLang('ar')}>العربية (Arabic)</Button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <Label htmlFor="gcc_name" className="text-xs">Second Party (client) Name</Label>
              <Input id="gcc_name" value={secondPartyName} onChange={(e) => setSecondPartyName(e.target.value)} placeholder="Mr. ..." />
            </div>
            <div>
              <Label htmlFor="gcc_city" className="text-xs">City / District</Label>
              <Input id="gcc_city" value={secondPartyCity} onChange={(e) => setSecondPartyCity(e.target.value)} placeholder="Jeddah" />
            </div>
          </div>
          <div>
            <Label htmlFor="gcc_id" className="text-xs">ID Number (optional)</Label>
            <Input id="gcc_id" value={secondPartyId} onChange={(e) => setSecondPartyId(e.target.value)} placeholder="Leave blank if not known yet" />
          </div>
          <div>
            <Label htmlFor="gcc_pax" className="text-xs">Main Passenger Name</Label>
            <Input id="gcc_pax" value={mainPaxName} onChange={(e) => setMainPaxName(e.target.value)} />
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
              <Input id="gcc_signer" value={signerName} onChange={(e) => setSignerName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="gcc_title" className="text-xs">Their Title</Label>
              <Input id="gcc_title" value={signerTitle} onChange={(e) => setSignerTitle(e.target.value)} placeholder="e.g. Chief Executive Officer" />
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
