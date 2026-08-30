// Shared choices for the Add/Edit Aircraft Option forms.

export const AIRCRAFT_CATEGORIES = [
  'Very Light Jet',
  'Light Jet',
  'Midsize Jet',
  'Super-Midsize Jet',
  'Heavy Jet',
  'VIP Airliner',
] as const;

export const AIRCRAFT_MANUFACTURERS = [
  'Gulfstream',
  'Bombardier',
  'Dassault Falcon',
  'Cessna (Citation)',
  'Embraer',
  'Hawker Beechcraft',
  'Learjet',
  'Pilatus',
  'Honda Aircraft',
  'Boeing Business Jets',
  'Airbus Corporate Jets',
] as const;

// Model (subtype) choices, scoped by manufacturer. A manufacturer with no
// entry here (or "Other") falls back to a free-text Model field.
export const AIRCRAFT_MODELS_BY_MANUFACTURER: Record<string, string[]> = {
  'Gulfstream': ['G280', 'G350', 'G450', 'G500', 'G550', 'G600', 'G650', 'G650ER', 'G700', 'G800'],
  'Bombardier': ['Challenger 350', 'Challenger 650', 'Global 5500', 'Global 6500', 'Global 7500', 'Global 8000'],
  'Dassault Falcon': ['Falcon 2000LXS', 'Falcon 900LX', 'Falcon 6X', 'Falcon 7X', 'Falcon 8X'],
  'Cessna (Citation)': ['Citation CJ3+', 'Citation CJ4', 'Citation XLS+', 'Citation Latitude', 'Citation Longitude', 'Citation Sovereign+'],
  'Embraer': ['Phenom 300E', 'Praetor 500', 'Praetor 600', 'Legacy 450', 'Legacy 500', 'Legacy 650E', 'Lineage 1000E'],
  'Hawker Beechcraft': ['Hawker 800XP', 'Hawker 900XP', 'Hawker 4000', 'King Air 350i'],
  'Learjet': ['Learjet 40XR', 'Learjet 45XR', 'Learjet 60XR', 'Learjet 70', 'Learjet 75'],
  'Pilatus': ['PC-12', 'PC-24'],
  'Honda Aircraft': ['HondaJet Elite', 'HondaJet Elite II'],
  'Boeing Business Jets': ['BBJ', 'BBJ MAX 7', 'BBJ MAX 8', 'BBJ MAX 9', 'BBJ 777X'],
  'Airbus Corporate Jets': ['ACJ319', 'ACJ320', 'ACJneo', 'ACJ330'],
};
