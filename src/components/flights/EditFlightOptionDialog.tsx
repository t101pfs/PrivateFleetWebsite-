import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, X, Upload, ImageIcon, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FlightOption } from '@/hooks/useFlightOptions';
import { MentionField } from '@/components/mentions/MentionField';
import { AIRCRAFT_CATEGORIES, AIRCRAFT_MANUFACTURERS, AIRCRAFT_MODELS_BY_MANUFACTURER } from './aircraftCatalog';

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

const estimateFlightHours = (from: string, to: string): string => {
  const extractICAO = (route: string) => {
    const match = route.match(/\(([A-Z]{4})\)/);
    return match ? match[1] : route.toUpperCase();
  };
  
  const fromCode = extractICAO(from);
  const toCode = extractICAO(to);
  
  const routeHours: Record<string, number> = {
    'OEJN-OERK': 1.5, 'OERK-OEJN': 1.5,
    'OEJN-OEDF': 2.0, 'OEDF-OEJN': 2.0,
    'OERK-OEDF': 0.75, 'OEDF-OERK': 0.75,
    'OEJN-OEMA': 1.25, 'OEMA-OEJN': 1.25,
    'OERK-OEMA': 1.0, 'OEMA-OERK': 1.0,
    'OEJN-OMDB': 2.5, 'OMDB-OEJN': 2.5,
    'OERK-OMDB': 2.0, 'OMDB-OERK': 2.0,
    'OEJN-OTHH': 2.0, 'OTHH-OEJN': 2.0,
    'OERK-OTHH': 1.5, 'OTHH-OERK': 1.5,
    'OEJN-EGLL': 6.5, 'EGLL-OEJN': 6.5,
    'OERK-EGLL': 7.0, 'EGLL-OERK': 7.0,
    'OEJN-LFPG': 6.0, 'LFPG-OEJN': 6.0,
    'OERK-LFPG': 6.5, 'LFPG-OERK': 6.5,
  };
  
  const routeKey = `${fromCode}-${toCode}`;
  const hours = routeHours[routeKey];
  
  if (hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  
  return '~2h';
};

export function EditFlightOptionDialog({
  open,
  onOpenChange,
  option,
  onSubmit,
  isPending,
  flightRoute,
}: EditFlightOptionDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
  const [range, setRange] = useState(option.aircraft_specs?.range || '');
  const [cabinLayout, setCabinLayout] = useState(option.aircraft_specs?.cabin_layout || '');
  
  // Option fields
  const [availableTimes, setAvailableTimes] = useState<string[]>(
    option.available_times?.length ? option.available_times : ['']
  );
  const [useRequestedTime, setUseRequestedTime] = useState(
    option.available_times?.[0]?.includes('As per request') || false
  );
  const [estimatedDuration, setEstimatedDuration] = useState(option.estimated_duration || '');
  const [useFlightDuration, setUseFlightDuration] = useState(false);
  const [basePrice, setBasePrice] = useState(option.base_price.toString());
  const [priceItems, setPriceItems] = useState<{label: string; amount: string}[]>(
    (option.aircraft_specs?.price_items || []).map((item: any) => ({
      label: item.label || '',
      amount: item.amount?.toString() || '',
    }))
  );
  const [operatorId, setOperatorId] = useState(option.operator_id || '');

  // Extended fields (Phase 1)
  const [aircraftRegistration, setAircraftRegistration] = useState(option.aircraft_registration || '');
  const [baggageCapacity, setBaggageCapacity] = useState(option.baggage_capacity || '');
  const [currency, setCurrency] = useState(option.currency || 'USD');
  const [availabilityStatus, setAvailabilityStatus] = useState(option.availability_status || 'available');
  const [aircraftNotes, setAircraftNotes] = useState(option.aircraft_notes || '');
  const [featuresInput, setFeaturesInput] = useState((option.aircraft_features || []).join(', '));
  const [existingInterior, setExistingInterior] = useState<string[]>(option.interior_images || []);
  const [newInteriorFiles, setNewInteriorFiles] = useState<File[]>([]);
  const [newInteriorPreviews, setNewInteriorPreviews] = useState<string[]>([]);
  const [existingLayout, setExistingLayout] = useState(option.layout_image || '');
  const [layoutFile, setLayoutFile] = useState<File | null>(null);
  const [layoutPreview, setLayoutPreview] = useState('');
  const [requiresPositioning, setRequiresPositioning] = useState(option.requires_positioning || false);
  const [validityMinutes, setValidityMinutes] = useState(option.validity_minutes?.toString() || '');
  const [existingSupportingDocName, setExistingSupportingDocName] = useState(option.supporting_document_name || '');
  const [existingSupportingDocPath, setExistingSupportingDocPath] = useState(option.supporting_document_path || '');
  const [supportingDocFile, setSupportingDocFile] = useState<File | null>(null);

  // New operator form
  const [showNewOperator, setShowNewOperator] = useState(false);
  const [newOperatorName, setNewOperatorName] = useState('');
  const [newOperatorEmail, setNewOperatorEmail] = useState('');
  const [newOperatorPhone, setNewOperatorPhone] = useState('');
  const [newOperatorCountry, setNewOperatorCountry] = useState('');
  
  // Image management
  const [existingImages, setExistingImages] = useState<string[]>(option.aircraft_images || []);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
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
      setRange(option.aircraft_specs?.range || '');
      setCabinLayout(option.aircraft_specs?.cabin_layout || '');
      setAvailableTimes(option.available_times?.length ? option.available_times : ['']);
      setUseRequestedTime(option.available_times?.[0]?.includes('As per request') || false);
      setEstimatedDuration(option.estimated_duration || '');
      setBasePrice(option.base_price.toString());
      setPriceItems(
        (option.aircraft_specs?.price_items || []).map((item: any) => ({
          label: item.label || '',
          amount: item.amount?.toString() || '',
        }))
      );
      setOperatorId(option.operator_id || '');
      setExistingImages(option.aircraft_images || []);
      setNewImageFiles([]);
      setNewImagePreviews([]);
      setAircraftRegistration(option.aircraft_registration || '');
      setBaggageCapacity(option.baggage_capacity || '');
      setCurrency(option.currency || 'USD');
      setAvailabilityStatus(option.availability_status || 'available');
      setAircraftNotes(option.aircraft_notes || '');
      setFeaturesInput((option.aircraft_features || []).join(', '));
      setExistingInterior(option.interior_images || []);
      setNewInteriorFiles([]);
      setNewInteriorPreviews([]);
      setExistingLayout(option.layout_image || '');
      setLayoutFile(null);
      setLayoutPreview('');
      setRequiresPositioning(option.requires_positioning || false);
      setValidityMinutes(option.validity_minutes?.toString() || '');
      setExistingSupportingDocName(option.supporting_document_name || '');
      setExistingSupportingDocPath(option.supporting_document_path || '');
      setSupportingDocFile(null);
    }
  }, [open, option]);

  const resolvedManufacturer = manufacturer === 'Other' ? customManufacturer : manufacturer;
  const modelOptions = AIRCRAFT_MODELS_BY_MANUFACTURER[manufacturer] || [];
  const resolvedModel = modelOptions.length > 0 && model === 'Other' ? customModel : model;

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

  const uploadNewImages = async (): Promise<string[]> => {
    if (newImageFiles.length === 0) return [];
    
    setIsUploadingImages(true);
    const uploadedUrls: string[] = [];
    
    try {
      for (const file of newImageFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `edit_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('aircraft-images')
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('aircraft-images')
          .getPublicUrl(fileName);
        
        uploadedUrls.push(publicUrl);
      }
      
      return uploadedUrls;
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const totalImages = existingImages.length + newImageFiles.length;
    if (totalImages < 3) {
      toast.error('Please have at least 3 aircraft images');
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
      const newUploadedUrls = await uploadList(newImageFiles, 'edit');
      const newInteriorUrls = await uploadList(newInteriorFiles, 'interior');
      const newLayoutUrls = layoutFile ? await uploadList([layoutFile], 'layout') : [];
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

      const allImages = [...existingImages, ...newUploadedUrls];
      const allInterior = [...existingInterior, ...newInteriorUrls];
      const finalLayout = newLayoutUrls[0] || existingLayout || null;

      const aircraftType = `${resolvedManufacturer} ${resolvedModel}`.trim();

      let times = availableTimes.filter(t => t.trim());
      if (useRequestedTime && flightRoute?.departureTime) {
        times = [`As per request (${flightRoute.departureTime})`];
      }

      let duration = estimatedDuration;
      if (useFlightDuration && flightRoute) {
        duration = estimateFlightHours(flightRoute.from, flightRoute.to);
      }

      const parsedItems = priceItems
        .filter(item => item.label.trim() && item.amount.trim())
        .map(item => ({ label: item.label.trim(), amount: parseFloat(item.amount) }));
      const totalPrice = parseFloat(basePrice) + parsedItems.reduce((sum, item) => sum + item.amount, 0);

      const features = featuresInput.split(',').map(f => f.trim()).filter(Boolean);

      const updates: Partial<FlightOption> = {
        aircraft_type: aircraftType,
        aircraft_specs: {
          manufacturer: resolvedManufacturer,
          model: resolvedModel,
          category,
          year_of_make: yearOfMake ? parseInt(yearOfMake) : undefined,
          year_of_refurbishment: yearOfRefurbishment ? parseInt(yearOfRefurbishment) : undefined,
          pax: pax ? parseInt(pax) : undefined,
          range,
          cabin_layout: cabinLayout,
          price_items: parsedItems.length > 0 ? parsedItems : undefined,
        },
        aircraft_images: allImages,
        available_times: times.length > 0 ? times : null,
        estimated_duration: duration || null,
        base_price: totalPrice,
        operator_id: operatorId || null,
        aircraft_registration: aircraftRegistration || null,
        baggage_capacity: baggageCapacity || null,
        currency,
        availability_status: availabilityStatus,
        interior_images: allInterior.length > 0 ? allInterior : null,
        layout_image: finalLayout,
        aircraft_notes: aircraftNotes || null,
        aircraft_features: features.length > 0 ? features : null,
        requires_positioning: requiresPositioning,
        validity_minutes: validityMinutes ? parseInt(validityMinutes) : null,
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    if (validFiles.length !== files.length) {
      toast.error('Only image files are allowed');
    }
    
    setNewImageFiles(prev => [...prev, ...validFiles]);
    
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setNewImageFiles(prev => prev.filter((_, i) => i !== index));
    setNewImagePreviews(prev => prev.filter((_, i) => i !== index));
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

  const totalImages = existingImages.length + newImageFiles.length;
  const isFormValid = category && resolvedManufacturer && resolvedModel && yearOfMake && basePrice && totalImages >= 3;
  const isSubmitting = isPending || isUploadingImages;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Aircraft Option</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Aircraft Images Section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Aircraft Images *
              <span className="text-xs text-muted-foreground">(Minimum 3 required)</span>
            </Label>
            
            {totalImages < 3 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
                Please have at least 3 aircraft images ({totalImages}/3)
              </div>
            )}
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Existing images */}
              {existingImages.map((url, index) => (
                <div key={`existing-${index}`} className="relative aspect-video bg-secondary rounded overflow-hidden group">
                  <img src={url} alt={`Aircraft ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(index)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              
              {/* New image previews */}
              {newImagePreviews.map((preview, index) => (
                <div key={`new-${index}`} className="relative aspect-video bg-secondary rounded overflow-hidden group">
                  <img src={preview} alt={`New ${index + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1 rounded">New</div>
                  <button
                    type="button"
                    onClick={() => removeNewImage(index)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-video border-2 border-dashed border-muted-foreground/30 rounded flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Add Image</span>
              </button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

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
              <Label htmlFor="range">Range</Label>
              <Input
                id="range"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                placeholder="e.g., 3,200 nm"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="cabinLayout">Cabin Layout</Label>
              <Textarea
                id="cabinLayout"
                value={cabinLayout}
                onChange={(e) => setCabinLayout(e.target.value)}
                placeholder="Describe cabin configuration..."
                rows={2}
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

            {/* Estimated Duration */}
            <div className="col-span-2 space-y-2">
              <Label htmlFor="estimatedDuration">Estimated Duration</Label>
              
              {flightRoute && (
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    id="useFlightDuration"
                    checked={useFlightDuration}
                    onCheckedChange={(checked) => {
                      setUseFlightDuration(checked === true);
                      if (checked) {
                        setEstimatedDuration(estimateFlightHours(flightRoute.from, flightRoute.to));
                      }
                    }}
                  />
                  <Label htmlFor="useFlightDuration" className="text-sm font-normal cursor-pointer">
                    Use flight hours for route ({estimateFlightHours(flightRoute.from, flightRoute.to)})
                  </Label>
                </div>
              )}
              
              <Input
                id="estimatedDuration"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                placeholder="e.g., 2h 30m"
                disabled={useFlightDuration}
              />
            </div>

            {/* Pricing Section */}
            <div className="col-span-2 space-y-3">
              <Label className="text-sm font-semibold">Pricing</Label>
              
              <div className="space-y-2 p-3 border rounded-lg bg-secondary/20">
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Label htmlFor="basePrice" className="text-xs text-muted-foreground">Charter Price (Net) *</Label>
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
                    <span>Total</span>
                    <span>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(
                        (parseFloat(basePrice) || 0) + priceItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
                      )}
                    </span>
                  </div>
                )}
              </div>
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
                  <Label className="text-xs">Baggage Capacity</Label>
                  <Input value={baggageCapacity} onChange={(e) => setBaggageCapacity(e.target.value)} placeholder="e.g., 8 bags / 200 kg" />
                </div>
                <div>
                  <Label className="text-xs">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="SAR">SAR</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="AED">AED</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Label className="text-xs">Aircraft Features (comma-separated)</Label>
                  <Input value={featuresInput} onChange={(e) => setFeaturesInput(e.target.value)} placeholder="WiFi, Lie-flat seats, Galley" />
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
                <div>
                  <Label htmlFor="editValidityMinutes" className="text-xs">Validity (minutes)</Label>
                  <Input
                    id="editValidityMinutes"
                    type="number"
                    min="0"
                    value={validityMinutes}
                    onChange={(e) => setValidityMinutes(e.target.value)}
                    placeholder="e.g., 30"
                  />
                </div>
                <div className="flex items-end pb-1.5">
                  <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <Checkbox
                      checked={requiresPositioning}
                      onCheckedChange={(checked) => setRequiresPositioning(checked === true)}
                    />
                    Requires Positioning
                  </label>
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
                <div className="col-span-2">
                  <Label className="text-xs">Interior Cabin Images</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                    {existingInterior.map((url, i) => (
                      <div key={`int-ex-${i}`} className="relative aspect-video bg-secondary rounded overflow-hidden group">
                        <img src={url} alt={`Interior ${i + 1}`} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setExistingInterior(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                    {newInteriorPreviews.map((p, i) => (
                      <div key={`int-new-${i}`} className="relative aspect-video bg-secondary rounded overflow-hidden group">
                        <img src={p} alt={`Interior new ${i + 1}`} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => { setNewInteriorFiles(prev => prev.filter((_, idx) => idx !== i)); setNewInteriorPreviews(prev => prev.filter((_, idx) => idx !== i)); }} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                    <label className="aspect-video border-2 border-dashed border-muted-foreground/30 rounded flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Add</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                        const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
                        setNewInteriorFiles(prev => [...prev, ...files]);
                        files.forEach(f => { const r = new FileReader(); r.onloadend = () => setNewInteriorPreviews(prev => [...prev, r.result as string]); r.readAsDataURL(f); });
                        e.target.value = '';
                      }} />
                    </label>
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Layout / Floorplan Image</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                    {(layoutPreview || existingLayout) ? (
                      <div className="relative aspect-video bg-secondary rounded overflow-hidden group">
                        <img src={layoutPreview || existingLayout} alt="Layout" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => { setLayoutFile(null); setLayoutPreview(''); setExistingLayout(''); }} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100"><X className="h-3 w-3" /></button>
                      </div>
                    ) : (
                      <label className="aspect-video border-2 border-dashed border-muted-foreground/30 rounded flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Upload</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f && f.type.startsWith('image/')) {
                            setLayoutFile(f);
                            const r = new FileReader();
                            r.onloadend = () => setLayoutPreview(r.result as string);
                            r.readAsDataURL(f);
                          }
                          e.target.value = '';
                        }} />
                      </label>
                    )}
                  </div>
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
