import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, X, Building2 } from 'lucide-react';
import { estimateFlightTime } from '@/lib/flightTime';
import { toast } from 'sonner';
import type { FlightOption } from '@/hooks/useFlightOptions';
import { MentionField } from '@/components/mentions/MentionField';
import { AIRCRAFT_CATEGORIES, AIRCRAFT_MANUFACTURERS, AIRCRAFT_MODELS_BY_MANUFACTURER } from './aircraftCatalog';
import { AircraftImageGallery, type GalleryImage } from './AircraftImageGallery';

function galleryImagesFromOption(option: FlightOption): GalleryImage[] {
  return [
    // Exterior isn't a choice any more - any older exterior-tagged photos on
    // an existing option just load in as Interior, same as everything else
    // that isn't the floor plan.
    ...(option.aircraft_images || []).map((url) => ({ id: crypto.randomUUID(), type: 'interior' as const, url })),
    ...(option.interior_images || []).map((url) => ({ id: crypto.randomUUID(), type: 'interior' as const, url })),
    ...(option.layout_image ? [{ id: crypto.randomUUID(), type: 'floorplan' as const, url: option.layout_image }] : []),
  ];
}

interface EditFlightOptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  option: FlightOption;
  onSubmit: (optionId: string, updates: Partial<FlightOption>) => void;
  isPending: boolean;
  flightRoute?: {
    from: string;
    to: string;
    departureTime: string;
  };
}

