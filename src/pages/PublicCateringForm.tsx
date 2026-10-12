import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Plane, Search, X, Check, CheckCircle2, Languages } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { WHOLE_FLIGHT_DINER } from '@/data/cuisines';
import { MENU_SECTIONS, type MenuSectionId } from '@/data/menu';
import { cn } from '@/lib/utils';
import pfLogo from '@/assets/pf-logo.png';

type Lang = 'en' | 'ar';

const EMPTY_SELECTION = Object.fromEntries(MENU_SECTIONS.map((s) => [s.id, [] as string[]])) as Record<MenuSectionId, string[]>;

// Dishes are always keyed/stored by their English name (the canonical value
// saved to catering_requests) regardless of which language the client is
// viewing - Ops/kitchen staff read catering orders in English elsewhere in
// the app, so a client picking in Arabic shouldn't change what gets stored.
const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    pageTitle: 'Catering Preferences',
    menuTitle: 'Menu',
    menuDescription: 'One request for everyone on the flight. Pick a course below, or search the whole menu.',
    searchPlaceholder: 'Search the whole menu...',
    searchAria: 'Search the menu',
    yourSelection: 'Your selection',
    extraLabel: "Anything else you'd like?",
    extraPlaceholder: "Tell us about any dish that isn't on the menu",
    allergyLabel: 'Any allergies?',
    allergyPlaceholder: 'Please specify the allergy',
    submit: 'Submit Catering Preferences',
    thankYouTitle: 'Thank you',
    thankYouBody: 'Your catering preferences have been received. Our team will take care of the rest.',
    invalidLink: 'This catering link is invalid or has expired. Please contact Private Fleet Services directly.',
    pickOrDescribe: 'Pick something from the menu, or tell us what you would like',
    specifyAllergy: 'Please specify the allergies',
    submitFailed: 'Failed to submit',
  },
  ar: {
    pageTitle: 'تفضيلات الضيافة',
    menuTitle: 'قائمة الطعام',
    menuDescription: 'طلب واحد لجميع ركاب الرحلة. اختر وجبة أدناه، أو ابحث في القائمة كاملة.',
    searchPlaceholder: 'ابحث في القائمة كاملة...',
    searchAria: 'البحث في القائمة',
    yourSelection: 'اختياراتك',
    extraLabel: 'هل ترغب بشيء آخر؟',
    extraPlaceholder: 'أخبرنا عن أي طبق غير موجود في القائمة',
    allergyLabel: 'هل يوجد حساسية من أي نوع؟',
    allergyPlaceholder: 'يرجى تحديد نوع الحساسية',
    submit: 'إرسال تفضيلات الضيافة',
    thankYouTitle: 'شكرًا لك',
    thankYouBody: 'تم استلام تفضيلات الضيافة الخاصة بك. سيتولى فريقنا الباقي.',
    invalidLink: 'رابط الضيافة هذا غير صالح أو منتهي الصلاحية. يرجى التواصل مع Private Fleet Services مباشرة.',
    pickOrDescribe: 'يرجى اختيار شيء من القائمة، أو إخبارنا بما تريد',
    specifyAllergy: 'يرجى تحديد نوع الحساسية',
    submitFailed: 'تعذر إرسال الطلب',
  },
};

export default function PublicCateringForm() {
  const { flightId } = useParams<{ flightId: string }>();
  const [lang, setLang] = useState<Lang>('en');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<MenuSectionId, string[]>>(EMPTY_SELECTION);
  const [activeSection, setActiveSection] = useState<MenuSectionId>(MENU_SECTIONS[0].id);
  const [extraRequest, setExtraRequest] = useState('');
  const [hasAllergies, setHasAllergies] = useState(false);
  const [allergyDetails, setAllergyDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const t = STRINGS[lang];
  const isRtl = lang === 'ar';
  const sectionLabel = (section: typeof MENU_SECTIONS[number]) => (isRtl ? section.labelAr : section.label);

  const { data: flight, isLoading: flightLoading } = useQuery({
    queryKey: ['catering-flight-summary', flightId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_catering_flight_summary', { _flight_id: flightId! });
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!flightId,
  });

  const active = MENU_SECTIONS.find((s) => s.id === activeSection) ?? MENU_SECTIONS[0];

  // While searching, look across every course; otherwise show the open one.
  const term = search.trim().toLowerCase();
  const visibleSections = useMemo(() => {
    if (!term) return [active];
    return MENU_SECTIONS
      .map((section) => ({ ...section, items: section.items.filter((item) => item[lang].toLowerCase().includes(term)) }))
      .filter((section) => section.items.length > 0);
  }, [term, active, lang]);

  const toggleDish = (section: MenuSectionId, dishEn: string) =>
    setSelected((prev) => ({
      ...prev,
      [section]: prev[section].includes(dishEn) ? prev[section].filter((d) => d !== dishEn) : [...prev[section], dishEn],
    }));

  const totalSelected = Object.values(selected).reduce((sum, list) => sum + list.length, 0);

  const submit = useMutation({
    mutationFn: async () => {
      const extra = extraRequest.trim();
      const selections = MENU_SECTIONS
        .filter((section) => selected[section.id].length > 0)
        .map((section) => ({ section: section.label, items: selected[section.id] }));
      if (selections.length === 0 && !extra) {
        throw new Error(t.pickOrDescribe);
      }
      if (hasAllergies && !allergyDetails.trim()) throw new Error(t.specifyAllergy);

      const { error } = await supabase.from('catering_requests').insert({
        flight_id: flightId!,
        passenger_id: null,
        diner_name: WHOLE_FLIGHT_DINER,
        selections: selections.length > 0 ? selections : null,
        custom_request: extra || null,
        has_allergies: hasAllergies,
        allergy_details: hasAllergies ? allergyDetails.trim() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : t.submitFailed),
  });

  const LangToggle = (
    <div className="flex items-center gap-1 rounded-full border bg-card p-1 text-xs font-medium">
      <button
        type="button"
        onClick={() => setLang('en')}
        className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors', lang === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
      >
        <Languages className="h-3 w-3" />
        English
      </button>
      <button
        type="button"
        onClick={() => setLang('ar')}
        className={cn('rounded-full px-2.5 py-1 transition-colors font-arabic', lang === 'ar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
      >
        العربية
      </button>
    </div>
  );

  if (flightLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!flight) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8 space-y-4">
            <div className="flex justify-center">{LangToggle}</div>
            <p className={cn('text-muted-foreground', isRtl && 'font-arabic')} dir={isRtl ? 'rtl' : 'ltr'}>{t.invalidLink}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8 space-y-3" dir={isRtl ? 'rtl' : 'ltr'}>
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <h1 className={cn('text-lg font-semibold', isRtl && 'font-arabic')}>{t.thankYouTitle}</h1>
            <p className={cn('text-sm text-muted-foreground', isRtl && 'font-arabic')}>{t.thankYouBody}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 flex items-start justify-center" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className={cn('max-w-2xl w-full space-y-6 py-6 sm:py-8', isRtl && 'font-arabic')}>
        <div className="flex justify-end">{LangToggle}</div>

        <div className="flex flex-col items-center text-center gap-2">
          <img src={pfLogo} alt="Private Fleet Services" className="h-16 object-contain" />
          <h1 className="text-xl font-semibold">{t.pageTitle}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Plane className="h-4 w-4" />
            {flight.route_from} → {flight.route_to} · {format(new Date(flight.departure_date + 'T00:00:00'), 'MMM d, yyyy')}
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.menuTitle}</CardTitle>
            <CardDescription>{t.menuDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label={t.searchAria}
                placeholder={t.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
              />
            </div>

            {!term && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  {isRtl ? `جميع الأقسام (${MENU_SECTIONS.length})` : `All ${MENU_SECTIONS.length} courses`}
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {MENU_SECTIONS.map((section) => {
                    const isActive = section.id === activeSection;
                    const count = selected[section.id].length;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setActiveSection(section.id)}
                        className={cn(
                          'relative rounded-lg overflow-hidden border-2 text-start transition-colors',
                          isActive ? 'border-primary' : 'border-transparent'
                        )}
                      >
                        <img src={section.image} alt="" className="h-14 w-full object-cover" />
                        <span className={cn('block px-1.5 py-1 text-[11px] font-medium leading-tight', isActive ? 'bg-primary/10 text-primary' : 'bg-secondary/50')}>
                          {sectionLabel(section)}
                        </span>
                        {count > 0 && (
                          <span className="absolute top-1 end-1 rounded-full bg-primary text-primary-foreground text-[10px] leading-none px-1.5 py-0.5">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {totalSelected > 0 && (
              <div className="space-y-2 rounded-lg bg-secondary/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">{t.yourSelection}</p>
                {MENU_SECTIONS.filter((section) => selected[section.id].length > 0).map((section) => (
                  <div key={section.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold w-full sm:w-auto sm:min-w-24">{sectionLabel(section)}</span>
                    {selected[section.id].map((dishEn) => {
                      const item = section.items.find((i) => i.en === dishEn);
                      const label = item ? (isRtl ? item.ar : item.en) : dishEn;
                      return (
                        <button
                          key={dishEn}
                          type="button"
                          onClick={() => toggleDish(section.id, dishEn)}
                          className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-sm"
                          aria-label={isRtl ? `إزالة ${label}` : `Remove ${label}`}
                        >
                          {label}
                          <X className="h-3.5 w-3.5" />
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border overflow-hidden">
              {!term && (
                <img src={active.image} alt="" className="w-full h-28 object-cover" />
              )}
              <div className="max-h-72 overflow-y-auto">
                {visibleSections.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">
                    {isRtl
                      ? `لا يوجد في القائمة ما يطابق "${search}" — يرجى وصفه في الحقل أدناه.`
                      : `Nothing on the menu matches "${search}" — describe it in the box below.`}
                  </p>
                ) : (
                  visibleSections.map((section) => (
                    <div key={section.id}>
                      {term && (
                        <p className="sticky top-0 bg-secondary/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {sectionLabel(section)}
                        </p>
                      )}
                      <div className="divide-y">
                        {section.items.map((item) => {
                          const isSelected = selected[section.id].includes(item.en);
                          const label = isRtl ? item.ar : item.en;
                          return (
                            <button
                              key={item.en}
                              type="button"
                              onClick={() => toggleDish(section.id, item.en)}
                              className={cn(
                                'w-full flex items-center justify-between gap-3 px-4 py-2.5 text-start text-sm hover:bg-secondary/60',
                                isSelected && 'bg-primary/5 font-medium'
                              )}
                            >
                              {label}
                              {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="extra-request">{t.extraLabel}</Label>
              <Textarea
                id="extra-request"
                placeholder={t.extraPlaceholder}
                value={extraRequest}
                onChange={(e) => setExtraRequest(e.target.value)}
                dir={isRtl ? 'rtl' : 'ltr'}
              />
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <Checkbox
                  checked={hasAllergies}
                  onCheckedChange={(c) => {
                    setHasAllergies(c === true);
                    if (c !== true) setAllergyDetails('');
                  }}
                />
                {t.allergyLabel}
              </label>
              {hasAllergies && (
                <Input
                  placeholder={t.allergyPlaceholder}
                  value={allergyDetails}
                  onChange={(e) => setAllergyDetails(e.target.value)}
                  dir={isRtl ? 'rtl' : 'ltr'}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" size="lg" onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
          {t.submit}
        </Button>
      </div>
    </div>
  );
}