export function EditFlightOptionDialog({
  open,
  onOpenChange,
  option,
  onSubmit,
  isPending,
  flightRoute,
}: EditFlightOptionDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  // The pricing build (margin, tax, fees on top of operator cost) is an
  // Admin decision, not Ops's - Ops just enters what the operator quoted.
  const isRealAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Parse existing aircraft type into manufacturer/model
  const parseAircraftType = (type: string) => {
    const specs = option.aircraft_specs || {};
    return {
      manufacturer: specs.manufacturer || type.split(' ')[0] || '',
      model: specs.model || type.split(' ').slice(1).join(' ') || '',
    };
  };

  const parsed = parseAircraftType(option.aircraft_type);
  const knownManufacturer = AIRCRAFT_MANUFACTURERS.find((m) => m === parsed.manufacturer);
  const knownModelOptions = AIRCRAFT_MODELS_BY_MANUFACTURER[knownManufacturer || ''] || [];
  const knownModel = knownModelOptions.find((m) => m === parsed.model);

  // Aircraft fields
  const [category, setCategory] = useState(option.aircraft_specs?.category || '');
  const [manufacturer, setManufacturer] = useState(knownManufacturer || (parsed.manufacturer ? 'Other' : ''));
  const [customManufacturer, setCustomManufacturer] = useState(knownManufacturer ? '' : parsed.manufacturer);
  const [model, setModel] = useState(knownManufacturer ? (knownModel || (parsed.model ? 'Other' : '')) : parsed.model);
  const [customModel, setCustomModel] = useState(knownManufacturer ? (knownModel ? '' : parsed.model) : '');
  const [yearOfMake, setYearOfMake] = useState(option.aircraft_specs?.year_of_make?.toString() || '');
  const [yearOfRefurbishment, setYearOfRefurbishment] = useState(option.aircraft_specs?.year_of_refurbishment?.toString() || '');
  const [pax, setPax] = useState(option.aircraft_specs?.pax?.toString() || '');
  const [bedroomCount, setBedroomCount] = useState(option.aircraft_specs?.bedroom_count?.toString() || '');
  const [range, setRange] = useState(option.aircraft_specs?.range || '');
  
  // Option fields
  const [availableTimes, setAvailableTimes] = useState<string[]>(
    option.available_times?.length ? option.available_times : ['']
  );
  const [useRequestedTime, setUseRequestedTime] = useState(
    option.available_times?.[0]?.includes('As per request') || false
  );
  const [basePrice, setBasePrice] = useState((option.operator_cost_net ?? option.base_price).toString());
  const [priceItems, setPriceItems] = useState<{label: string; amount: string}[]>(
    (option.aircraft_specs?.price_items || []).map((item: any) => ({
      label: item.label || '',
      amount: item.amount?.toString() || '',
    }))
  );
  const [operatorId, setOperatorId] = useState(option.operator_id || '');

  // Pricing build: operator cost (net -> VAT-normalized) -> client price
  const [operatorVatIncluded, setOperatorVatIncluded] = useState(option.operator_cost_vat_included ?? true);
  const [operatorVatPct, setOperatorVatPct] = useState(option.operator_vat_percent?.toString() || '15');
  const [marginPct, setMarginPct] = useState(option.margin_percent?.toString() || '');
  const [withholdingTaxPct, setWithholdingTaxPct] = useState(option.withholding_tax_percent?.toString() || '');
  const [royalTerminalCost, setRoyalTerminalCost] = useState(option.royal_terminal_cost?.toString() || '');
  const [brokersCommissionPct, setBrokersCommissionPct] = useState(option.brokers_commission_percent?.toString() || '');
  const [clientVatPct, setClientVatPct] = useState(option.client_vat_percent?.toString() || '15');

  // Extended fields (Phase 1)
  const [aircraftRegistration, setAircraftRegistration] = useState(option.aircraft_registration || '');
  const [baggageCapacity, setBaggageCapacity] = useState(option.baggage_capacity || '');
  const [currency, setCurrency] = useState(option.currency || 'SAR');
  const [availabilityStatus, setAvailabilityStatus] = useState(option.availability_status || 'available');
  const [aircraftNotes, setAircraftNotes] = useState(option.aircraft_notes || '');
  const [existingSupportingDocName, setExistingSupportingDocName] = useState(option.supporting_document_name || '');
  const [existingSupportingDocPath, setExistingSupportingDocPath] = useState(option.supporting_document_path || '');
  const [supportingDocFile, setSupportingDocFile] = useState<File | null>(null);

  // New operator form
  const [showNewOperator, setShowNewOperator] = useState(false);
  const [newOperatorName, setNewOperatorName] = useState('');
  const [newOperatorEmail, setNewOperatorEmail] = useState('');
  const [newOperatorPhone, setNewOperatorPhone] = useState('');
  const [newOperatorCountry, setNewOperatorCountry] = useState('');
  
  // Image management — one combined gallery (interior/floor plan)
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(() => galleryImagesFromOption(option));
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  // Reset form when option changes
  useEffect(() => {
    if (open) {
      const p = parseAircraftType(option.aircraft_type);
      const known = AIRCRAFT_MANUFACTURERS.find((m) => m === p.manufacturer);
      const knownModels = AIRCRAFT_MODELS_BY_MANUFACTURER[known || ''] || [];
      const knownM = knownModels.find((m) => m === p.model);
      setCategory(option.aircraft_specs?.category || '');
      setManufacturer(known || (p.manufacturer ? 'Other' : ''));
      setCustomManufacturer(known ? '' : p.manufacturer);
      setModel(known ? (knownM || (p.model ? 'Other' : '')) : p.model);
      setCustomModel(known ? (knownM ? '' : p.model) : '');
      setYearOfMake(option.aircraft_specs?.year_of_make?.toString() || '');
      setYearOfRefurbishment(option.aircraft_specs?.year_of_refurbishment?.toString() || '');
      setPax(option.aircraft_specs?.pax?.toString() || '');
      setBedroomCount(option.aircraft_specs?.bedroom_count?.toString() || '');
      setRange(option.aircraft_specs?.range || '');
      setAvailableTimes(option.available_times?.length ? option.available_times : ['']);
      setUseRequestedTime(option.available_times?.[0]?.includes('As per request') || false);
      setBasePrice((option.operator_cost_net ?? option.base_price).toString());
      setPriceItems(
        (option.aircraft_specs?.price_items || []).map((item: any) => ({
          label: item.label || '',
          amount: item.amount?.toString() || '',
        }))
      );
      setOperatorId(option.operator_id || '');
      setOperatorVatIncluded(option.operator_cost_vat_included ?? true);
      setOperatorVatPct(option.operator_vat_percent?.toString() || '15');
      setMarginPct(option.margin_percent?.toString() || '');
      setWithholdingTaxPct(option.withholding_tax_percent?.toString() || '');
      setRoyalTerminalCost(option.royal_terminal_cost?.toString() || '');
      setBrokersCommissionPct(option.brokers_commission_percent?.toString() || '');
      setClientVatPct(option.client_vat_percent?.toString() || '15');
      setGalleryImages(galleryImagesFromOption(option));
      setAircraftRegistration(option.aircraft_registration || '');
      setBaggageCapacity(option.baggage_capacity || '');
      setCurrency(option.currency || 'SAR');
      setAvailabilityStatus(option.availability_status || 'available');
      setAircraftNotes(option.aircraft_notes || '');
      setExistingSupportingDocName(option.supporting_document_name || '');
      setExistingSupportingDocPath(option.supporting_document_path || '');
      setSupportingDocFile(null);
    }
  }, [open, option]);

  const resolvedManufacturer = manufacturer === 'Other' ? customManufacturer : manufacturer;
  const modelOptions = AIRCRAFT_MODELS_BY_MANUFACTURER[manufacturer] || [];
  const resolvedModel = modelOptions.length > 0 && model === 'Other' ? customModel : model;

  // Flight time is worked out from the route (and the aircraft's category) - never typed in
  const autoTime = useMemo(
    () => (flightRoute ? estimateFlightTime(flightRoute.from, flightRoute.to, category) : null),
    [flightRoute, category]
  );

  // Pricing build, live preview: net operator cost -> VAT-normalized cost ->
  // client price. Mirrors exactly what gets saved on submit.
  const pricingPreview = useMemo(() => {
    const netItemsSum = priceItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const operatorCostNet = (parseFloat(basePrice) || 0) + netItemsSum;
    const operatorCost = operatorVatIncluded ? operatorCostNet : operatorCostNet * (1 + (parseFloat(operatorVatPct) || 0) / 100);
    const marginAmount = operatorCost * ((parseFloat(marginPct) || 0) / 100);
    const withholdingTaxAmount = operatorCost * ((parseFloat(withholdingTaxPct) || 0) / 100);
    const brokersCommissionAmount = operatorCost * ((parseFloat(brokersCommissionPct) || 0) / 100);
    const royalTerminal = parseFloat(royalTerminalCost) || 0;
    const subtotal = operatorCost + marginAmount + withholdingTaxAmount + royalTerminal + brokersCommissionAmount;
    const clientVatAmount = subtotal * ((parseFloat(clientVatPct) || 0) / 100);
    const clientPrice = subtotal + clientVatAmount;
    return { operatorCostNet, operatorCost, marginAmount, withholdingTaxAmount, brokersCommissionAmount, royalTerminal, subtotal, clientVatAmount, clientPrice };
  }, [basePrice, priceItems, operatorVatIncluded, operatorVatPct, marginPct, withholdingTaxPct, royalTerminalCost, brokersCommissionPct, clientVatPct]);

  // Fetch mention candidates
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch operators
  const { data: operators = [] } = useQuery({
    queryKey: ['operators-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operators')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Create operator mutation
  const createOperator = useMutation({
    mutationFn: async (data: {
      name: string;
      contact_email?: string;
      contact_phone?: string;
      country?: string;
    }) => {
      const { data: operator, error } = await supabase
        .from('operators')
        .insert([{ ...data, status: 'active' }])
        .select()
        .single();
      if (error) throw error;
      return operator;
    },
    onSuccess: (operator) => {
      queryClient.invalidateQueries({ queryKey: ['operators-list'] });
      setOperatorId(operator.id);
      setShowNewOperator(false);
      setNewOperatorName('');
      setNewOperatorEmail('');
      setNewOperatorPhone('');
      setNewOperatorCountry('');
      toast.success(`Operator "${operator.name}" created`);
    },
    onError: (error) => {
      toast.error('Failed to create operator: ' + error.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (galleryImages.length < 3) {
      toast.error('Please have at least 3 aircraft images');
      return;
    }

    if (!galleryImages.some((img) => img.type === 'floorplan')) {
      toast.error('Tag one image as Floor Plan');
      return;
    }

    if (!category) {
      toast.error('Category is required');
      return;
    }

    if (!resolvedManufacturer || !resolvedModel) {
      toast.error('Manufacturer and Model are required');
      return;
    }

    if (!yearOfMake) {
      toast.error('Year of Make is required');
      return;
    }

    if (!baggageCapacity) {
      toast.error('Baggage Capacity is required');
      return;
    }

    try {
      const uploadList = async (files: File[], prefix: string) => {
        const urls: string[] = [];
        for (const f of files) {
          const ext = f.name.split('.').pop();
          const name = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
          const { error } = await supabase.storage.from('aircraft-images').upload(name, f);
          if (error) throw error;
          urls.push(supabase.storage.from('aircraft-images').getPublicUrl(name).data.publicUrl);
        }
        return urls;
      };

      setIsUploadingImages(true);
      const newImages = galleryImages.filter((img) => img.file);
      const newUploadedUrls = await uploadList(newImages.map((img) => img.file as File), 'edit');
      const taggedImages = [
        ...galleryImages.filter((img) => img.url).map((img) => ({ url: img.url as string, type: img.type })),
        ...newImages.map((img, i) => ({ url: newUploadedUrls[i], type: img.type })),
      ];
      let supportingDocPath = existingSupportingDocPath || null;
      let supportingDocName = existingSupportingDocName || null;
      if (supportingDocFile) {
        const path = `${option.flight_id}/options/${crypto.randomUUID()}_${supportingDocFile.name}`;
        const { error: docError } = await supabase.storage.from('flight-documents').upload(path, supportingDocFile);
        if (docError) throw docError;
        supportingDocPath = path;
        supportingDocName = supportingDocFile.name;
      }
      setIsUploadingImages(false);

      const allInterior = taggedImages.filter((img) => img.type === 'interior').map((img) => img.url);
      const finalLayout = taggedImages.find((img) => img.type === 'floorplan')?.url || null;

      const aircraftType = `${resolvedManufacturer} ${resolvedModel}`.trim();

      let times = availableTimes.filter(t => t.trim());
      if (useRequestedTime && flightRoute?.departureTime) {
        times = [`As per request (${flightRoute.departureTime})`];
      }

      // Worked out from the route; if there is no route to go on, the saved value stays
      const duration = autoTime ? autoTime.label : option.estimated_duration;

      const parsedItems = priceItems
        .filter(item => item.label.trim() && item.amount.trim())
        .map(item => ({ label: item.label.trim(), amount: parseFloat(item.amount) }));
      // Same pricing build as the live preview, recomputed here off the
      // filtered line items so what's saved matches what's actually valid.
      const operatorCostNet = (parseFloat(basePrice) || 0) + parsedItems.reduce((sum, item) => sum + item.amount, 0);
      const operatorVatPctNum = parseFloat(operatorVatPct) || 0;
      const operatorCost = operatorVatIncluded ? operatorCostNet : operatorCostNet * (1 + operatorVatPctNum / 100);
      const marginPctNum = parseFloat(marginPct) || 0;
      const withholdingTaxPctNum = parseFloat(withholdingTaxPct) || 0;
      const brokersCommissionPctNum = parseFloat(brokersCommissionPct) || 0;
      const royalTerminalNum = parseFloat(royalTerminalCost) || 0;
      const clientVatPctNum = parseFloat(clientVatPct) || 0;
      const subtotal = operatorCost
        + operatorCost * (marginPctNum / 100)
        + operatorCost * (withholdingTaxPctNum / 100)
        + royalTerminalNum
        + operatorCost * (brokersCommissionPctNum / 100);
      const clientPrice = subtotal + subtotal * (clientVatPctNum / 100);

      const updates: Partial<FlightOption> = {
        aircraft_type: aircraftType,
        aircraft_specs: {
          manufacturer: resolvedManufacturer,
          model: resolvedModel,
          category,
          year_of_make: yearOfMake ? parseInt(yearOfMake) : undefined,
          year_of_refurbishment: yearOfRefurbishment ? parseInt(yearOfRefurbishment) : undefined,
          pax: pax ? parseInt(pax) : undefined,
          bedroom_count: bedroomCount ? parseInt(bedroomCount) : undefined,
          range,
          price_items: parsedItems.length > 0 ? parsedItems : undefined,
        },
        // Exterior isn't a tag any more - any old exterior photos were
        // reloaded as Interior above, so this bucket stays empty from here on.
        aircraft_images: [],
        available_times: times.length > 0 ? times : null,
        estimated_duration: duration || null,
        base_price: operatorCost,
        operator_cost_net: operatorCostNet,
        operator_cost_vat_included: operatorVatIncluded,
        operator_vat_percent: operatorVatPctNum || null,
        margin_percent: marginPctNum || null,
        withholding_tax_percent: withholdingTaxPctNum || null,
        royal_terminal_cost: royalTerminalNum || null,
        brokers_commission_percent: brokersCommissionPctNum || null,
        client_vat_percent: clientVatPctNum || null,
        price_override: clientPrice,
        operator_id: operatorId || null,
        aircraft_registration: aircraftRegistration || null,
        baggage_capacity: baggageCapacity || null,
        currency,
        availability_status: availabilityStatus,
        interior_images: allInterior.length > 0 ? allInterior : null,
        layout_image: finalLayout,
        aircraft_notes: aircraftNotes || null,
        supporting_document_path: supportingDocPath,
        supporting_document_name: supportingDocName,
      };

      onSubmit(option.id, updates);
    } catch (error) {
      setIsUploadingImages(false);
      console.error('Error updating aircraft option:', error);
      toast.error('Failed to update aircraft option');
    }
  };

  const addTimeSlot = () => {
    setAvailableTimes([...availableTimes, '']);
  };

  const removeTimeSlot = (index: number) => {
    setAvailableTimes(availableTimes.filter((_, i) => i !== index));
  };

  const updateTimeSlot = (index: number, value: string) => {
    const updated = [...availableTimes];
    updated[index] = value;
    setAvailableTimes(updated);
  };

  const handleCreateOperator = () => {
    if (!newOperatorName.trim()) {
      toast.error('Operator name is required');
      return;
    }
    createOperator.mutate({
      name: newOperatorName.trim(),
      contact_email: newOperatorEmail.trim() || undefined,
      contact_phone: newOperatorPhone.trim() || undefined,
      country: newOperatorCountry.trim() || undefined,
    });
  };

  const isFormValid = category && resolvedManufacturer && resolvedModel && yearOfMake && basePrice && baggageCapacity
    && galleryImages.length >= 3 && galleryImages.some((img) => img.type === 'floorplan');
  const isSubmitting = isPending || isUploadingImages;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Aircraft Option</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AircraftImageGallery images={galleryImages} onChange={setGalleryImages} />

          {/* Aircraft Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {AIRCRAFT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="manufacturer">Manufacturer *</Label>
              <Select
                value={manufacturer}
                onValueChange={(v) => { setManufacturer(v); setModel(''); setCustomModel(''); }}
              >
                <SelectTrigger id="manufacturer"><SelectValue placeholder="Select manufacturer" /></SelectTrigger>
                <SelectContent>
                  {AIRCRAFT_MANUFACTURERS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                  <SelectItem value="Other">Other…</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {manufacturer === 'Other' && (
              <div className="col-span-2">
                <Label htmlFor="customManufacturer">Manufacturer Name *</Label>
                <Input
                  id="customManufacturer"
                  value={customManufacturer}
                  onChange={(e) => setCustomManufacturer(e.target.value)}
                  placeholder="Enter manufacturer"
                />
              </div>
            )}

            <div>
              <Label htmlFor="model">Model (Subtype) *</Label>
              {modelOptions.length > 0 ? (
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model"><SelectValue placeholder="Select model" /></SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                    <SelectItem value="Other">Other…</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g., Challenger 350"
                  required
                />
              )}
            </div>

            {modelOptions.length > 0 && model === 'Other' && (
              <div className="col-span-2">
                <Label htmlFor="customModel">Model Name *</Label>
                <Input
                  id="customModel"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="Enter model"
                />
              </div>
            )}

            <div>
              <Label htmlFor="yearOfMake">Year of Make *</Label>
              <Input
                id="yearOfMake"
                type="number"
                value={yearOfMake}
                onChange={(e) => setYearOfMake(e.target.value)}
                placeholder="e.g., 2018"
                required
              />
            </div>

            <div>
              <Label htmlFor="yearOfRefurbishment">Year of Refurbishment</Label>
              <Input
                id="yearOfRefurbishment"
                type="number"
                value={yearOfRefurbishment}
                onChange={(e) => setYearOfRefurbishment(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <Label htmlFor="pax">Passengers</Label>
              <Input
                id="pax"
                type="number"
                value={pax}
                onChange={(e) => setPax(e.target.value)}
                placeholder="e.g., 8"
              />
            </div>

            <div>
              <Label htmlFor="bedroomCount">Bedrooms</Label>
              <Input
                id="bedroomCount"
                type="number"
                min="0"
                value={bedroomCount}
                onChange={(e) => setBedroomCount(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div>
              <Label htmlFor="range">Range</Label>
              <Input
                id="range"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                placeholder="e.g., 3,200 nm"
              />
            </div>

            {/* Available Departure Times */}
            <div className="col-span-2 space-y-2">
              <Label>Available Departure Times</Label>
              
              {flightRoute && (
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    id="useRequestedTime"
                    checked={useRequestedTime}
                    onCheckedChange={(checked) => {
                      setUseRequestedTime(checked === true);
                      if (checked) {
                        setAvailableTimes(['']);
                      }
                    }}
                  />
                  <Label htmlFor="useRequestedTime" className="text-sm font-normal cursor-pointer">
                    As per request from Sales ({flightRoute.departureTime})
                  </Label>
                </div>
              )}
              
              {!useRequestedTime && (
                <div className="space-y-2">
                  {availableTimes.map((time, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        type="time"
                        value={time.includes('As per request') ? '' : time}
                        onChange={(e) => updateTimeSlot(index, e.target.value)}
                      />
                      {availableTimes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTimeSlot(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTimeSlot}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Time
                  </Button>
                </div>
              )}
            </div>

            {/* Estimated Duration - worked out from the route, never typed in */}
            <div className="col-span-2 space-y-1">
              <Label>Estimated Duration</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {autoTime && flightRoute ? (
                  <>
                    <span className="font-medium">{autoTime.label}</span>
                    <span className="text-muted-foreground">
                      {' '}· worked out automatically from {flightRoute.from} → {flightRoute.to} (about {autoTime.distanceKm.toLocaleString()} km)
                    </span>
                  </>
                ) : <span className="text-muted-foreground">{option.estimated_duration ? `${option.estimated_duration} (saved earlier)` : 'Calculated automatically from the route.'}</span>}
              </div>
            </div>

            {/* Pricing Section */}
            <div className="col-span-2 space-y-3">
              <Label className="text-sm font-semibold">Pricing</Label>
              
              <div className="space-y-2 p-3 border rounded-lg bg-secondary/20">
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Label htmlFor="basePrice" className="text-xs text-muted-foreground">Charter Price (Net) *</Label>
                  </div>
                  <div className="w-24">
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger id="currency"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="SAR">SAR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="AED">AED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-36">
                    <Input
                      id="basePrice"
                      type="number"
                      step="0.01"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      placeholder="e.g., 25000"
                      required
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <Checkbox checked={operatorVatIncluded} onCheckedChange={(v) => setOperatorVatIncluded(v === true)} />
                  This price already includes VAT
                </label>
                {!operatorVatIncluded && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Add</span>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={operatorVatPct}
                      onChange={(e) => setOperatorVatPct(e.target.value)}
                      className="w-16 h-7 text-xs"
                    />
                    <span className="text-muted-foreground">
                      % VAT — operator cost becomes{' '}
                      <span className="font-medium text-foreground">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(pricingPreview.operatorCost)}
                      </span>
                    </span>
                  </div>
                )}

                {priceItems.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Input
                        value={item.label}
                        onChange={(e) => {
                          const updated = [...priceItems];
                          updated[index].label = e.target.value;
                          setPriceItems(updated);
                        }}
                        placeholder="e.g., Catering, Landing Fees, VAT"
                        className="text-sm"
                      />
                    </div>
                    <div className="w-36">
                      <Input
                        type="number"
                        step="0.01"
                        value={item.amount}
                        onChange={(e) => {
                          const updated = [...priceItems];
                          updated[index].amount = e.target.value;
                          setPriceItems(updated);
                        }}
                        placeholder="Amount"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setPriceItems(priceItems.filter((_, i) => i !== index))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPriceItems([...priceItems, { label: '', amount: '' }])}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Service / Tax
                </Button>

                {priceItems.some(item => item.amount) && (
                  <div className="flex justify-between items-center pt-2 border-t text-sm font-semibold">
                    <span>Operator Cost (Net)</span>
                    <span>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(pricingPreview.operatorCostNet)}
                    </span>
                  </div>
                )}
              </div>

              {/* Pricing build — from the (VAT-normalized) operator cost to
                  what the client is charged. An Admin decision, not Ops's;
                  never shown to Sales either way. */}
              {!isRealAdmin ? (
                <p className="text-xs text-muted-foreground p-3 border rounded-lg bg-secondary/20">
                  An Admin sets the margin, tax and fees on top of this to work out the client's price.
                </p>
              ) : (
              <div className="space-y-2 p-3 border rounded-lg bg-secondary/20">
                <p className="text-xs font-semibold text-muted-foreground">Pricing Build (Operator Cost → Client Price)</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="marginPct" className="text-xs text-muted-foreground">Margin %</Label>
                    <Input id="marginPct" type="number" step="0.1" min="0" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label htmlFor="withholdingTaxPct" className="text-xs text-muted-foreground">Withholding Tax %</Label>
                    <Input id="withholdingTaxPct" type="number" step="0.1" min="0" value={withholdingTaxPct} onChange={(e) => setWithholdingTaxPct(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label htmlFor="royalTerminalCost" className="text-xs text-muted-foreground">Royal Terminal Cost</Label>
                    <Input id="royalTerminalCost" type="number" step="0.01" min="0" value={royalTerminalCost} onChange={(e) => setRoyalTerminalCost(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <Label htmlFor="brokersCommissionPct" className="text-xs text-muted-foreground">Brokers Commission %</Label>
                    <Input id="brokersCommissionPct" type="number" step="0.1" min="0" value={brokersCommissionPct} onChange={(e) => setBrokersCommissionPct(e.target.value)} placeholder="0" />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="clientVatPct" className="text-xs text-muted-foreground">VAT % (charged to client)</Label>
                    <Input id="clientVatPct" type="number" step="0.1" min="0" value={clientVatPct} onChange={(e) => setClientVatPct(e.target.value)} className="w-24" />
                  </div>
                </div>

                <div className="space-y-1 text-xs pt-2 border-t">
                  <div className="flex justify-between text-muted-foreground"><span>Operator cost</span><span>{new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(pricingPreview.operatorCost)}</span></div>
                  {pricingPreview.marginAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ Margin</span><span>{new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(pricingPreview.marginAmount)}</span></div>}
                  {pricingPreview.withholdingTaxAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ Withholding Tax</span><span>{new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(pricingPreview.withholdingTaxAmount)}</span></div>}
                  {pricingPreview.royalTerminal > 0 && <div className="flex justify-between text-muted-foreground"><span>+ Royal Terminal Cost</span><span>{new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(pricingPreview.royalTerminal)}</span></div>}
                  {pricingPreview.brokersCommissionAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ Brokers Commission</span><span>{new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(pricingPreview.brokersCommissionAmount)}</span></div>}
                  {pricingPreview.clientVatAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ VAT</span><span>{new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(pricingPreview.clientVatAmount)}</span></div>}
                  <div className="flex justify-between items-center pt-1 border-t font-semibold text-sm">
                    <span>Client Price</span>
                    <span className="text-primary">{new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(pricingPreview.clientPrice)}</span>
                  </div>
                </div>
              </div>
              )}
            </div>

            {/* Operator Selection with Add New */}
            <div className="col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Operator (Hidden from Sales)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowNewOperator(!showNewOperator)}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {showNewOperator ? 'Cancel' : 'Add New'}
                </Button>
              </div>
              
              {showNewOperator ? (
                <div className="p-3 border rounded-lg space-y-3 bg-secondary/30">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4" />
                    New Operator
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <Input
                        value={newOperatorName}
                        onChange={(e) => setNewOperatorName(e.target.value)}
                        placeholder="Operator Name *"
                      />
                    </div>
                    <Input
                      value={newOperatorEmail}
                      onChange={(e) => setNewOperatorEmail(e.target.value)}
                      placeholder="Email"
                      type="email"
                    />
                    <Input
                      value={newOperatorPhone}
                      onChange={(e) => setNewOperatorPhone(e.target.value)}
                      placeholder="Phone"
                    />
                    <Input
                      value={newOperatorCountry}
                      onChange={(e) => setNewOperatorCountry(e.target.value)}
                      placeholder="Country"
                    />
                    <Button
                      type="button"
                      onClick={handleCreateOperator}
                      disabled={!newOperatorName.trim() || createOperator.isPending}
                      size="sm"
                    >
                      {createOperator.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Create Operator'
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <Select value={operatorId} onValueChange={setOperatorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select operator" />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op.id} value={op.id}>
                        {op.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Additional Details (Phase 1) */}
            <div className="col-span-2 space-y-3 p-3 border rounded-lg bg-secondary/10">
              <Label className="text-sm font-semibold">Additional Details</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Aircraft Registration</Label>
                  <Input value={aircraftRegistration} onChange={(e) => setAircraftRegistration(e.target.value)} placeholder="e.g., HZ-PFS1" />
                </div>
                <div>
                  <Label className="text-xs">Baggage Capacity *</Label>
                  <Input value={baggageCapacity} onChange={(e) => setBaggageCapacity(e.target.value)} placeholder="e.g., 8 bags / 200 kg" required />
                </div>
                <div>
                  <Label className="text-xs">Availability Status</Label>
                  <Select value={availabilityStatus} onValueChange={setAvailabilityStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="on_request">On Request</SelectItem>
                      <SelectItem value="unavailable">Unavailable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Aircraft Notes</Label>
                  <MentionField
                    value={aircraftNotes}
                    onChange={setAircraftNotes}
                    candidates={profiles}
                    rows={2}
                    placeholder="Additional notes... Use @ to mention a teammate"
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Supporting Quote (PDF)</Label>
                  {supportingDocFile || existingSupportingDocName ? (
                    <div className="flex items-center justify-between text-sm bg-secondary/30 rounded px-3 py-2 mt-1">
                      <span className="truncate">{supportingDocFile?.name || existingSupportingDocName}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSupportingDocFile(null); setExistingSupportingDocName(''); setExistingSupportingDocPath(''); }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Input
                      type="file"
                      accept="application/pdf"
                      className="mt-1"
                      onChange={(e) => setSupportingDocFile(e.target.files?.[0] || null)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isFormValid || isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isUploadingImages ? 'Uploading Images...' : isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
