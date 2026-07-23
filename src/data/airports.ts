// Comprehensive list of major world airports with ICAO codes
export interface Airport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
}

export const AIRPORTS: Airport[] = [
  // United Arab Emirates
  { icao: 'OMDB', iata: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'UAE' },
  { icao: 'OMDW', iata: 'DWC', name: 'Al Maktoum International Airport', city: 'Dubai', country: 'UAE' },
  { icao: 'OMAA', iata: 'AUH', name: 'Abu Dhabi International Airport', city: 'Abu Dhabi', country: 'UAE' },
  { icao: 'OMSJ', iata: 'SHJ', name: 'Sharjah International Airport', city: 'Sharjah', country: 'UAE' },
  { icao: 'OMRK', iata: 'RKT', name: 'Ras Al Khaimah International Airport', city: 'Ras Al Khaimah', country: 'UAE' },
  { icao: 'OMFJ', iata: 'FJR', name: 'Fujairah International Airport', city: 'Fujairah', country: 'UAE' },
  { icao: 'OMAL', iata: 'AAN', name: 'Al Ain International Airport', city: 'Al Ain', country: 'UAE' },

  // Saudi Arabia
  { icao: 'OERK', iata: 'RUH', name: 'King Khalid International Airport', city: 'Riyadh', country: 'Saudi Arabia' },
  { icao: 'OEJN', iata: 'JED', name: 'King Abdulaziz International Airport', city: 'Jeddah', country: 'Saudi Arabia' },
  { icao: 'OEDF', iata: 'DMM', name: 'King Fahd International Airport', city: 'Dammam', country: 'Saudi Arabia' },
  { icao: 'OEMA', iata: 'MED', name: 'Prince Mohammad Bin Abdulaziz Airport', city: 'Medina', country: 'Saudi Arabia' },
  { icao: 'OERR', iata: 'RAE', name: 'Arar Domestic Airport', city: 'Arar', country: 'Saudi Arabia' },
  { icao: 'OEGS', iata: 'GIZ', name: 'Jazan Airport', city: 'Jazan', country: 'Saudi Arabia' },
  { icao: 'OETF', iata: 'TIF', name: 'Taif Regional Airport', city: 'Taif', country: 'Saudi Arabia' },
  { icao: 'OEAB', iata: 'ABT', name: 'Al-Baha Domestic Airport', city: 'Al-Baha', country: 'Saudi Arabia' },

  // Qatar
  { icao: 'OTHH', iata: 'DOH', name: 'Hamad International Airport', city: 'Doha', country: 'Qatar' },

  // Bahrain
  { icao: 'OBBI', iata: 'BAH', name: 'Bahrain International Airport', city: 'Manama', country: 'Bahrain' },

  // Kuwait
  { icao: 'OKBK', iata: 'KWI', name: 'Kuwait International Airport', city: 'Kuwait City', country: 'Kuwait' },

  // Oman
  { icao: 'OOMS', iata: 'MCT', name: 'Muscat International Airport', city: 'Muscat', country: 'Oman' },
  { icao: 'OOSA', iata: 'SLL', name: 'Salalah Airport', city: 'Salalah', country: 'Oman' },

  // United Kingdom
  { icao: 'EGLL', iata: 'LHR', name: 'Heathrow Airport', city: 'London', country: 'UK' },
  { icao: 'EGKK', iata: 'LGW', name: 'Gatwick Airport', city: 'London', country: 'UK' },
  { icao: 'EGSS', iata: 'STN', name: 'Stansted Airport', city: 'London', country: 'UK' },
  { icao: 'EGLC', iata: 'LCY', name: 'London City Airport', city: 'London', country: 'UK' },
  { icao: 'EGBB', iata: 'BHX', name: 'Birmingham Airport', city: 'Birmingham', country: 'UK' },
  { icao: 'EGCC', iata: 'MAN', name: 'Manchester Airport', city: 'Manchester', country: 'UK' },
  { icao: 'EGGP', iata: 'LPL', name: 'Liverpool John Lennon Airport', city: 'Liverpool', country: 'UK' },
  { icao: 'EGPH', iata: 'EDI', name: 'Edinburgh Airport', city: 'Edinburgh', country: 'UK' },
  { icao: 'EGPF', iata: 'GLA', name: 'Glasgow Airport', city: 'Glasgow', country: 'UK' },
  { icao: 'EGGD', iata: 'BRS', name: 'Bristol Airport', city: 'Bristol', country: 'UK' },
  { icao: 'EGNX', iata: 'EMA', name: 'East Midlands Airport', city: 'East Midlands', country: 'UK' },
  { icao: 'EGNT', iata: 'NCL', name: 'Newcastle Airport', city: 'Newcastle', country: 'UK' },
  { icao: 'EGNM', iata: 'LBA', name: 'Leeds Bradford Airport', city: 'Leeds', country: 'UK' },
  { icao: 'EGGW', iata: 'LTN', name: 'London Luton Airport', city: 'London', country: 'UK' },
  { icao: 'EGHI', iata: 'SOU', name: 'Southampton Airport', city: 'Southampton', country: 'UK' },
  { icao: 'EGHH', iata: 'BOH', name: 'Bournemouth Airport', city: 'Bournemouth', country: 'UK' },
  { icao: 'EGKB', iata: 'BQH', name: 'Biggin Hill Airport', city: 'London', country: 'UK' },
  { icao: 'EGTK', iata: 'OXF', name: 'Oxford Airport', city: 'Oxford', country: 'UK' },
  { icao: 'EGBJ', iata: 'GLO', name: 'Gloucestershire Airport', city: 'Gloucester', country: 'UK' },
  { icao: 'EGTF', iata: 'FAB', name: 'Farnborough Airport', city: 'Farnborough', country: 'UK' },

  // France
  { icao: 'LFPG', iata: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France' },
  { icao: 'LFPO', iata: 'ORY', name: 'Orly Airport', city: 'Paris', country: 'France' },
  { icao: 'LFPB', iata: 'LBG', name: 'Paris-Le Bourget Airport', city: 'Paris', country: 'France' },
  { icao: 'LFML', iata: 'MRS', name: 'Marseille Provence Airport', city: 'Marseille', country: 'France' },
  { icao: 'LFLL', iata: 'LYS', name: 'Lyon-Saint Exupéry Airport', city: 'Lyon', country: 'France' },
  { icao: 'LFMN', iata: 'NCE', name: 'Nice Côte d\'Azur Airport', city: 'Nice', country: 'France' },
  { icao: 'LFBD', iata: 'BOD', name: 'Bordeaux-Mérignac Airport', city: 'Bordeaux', country: 'France' },
  { icao: 'LFBO', iata: 'TLS', name: 'Toulouse-Blagnac Airport', city: 'Toulouse', country: 'France' },
  { icao: 'LFSB', iata: 'BSL', name: 'EuroAirport Basel-Mulhouse-Freiburg', city: 'Basel/Mulhouse', country: 'France' },
  { icao: 'LFRS', iata: 'NTE', name: 'Nantes Atlantique Airport', city: 'Nantes', country: 'France' },
  { icao: 'LFMD', iata: 'CEQ', name: 'Cannes-Mandelieu Airport', city: 'Cannes', country: 'France' },
  { icao: 'LFTZ', iata: 'LTT', name: 'La Môle – Saint-Tropez Airport', city: 'Saint-Tropez', country: 'France' },

  // Germany
  { icao: 'EDDF', iata: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany' },
  { icao: 'EDDM', iata: 'MUC', name: 'Munich Airport', city: 'Munich', country: 'Germany' },
  { icao: 'EDDB', iata: 'BER', name: 'Berlin Brandenburg Airport', city: 'Berlin', country: 'Germany' },
  { icao: 'EDDL', iata: 'DUS', name: 'Düsseldorf Airport', city: 'Düsseldorf', country: 'Germany' },
  { icao: 'EDDH', iata: 'HAM', name: 'Hamburg Airport', city: 'Hamburg', country: 'Germany' },
  { icao: 'EDDK', iata: 'CGN', name: 'Cologne Bonn Airport', city: 'Cologne', country: 'Germany' },
  { icao: 'EDDS', iata: 'STR', name: 'Stuttgart Airport', city: 'Stuttgart', country: 'Germany' },
  { icao: 'EDDV', iata: 'HAJ', name: 'Hannover Airport', city: 'Hannover', country: 'Germany' },
  { icao: 'EDDP', iata: 'LEJ', name: 'Leipzig/Halle Airport', city: 'Leipzig', country: 'Germany' },
  { icao: 'EDDN', iata: 'NUE', name: 'Nuremberg Airport', city: 'Nuremberg', country: 'Germany' },
  { icao: 'EDDW', iata: 'BRE', name: 'Bremen Airport', city: 'Bremen', country: 'Germany' },

  // Switzerland
  { icao: 'LSZH', iata: 'ZRH', name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland' },
  { icao: 'LSGG', iata: 'GVA', name: 'Geneva Airport', city: 'Geneva', country: 'Switzerland' },
  { icao: 'LSZB', iata: 'BRN', name: 'Bern Airport', city: 'Bern', country: 'Switzerland' },
  { icao: 'LSZA', iata: 'LUG', name: 'Lugano Airport', city: 'Lugano', country: 'Switzerland' },
  { icao: 'LSZS', iata: 'SMV', name: 'Samedan Airport', city: 'St. Moritz', country: 'Switzerland' },

  // Italy
  { icao: 'LIRF', iata: 'FCO', name: 'Leonardo da Vinci–Fiumicino Airport', city: 'Rome', country: 'Italy' },
  { icao: 'LIMC', iata: 'MXP', name: 'Milan Malpensa Airport', city: 'Milan', country: 'Italy' },
  { icao: 'LIME', iata: 'BGY', name: 'Milan Bergamo Airport', city: 'Milan', country: 'Italy' },
  { icao: 'LIML', iata: 'LIN', name: 'Milan Linate Airport', city: 'Milan', country: 'Italy' },
  { icao: 'LIPZ', iata: 'VCE', name: 'Venice Marco Polo Airport', city: 'Venice', country: 'Italy' },
  { icao: 'LIRN', iata: 'NAP', name: 'Naples International Airport', city: 'Naples', country: 'Italy' },
  { icao: 'LIPE', iata: 'BLQ', name: 'Bologna Guglielmo Marconi Airport', city: 'Bologna', country: 'Italy' },
  { icao: 'LIRQ', iata: 'FLR', name: 'Florence Airport', city: 'Florence', country: 'Italy' },
  { icao: 'LIEE', iata: 'CAG', name: 'Cagliari Elmas Airport', city: 'Cagliari', country: 'Italy' },
  { icao: 'LICJ', iata: 'PMO', name: 'Falcone–Borsellino Airport', city: 'Palermo', country: 'Italy' },
  { icao: 'LICC', iata: 'CTA', name: 'Catania–Fontanarossa Airport', city: 'Catania', country: 'Italy' },
  { icao: 'LIPX', iata: 'VRN', name: 'Verona Villafranca Airport', city: 'Verona', country: 'Italy' },
  { icao: 'LIPH', iata: 'TSF', name: 'Treviso Airport', city: 'Treviso', country: 'Italy' },
  { icao: 'LIRA', iata: 'CIA', name: 'Rome Ciampino Airport', city: 'Rome', country: 'Italy' },
  { icao: 'LIRP', iata: 'PSA', name: 'Pisa International Airport', city: 'Pisa', country: 'Italy' },

  // Spain
  { icao: 'LEMD', iata: 'MAD', name: 'Adolfo Suárez Madrid–Barajas Airport', city: 'Madrid', country: 'Spain' },
  { icao: 'LEBL', iata: 'BCN', name: 'Barcelona–El Prat Airport', city: 'Barcelona', country: 'Spain' },
  { icao: 'LEPA', iata: 'PMI', name: 'Palma de Mallorca Airport', city: 'Palma de Mallorca', country: 'Spain' },
  { icao: 'LEMG', iata: 'AGP', name: 'Málaga Airport', city: 'Málaga', country: 'Spain' },
  { icao: 'LEVC', iata: 'VLC', name: 'Valencia Airport', city: 'Valencia', country: 'Spain' },
  { icao: 'LEAL', iata: 'ALC', name: 'Alicante–Elche Airport', city: 'Alicante', country: 'Spain' },
  { icao: 'LEZL', iata: 'SVQ', name: 'Seville Airport', city: 'Seville', country: 'Spain' },
  { icao: 'LEBB', iata: 'BIO', name: 'Bilbao Airport', city: 'Bilbao', country: 'Spain' },
  { icao: 'GCTS', iata: 'TFS', name: 'Tenerife South Airport', city: 'Tenerife', country: 'Spain' },
  { icao: 'GCXO', iata: 'TFN', name: 'Tenerife North Airport', city: 'Tenerife', country: 'Spain' },
  { icao: 'GCLP', iata: 'LPA', name: 'Gran Canaria Airport', city: 'Gran Canaria', country: 'Spain' },
  { icao: 'GCRR', iata: 'ACE', name: 'Lanzarote Airport', city: 'Lanzarote', country: 'Spain' },
  { icao: 'GCFV', iata: 'FUE', name: 'Fuerteventura Airport', city: 'Fuerteventura', country: 'Spain' },
  { icao: 'LEIB', iata: 'IBZ', name: 'Ibiza Airport', city: 'Ibiza', country: 'Spain' },
  { icao: 'LEMH', iata: 'MAH', name: 'Menorca Airport', city: 'Menorca', country: 'Spain' },

  // Portugal
  { icao: 'LPPT', iata: 'LIS', name: 'Lisbon Airport', city: 'Lisbon', country: 'Portugal' },
  { icao: 'LPPR', iata: 'OPO', name: 'Porto Airport', city: 'Porto', country: 'Portugal' },
  { icao: 'LPFR', iata: 'FAO', name: 'Faro Airport', city: 'Faro', country: 'Portugal' },
  { icao: 'LPMA', iata: 'FNC', name: 'Madeira Airport', city: 'Funchal', country: 'Portugal' },
  { icao: 'LPAZ', iata: 'PDL', name: 'Ponta Delgada Airport', city: 'Ponta Delgada', country: 'Portugal' },

  // Netherlands
  { icao: 'EHAM', iata: 'AMS', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands' },
  { icao: 'EHRD', iata: 'RTM', name: 'Rotterdam The Hague Airport', city: 'Rotterdam', country: 'Netherlands' },
  { icao: 'EHEH', iata: 'EIN', name: 'Eindhoven Airport', city: 'Eindhoven', country: 'Netherlands' },

  // Belgium
  { icao: 'EBBR', iata: 'BRU', name: 'Brussels Airport', city: 'Brussels', country: 'Belgium' },
  { icao: 'EBCI', iata: 'CRL', name: 'Brussels South Charleroi Airport', city: 'Charleroi', country: 'Belgium' },
  { icao: 'EBAW', iata: 'ANR', name: 'Antwerp International Airport', city: 'Antwerp', country: 'Belgium' },

  // Austria
  { icao: 'LOWW', iata: 'VIE', name: 'Vienna International Airport', city: 'Vienna', country: 'Austria' },
  { icao: 'LOWS', iata: 'SZG', name: 'Salzburg Airport', city: 'Salzburg', country: 'Austria' },
  { icao: 'LOWG', iata: 'GRZ', name: 'Graz Airport', city: 'Graz', country: 'Austria' },
  { icao: 'LOWI', iata: 'INN', name: 'Innsbruck Airport', city: 'Innsbruck', country: 'Austria' },

  // Greece
  { icao: 'LGAV', iata: 'ATH', name: 'Athens International Airport', city: 'Athens', country: 'Greece' },
  { icao: 'LGTS', iata: 'SKG', name: 'Thessaloniki Airport', city: 'Thessaloniki', country: 'Greece' },
  { icao: 'LGIR', iata: 'HER', name: 'Heraklion Airport', city: 'Heraklion', country: 'Greece' },
  { icao: 'LGSR', iata: 'JTR', name: 'Santorini Airport', city: 'Santorini', country: 'Greece' },
  { icao: 'LGMK', iata: 'JMK', name: 'Mykonos Airport', city: 'Mykonos', country: 'Greece' },
  { icao: 'LGKR', iata: 'CFU', name: 'Corfu Airport', city: 'Corfu', country: 'Greece' },
  { icao: 'LGRP', iata: 'RHO', name: 'Rhodes International Airport', city: 'Rhodes', country: 'Greece' },
  { icao: 'LGKO', iata: 'KGS', name: 'Kos Airport', city: 'Kos', country: 'Greece' },

  // Turkey
  { icao: 'LTFM', iata: 'IST', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey' },
  { icao: 'LTFJ', iata: 'SAW', name: 'Sabiha Gökçen International Airport', city: 'Istanbul', country: 'Turkey' },
  { icao: 'LTAC', iata: 'ESB', name: 'Esenboğa International Airport', city: 'Ankara', country: 'Turkey' },
  { icao: 'LTBJ', iata: 'ADB', name: 'Adnan Menderes Airport', city: 'Izmir', country: 'Turkey' },
  { icao: 'LTAI', iata: 'AYT', name: 'Antalya Airport', city: 'Antalya', country: 'Turkey' },
  { icao: 'LTFE', iata: 'DLM', name: 'Dalaman Airport', city: 'Dalaman', country: 'Turkey' },
  { icao: 'LTBS', iata: 'BJV', name: 'Milas–Bodrum Airport', city: 'Bodrum', country: 'Turkey' },

  // Russia
  { icao: 'UUEE', iata: 'SVO', name: 'Sheremetyevo International Airport', city: 'Moscow', country: 'Russia' },
  { icao: 'UUDD', iata: 'DME', name: 'Domodedovo International Airport', city: 'Moscow', country: 'Russia' },
  { icao: 'UUWW', iata: 'VKO', name: 'Vnukovo International Airport', city: 'Moscow', country: 'Russia' },
  { icao: 'ULLI', iata: 'LED', name: 'Pulkovo Airport', city: 'St. Petersburg', country: 'Russia' },

  // United States
  { icao: 'KJFK', iata: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'USA' },
  { icao: 'KLGA', iata: 'LGA', name: 'LaGuardia Airport', city: 'New York', country: 'USA' },
  { icao: 'KEWR', iata: 'EWR', name: 'Newark Liberty International Airport', city: 'Newark', country: 'USA' },
  { icao: 'KTEB', iata: 'TEB', name: 'Teterboro Airport', city: 'Teterboro', country: 'USA' },
  { icao: 'KLAX', iata: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'USA' },
  { icao: 'KVNY', iata: 'VNY', name: 'Van Nuys Airport', city: 'Los Angeles', country: 'USA' },
  { icao: 'KSMO', iata: 'SMO', name: 'Santa Monica Airport', city: 'Santa Monica', country: 'USA' },
  { icao: 'KSFO', iata: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'USA' },
  { icao: 'KOAK', iata: 'OAK', name: 'Oakland International Airport', city: 'Oakland', country: 'USA' },
  { icao: 'KSJC', iata: 'SJC', name: 'San Jose International Airport', city: 'San Jose', country: 'USA' },
  { icao: 'KORD', iata: 'ORD', name: 'O\'Hare International Airport', city: 'Chicago', country: 'USA' },
  { icao: 'KMDW', iata: 'MDW', name: 'Midway International Airport', city: 'Chicago', country: 'USA' },
  { icao: 'KDFW', iata: 'DFW', name: 'Dallas/Fort Worth International Airport', city: 'Dallas', country: 'USA' },
  { icao: 'KIAH', iata: 'IAH', name: 'George Bush Intercontinental Airport', city: 'Houston', country: 'USA' },
  { icao: 'KHOU', iata: 'HOU', name: 'William P. Hobby Airport', city: 'Houston', country: 'USA' },
  { icao: 'KMIA', iata: 'MIA', name: 'Miami International Airport', city: 'Miami', country: 'USA' },
  { icao: 'KOPF', iata: 'OPF', name: 'Miami-Opa Locka Executive Airport', city: 'Miami', country: 'USA' },
  { icao: 'KFLL', iata: 'FLL', name: 'Fort Lauderdale-Hollywood International Airport', city: 'Fort Lauderdale', country: 'USA' },
  { icao: 'KFXE', iata: 'FXE', name: 'Fort Lauderdale Executive Airport', city: 'Fort Lauderdale', country: 'USA' },
  { icao: 'KPBI', iata: 'PBI', name: 'Palm Beach International Airport', city: 'West Palm Beach', country: 'USA' },
  { icao: 'KATL', iata: 'ATL', name: 'Hartsfield-Jackson Atlanta International Airport', city: 'Atlanta', country: 'USA' },
  { icao: 'KPDX', iata: 'PDK', name: 'DeKalb-Peachtree Airport', city: 'Atlanta', country: 'USA' },
  { icao: 'KDEN', iata: 'DEN', name: 'Denver International Airport', city: 'Denver', country: 'USA' },
  { icao: 'KAPA', iata: 'APA', name: 'Centennial Airport', city: 'Denver', country: 'USA' },
  { icao: 'KSEA', iata: 'SEA', name: 'Seattle-Tacoma International Airport', city: 'Seattle', country: 'USA' },
  { icao: 'KBFI', iata: 'BFI', name: 'Boeing Field', city: 'Seattle', country: 'USA' },
  { icao: 'KBOS', iata: 'BOS', name: 'Boston Logan International Airport', city: 'Boston', country: 'USA' },
  { icao: 'KBED', iata: 'BED', name: 'Laurence G. Hanscom Field', city: 'Boston', country: 'USA' },
  { icao: 'KLAS', iata: 'LAS', name: 'Harry Reid International Airport', city: 'Las Vegas', country: 'USA' },
  { icao: 'KVGT', iata: 'VGT', name: 'North Las Vegas Airport', city: 'Las Vegas', country: 'USA' },
  { icao: 'KHND', iata: 'HND', name: 'Henderson Executive Airport', city: 'Las Vegas', country: 'USA' },
  { icao: 'KPHX', iata: 'PHX', name: 'Phoenix Sky Harbor International Airport', city: 'Phoenix', country: 'USA' },
  { icao: 'KSAN', iata: 'SAN', name: 'San Diego International Airport', city: 'San Diego', country: 'USA' },
  { icao: 'KPHL', iata: 'PHL', name: 'Philadelphia International Airport', city: 'Philadelphia', country: 'USA' },
  { icao: 'KDCA', iata: 'DCA', name: 'Ronald Reagan Washington National Airport', city: 'Washington D.C.', country: 'USA' },
  { icao: 'KIAD', iata: 'IAD', name: 'Washington Dulles International Airport', city: 'Washington D.C.', country: 'USA' },
  { icao: 'KMSP', iata: 'MSP', name: 'Minneapolis–Saint Paul International Airport', city: 'Minneapolis', country: 'USA' },
  { icao: 'KDTW', iata: 'DTW', name: 'Detroit Metropolitan Airport', city: 'Detroit', country: 'USA' },
  { icao: 'KORL', iata: 'ORL', name: 'Orlando Executive Airport', city: 'Orlando', country: 'USA' },
  { icao: 'KMCO', iata: 'MCO', name: 'Orlando International Airport', city: 'Orlando', country: 'USA' },
  { icao: 'KTPA', iata: 'TPA', name: 'Tampa International Airport', city: 'Tampa', country: 'USA' },
  { icao: 'KCLT', iata: 'CLT', name: 'Charlotte Douglas International Airport', city: 'Charlotte', country: 'USA' },
  { icao: 'KRDU', iata: 'RDU', name: 'Raleigh-Durham International Airport', city: 'Raleigh', country: 'USA' },
  { icao: 'KBNA', iata: 'BNA', name: 'Nashville International Airport', city: 'Nashville', country: 'USA' },
  { icao: 'KSLC', iata: 'SLC', name: 'Salt Lake City International Airport', city: 'Salt Lake City', country: 'USA' },
  { icao: 'KHNL', iata: 'HNL', name: 'Daniel K. Inouye International Airport', city: 'Honolulu', country: 'USA' },
  { icao: 'PANC', iata: 'ANC', name: 'Ted Stevens Anchorage International Airport', city: 'Anchorage', country: 'USA' },
  { icao: 'KASE', iata: 'ASE', name: 'Aspen/Pitkin County Airport', city: 'Aspen', country: 'USA' },
  { icao: 'KEGE', iata: 'EGE', name: 'Eagle County Regional Airport', city: 'Vail', country: 'USA' },

  // Canada
  { icao: 'CYYZ', iata: 'YYZ', name: 'Toronto Pearson International Airport', city: 'Toronto', country: 'Canada' },
  { icao: 'CYUL', iata: 'YUL', name: 'Montréal–Pierre Elliott Trudeau International Airport', city: 'Montreal', country: 'Canada' },
  { icao: 'CYVR', iata: 'YVR', name: 'Vancouver International Airport', city: 'Vancouver', country: 'Canada' },
  { icao: 'CYYC', iata: 'YYC', name: 'Calgary International Airport', city: 'Calgary', country: 'Canada' },
  { icao: 'CYEG', iata: 'YEG', name: 'Edmonton International Airport', city: 'Edmonton', country: 'Canada' },
  { icao: 'CYOW', iata: 'YOW', name: 'Ottawa Macdonald-Cartier International Airport', city: 'Ottawa', country: 'Canada' },
  { icao: 'CYWG', iata: 'YWG', name: 'Winnipeg James Armstrong Richardson International Airport', city: 'Winnipeg', country: 'Canada' },
  { icao: 'CYHZ', iata: 'YHZ', name: 'Halifax Stanfield International Airport', city: 'Halifax', country: 'Canada' },

  // Mexico
  { icao: 'MMMX', iata: 'MEX', name: 'Mexico City International Airport', city: 'Mexico City', country: 'Mexico' },
  { icao: 'MMUN', iata: 'CUN', name: 'Cancún International Airport', city: 'Cancún', country: 'Mexico' },
  { icao: 'MMGL', iata: 'GDL', name: 'Guadalajara International Airport', city: 'Guadalajara', country: 'Mexico' },
  { icao: 'MMTJ', iata: 'TIJ', name: 'Tijuana International Airport', city: 'Tijuana', country: 'Mexico' },
  { icao: 'MMSD', iata: 'SJD', name: 'Los Cabos International Airport', city: 'San José del Cabo', country: 'Mexico' },
  { icao: 'MMPR', iata: 'PVR', name: 'Puerto Vallarta International Airport', city: 'Puerto Vallarta', country: 'Mexico' },

  // Caribbean
  { icao: 'TNCM', iata: 'SXM', name: 'Princess Juliana International Airport', city: 'Sint Maarten', country: 'Sint Maarten' },
  { icao: 'TFFR', iata: 'PTP', name: 'Pointe-à-Pitre International Airport', city: 'Guadeloupe', country: 'Guadeloupe' },
  { icao: 'TFFF', iata: 'FDF', name: 'Martinique Aimé Césaire International Airport', city: 'Martinique', country: 'Martinique' },
  { icao: 'TIST', iata: 'STT', name: 'Cyril E. King Airport', city: 'St. Thomas', country: 'US Virgin Islands' },
  { icao: 'TBPB', iata: 'BGI', name: 'Grantley Adams International Airport', city: 'Bridgetown', country: 'Barbados' },
  { icao: 'MKJS', iata: 'MBJ', name: 'Sangster International Airport', city: 'Montego Bay', country: 'Jamaica' },
  { icao: 'MKJP', iata: 'KIN', name: 'Norman Manley International Airport', city: 'Kingston', country: 'Jamaica' },
  { icao: 'MYNN', iata: 'NAS', name: 'Lynden Pindling International Airport', city: 'Nassau', country: 'Bahamas' },
  { icao: 'TNCA', iata: 'AUA', name: 'Queen Beatrix International Airport', city: 'Oranjestad', country: 'Aruba' },
  { icao: 'TNCC', iata: 'CUR', name: 'Curaçao International Airport', city: 'Willemstad', country: 'Curaçao' },
  { icao: 'TNCB', iata: 'BON', name: 'Flamingo International Airport', city: 'Kralendijk', country: 'Bonaire' },
  { icao: 'TUPJ', iata: 'EIS', name: 'Terrance B. Lettsome International Airport', city: 'Tortola', country: 'British Virgin Islands' },
  { icao: 'TAPA', iata: 'ANU', name: 'V.C. Bird International Airport', city: 'St. John\'s', country: 'Antigua and Barbuda' },
  { icao: 'TLPC', iata: 'SLU', name: 'George F. L. Charles Airport', city: 'Castries', country: 'Saint Lucia' },
  { icao: 'TLPL', iata: 'UVF', name: 'Hewanorra International Airport', city: 'Vieux Fort', country: 'Saint Lucia' },

  // South America
  { icao: 'SBGR', iata: 'GRU', name: 'São Paulo/Guarulhos International Airport', city: 'São Paulo', country: 'Brazil' },
  { icao: 'SBGL', iata: 'GIG', name: 'Rio de Janeiro/Galeão International Airport', city: 'Rio de Janeiro', country: 'Brazil' },
  { icao: 'SBBR', iata: 'BSB', name: 'Brasília International Airport', city: 'Brasília', country: 'Brazil' },
  { icao: 'SAEZ', iata: 'EZE', name: 'Ministro Pistarini International Airport', city: 'Buenos Aires', country: 'Argentina' },
  { icao: 'SABE', iata: 'AEP', name: 'Jorge Newbery Airfield', city: 'Buenos Aires', country: 'Argentina' },
  { icao: 'SCEL', iata: 'SCL', name: 'Arturo Merino Benítez International Airport', city: 'Santiago', country: 'Chile' },
  { icao: 'SPJC', iata: 'LIM', name: 'Jorge Chávez International Airport', city: 'Lima', country: 'Peru' },
  { icao: 'SKBO', iata: 'BOG', name: 'El Dorado International Airport', city: 'Bogotá', country: 'Colombia' },
  { icao: 'SEQM', iata: 'UIO', name: 'Mariscal Sucre International Airport', city: 'Quito', country: 'Ecuador' },
  { icao: 'SVMI', iata: 'CCS', name: 'Simón Bolívar International Airport', city: 'Caracas', country: 'Venezuela' },
  { icao: 'SUMU', iata: 'MVD', name: 'Carrasco International Airport', city: 'Montevideo', country: 'Uruguay' },
  { icao: 'SGAS', iata: 'ASU', name: 'Silvio Pettirossi International Airport', city: 'Asunción', country: 'Paraguay' },
  { icao: 'SLVR', iata: 'VVI', name: 'Viru Viru International Airport', city: 'Santa Cruz', country: 'Bolivia' },

  // Asia - India
  { icao: 'VIDP', iata: 'DEL', name: 'Indira Gandhi International Airport', city: 'Delhi', country: 'India' },
  { icao: 'VABB', iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj International Airport', city: 'Mumbai', country: 'India' },
  { icao: 'VOBL', iata: 'BLR', name: 'Kempegowda International Airport', city: 'Bengaluru', country: 'India' },
  { icao: 'VOMM', iata: 'MAA', name: 'Chennai International Airport', city: 'Chennai', country: 'India' },
  { icao: 'VECC', iata: 'CCU', name: 'Netaji Subhas Chandra Bose International Airport', city: 'Kolkata', country: 'India' },
  { icao: 'VOHS', iata: 'HYD', name: 'Rajiv Gandhi International Airport', city: 'Hyderabad', country: 'India' },
  { icao: 'VAAH', iata: 'AMD', name: 'Sardar Vallabhbhai Patel International Airport', city: 'Ahmedabad', country: 'India' },
  { icao: 'VOCL', iata: 'COK', name: 'Cochin International Airport', city: 'Kochi', country: 'India' },
  { icao: 'VOGO', iata: 'GOI', name: 'Goa International Airport', city: 'Goa', country: 'India' },

  // Asia - China
  { icao: 'ZBAA', iata: 'PEK', name: 'Beijing Capital International Airport', city: 'Beijing', country: 'China' },
  { icao: 'ZSPD', iata: 'PVG', name: 'Shanghai Pudong International Airport', city: 'Shanghai', country: 'China' },
  { icao: 'ZSSS', iata: 'SHA', name: 'Shanghai Hongqiao International Airport', city: 'Shanghai', country: 'China' },
  { icao: 'ZGGG', iata: 'CAN', name: 'Guangzhou Baiyun International Airport', city: 'Guangzhou', country: 'China' },
  { icao: 'ZGSZ', iata: 'SZX', name: 'Shenzhen Bao\'an International Airport', city: 'Shenzhen', country: 'China' },
  { icao: 'ZUUU', iata: 'CTU', name: 'Chengdu Shuangliu International Airport', city: 'Chengdu', country: 'China' },
  { icao: 'ZHCC', iata: 'CGO', name: 'Zhengzhou Xinzheng International Airport', city: 'Zhengzhou', country: 'China' },
  { icao: 'ZLXY', iata: 'XIY', name: 'Xi\'an Xianyang International Airport', city: 'Xi\'an', country: 'China' },
  { icao: 'ZUCK', iata: 'CKG', name: 'Chongqing Jiangbei International Airport', city: 'Chongqing', country: 'China' },
  { icao: 'ZPPP', iata: 'KMG', name: 'Kunming Changshui International Airport', city: 'Kunming', country: 'China' },
  { icao: 'ZSAM', iata: 'XMN', name: 'Xiamen Gaoqi International Airport', city: 'Xiamen', country: 'China' },
  { icao: 'ZBTJ', iata: 'TSN', name: 'Tianjin Binhai International Airport', city: 'Tianjin', country: 'China' },
  { icao: 'ZSNJ', iata: 'NKG', name: 'Nanjing Lukou International Airport', city: 'Nanjing', country: 'China' },
  { icao: 'ZSHC', iata: 'HGH', name: 'Hangzhou Xiaoshan International Airport', city: 'Hangzhou', country: 'China' },
  { icao: 'ZWWW', iata: 'URC', name: 'Ürümqi Diwopu International Airport', city: 'Ürümqi', country: 'China' },

  // Asia - Hong Kong, Macau, Taiwan
  { icao: 'VHHH', iata: 'HKG', name: 'Hong Kong International Airport', city: 'Hong Kong', country: 'Hong Kong' },
  { icao: 'VMMC', iata: 'MFM', name: 'Macau International Airport', city: 'Macau', country: 'Macau' },
  { icao: 'RCTP', iata: 'TPE', name: 'Taiwan Taoyuan International Airport', city: 'Taipei', country: 'Taiwan' },
  { icao: 'RCSS', iata: 'TSA', name: 'Taipei Songshan Airport', city: 'Taipei', country: 'Taiwan' },
  { icao: 'RCMQ', iata: 'RMQ', name: 'Taichung Airport', city: 'Taichung', country: 'Taiwan' },
  { icao: 'RCKH', iata: 'KHH', name: 'Kaohsiung International Airport', city: 'Kaohsiung', country: 'Taiwan' },

  // Asia - Japan
  { icao: 'RJTT', iata: 'HND', name: 'Tokyo Haneda Airport', city: 'Tokyo', country: 'Japan' },
  { icao: 'RJAA', iata: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'Japan' },
  { icao: 'RJBB', iata: 'KIX', name: 'Kansai International Airport', city: 'Osaka', country: 'Japan' },
  { icao: 'RJOO', iata: 'ITM', name: 'Osaka Itami Airport', city: 'Osaka', country: 'Japan' },
  { icao: 'RJGG', iata: 'NGO', name: 'Chubu Centrair International Airport', city: 'Nagoya', country: 'Japan' },
  { icao: 'RJCC', iata: 'CTS', name: 'New Chitose Airport', city: 'Sapporo', country: 'Japan' },
  { icao: 'RJFF', iata: 'FUK', name: 'Fukuoka Airport', city: 'Fukuoka', country: 'Japan' },
  { icao: 'ROAH', iata: 'OKA', name: 'Naha Airport', city: 'Okinawa', country: 'Japan' },

  // Asia - South Korea
  { icao: 'RKSI', iata: 'ICN', name: 'Incheon International Airport', city: 'Seoul', country: 'South Korea' },
  { icao: 'RKSS', iata: 'GMP', name: 'Gimpo International Airport', city: 'Seoul', country: 'South Korea' },
  { icao: 'RKPK', iata: 'PUS', name: 'Gimhae International Airport', city: 'Busan', country: 'South Korea' },
  { icao: 'RKPC', iata: 'CJU', name: 'Jeju International Airport', city: 'Jeju', country: 'South Korea' },

  // Asia - Southeast Asia
  { icao: 'WSSS', iata: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore' },
  { icao: 'WSSL', iata: 'XSP', name: 'Seletar Airport', city: 'Singapore', country: 'Singapore' },
  { icao: 'WMKK', iata: 'KUL', name: 'Kuala Lumpur International Airport', city: 'Kuala Lumpur', country: 'Malaysia' },
  { icao: 'WMSA', iata: 'SZB', name: 'Sultan Abdul Aziz Shah Airport', city: 'Kuala Lumpur', country: 'Malaysia' },
  { icao: 'WMKP', iata: 'PEN', name: 'Penang International Airport', city: 'Penang', country: 'Malaysia' },
  { icao: 'WMKL', iata: 'LGK', name: 'Langkawi International Airport', city: 'Langkawi', country: 'Malaysia' },
  { icao: 'WBKK', iata: 'BKI', name: 'Kota Kinabalu International Airport', city: 'Kota Kinabalu', country: 'Malaysia' },
  { icao: 'VTBS', iata: 'BKK', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand' },
  { icao: 'VTBD', iata: 'DMK', name: 'Don Mueang International Airport', city: 'Bangkok', country: 'Thailand' },
  { icao: 'VTSP', iata: 'HKT', name: 'Phuket International Airport', city: 'Phuket', country: 'Thailand' },
  { icao: 'VTSS', iata: 'HDY', name: 'Hat Yai International Airport', city: 'Hat Yai', country: 'Thailand' },
  { icao: 'VTSM', iata: 'USM', name: 'Samui Airport', city: 'Ko Samui', country: 'Thailand' },
  { icao: 'VTCC', iata: 'CNX', name: 'Chiang Mai International Airport', city: 'Chiang Mai', country: 'Thailand' },
  { icao: 'WIII', iata: 'CGK', name: 'Soekarno-Hatta International Airport', city: 'Jakarta', country: 'Indonesia' },
  { icao: 'WADD', iata: 'DPS', name: 'Ngurah Rai International Airport', city: 'Bali', country: 'Indonesia' },
  { icao: 'WARR', iata: 'SUB', name: 'Juanda International Airport', city: 'Surabaya', country: 'Indonesia' },
  { icao: 'WIMM', iata: 'KNO', name: 'Kualanamu International Airport', city: 'Medan', country: 'Indonesia' },
  { icao: 'RPLL', iata: 'MNL', name: 'Ninoy Aquino International Airport', city: 'Manila', country: 'Philippines' },
  { icao: 'RPMD', iata: 'DVO', name: 'Francisco Bangoy International Airport', city: 'Davao', country: 'Philippines' },
  { icao: 'RPMC', iata: 'CEB', name: 'Mactan-Cebu International Airport', city: 'Cebu', country: 'Philippines' },
  { icao: 'VVNB', iata: 'HAN', name: 'Noi Bai International Airport', city: 'Hanoi', country: 'Vietnam' },
  { icao: 'VVTS', iata: 'SGN', name: 'Tan Son Nhat International Airport', city: 'Ho Chi Minh City', country: 'Vietnam' },
  { icao: 'VVDN', iata: 'DAD', name: 'Da Nang International Airport', city: 'Da Nang', country: 'Vietnam' },
  { icao: 'VDPP', iata: 'PNH', name: 'Phnom Penh International Airport', city: 'Phnom Penh', country: 'Cambodia' },
  { icao: 'VDSR', iata: 'REP', name: 'Siem Reap International Airport', city: 'Siem Reap', country: 'Cambodia' },
  { icao: 'VRMM', iata: 'MLE', name: 'Velana International Airport', city: 'Malé', country: 'Maldives' },
  { icao: 'VCBI', iata: 'CMB', name: 'Bandaranaike International Airport', city: 'Colombo', country: 'Sri Lanka' },
  { icao: 'VYYY', iata: 'RGN', name: 'Yangon International Airport', city: 'Yangon', country: 'Myanmar' },

  // Africa
  { icao: 'FAOR', iata: 'JNB', name: 'O.R. Tambo International Airport', city: 'Johannesburg', country: 'South Africa' },
  { icao: 'FACT', iata: 'CPT', name: 'Cape Town International Airport', city: 'Cape Town', country: 'South Africa' },
  { icao: 'FALE', iata: 'DUR', name: 'King Shaka International Airport', city: 'Durban', country: 'South Africa' },
  { icao: 'HECA', iata: 'CAI', name: 'Cairo International Airport', city: 'Cairo', country: 'Egypt' },
  { icao: 'HESH', iata: 'SSH', name: 'Sharm el-Sheikh International Airport', city: 'Sharm el-Sheikh', country: 'Egypt' },
  { icao: 'HEGN', iata: 'HRG', name: 'Hurghada International Airport', city: 'Hurghada', country: 'Egypt' },
  { icao: 'DNMM', iata: 'LOS', name: 'Murtala Muhammed International Airport', city: 'Lagos', country: 'Nigeria' },
  { icao: 'DNAA', iata: 'ABV', name: 'Nnamdi Azikiwe International Airport', city: 'Abuja', country: 'Nigeria' },
  { icao: 'HKJK', iata: 'NBO', name: 'Jomo Kenyatta International Airport', city: 'Nairobi', country: 'Kenya' },
  { icao: 'HKMO', iata: 'MBA', name: 'Moi International Airport', city: 'Mombasa', country: 'Kenya' },
  { icao: 'HTDA', iata: 'DAR', name: 'Julius Nyerere International Airport', city: 'Dar es Salaam', country: 'Tanzania' },
  { icao: 'HTKJ', iata: 'JRO', name: 'Kilimanjaro International Airport', city: 'Kilimanjaro', country: 'Tanzania' },
  { icao: 'FMMI', iata: 'TNR', name: 'Ivato International Airport', city: 'Antananarivo', country: 'Madagascar' },
  { icao: 'FIMP', iata: 'MRU', name: 'Sir Seewoosagur Ramgoolam International Airport', city: 'Port Louis', country: 'Mauritius' },
  { icao: 'FMEP', iata: 'RUN', name: 'Roland Garros Airport', city: 'Saint-Denis', country: 'Réunion' },
  { icao: 'GOBD', iata: 'DSS', name: 'Blaise Diagne International Airport', city: 'Dakar', country: 'Senegal' },
  { icao: 'DIAP', iata: 'ABJ', name: 'Félix-Houphouët-Boigny International Airport', city: 'Abidjan', country: 'Ivory Coast' },
  { icao: 'DGAA', iata: 'ACC', name: 'Kotoka International Airport', city: 'Accra', country: 'Ghana' },
  { icao: 'HAAB', iata: 'ADD', name: 'Addis Ababa Bole International Airport', city: 'Addis Ababa', country: 'Ethiopia' },
  { icao: 'GMMN', iata: 'CMN', name: 'Mohammed V International Airport', city: 'Casablanca', country: 'Morocco' },
  { icao: 'GMME', iata: 'RBA', name: 'Rabat–Salé Airport', city: 'Rabat', country: 'Morocco' },
  { icao: 'GMMX', iata: 'RAK', name: 'Marrakech Menara Airport', city: 'Marrakech', country: 'Morocco' },
  { icao: 'GMTT', iata: 'TNG', name: 'Ibn Battouta Airport', city: 'Tangier', country: 'Morocco' },
  { icao: 'DTTA', iata: 'TUN', name: 'Tunis–Carthage International Airport', city: 'Tunis', country: 'Tunisia' },
  { icao: 'DAAG', iata: 'ALG', name: 'Houari Boumediene Airport', city: 'Algiers', country: 'Algeria' },
  { icao: 'FVHA', iata: 'HRE', name: 'Robert Gabriel Mugabe International Airport', city: 'Harare', country: 'Zimbabwe' },
  { icao: 'FVFA', iata: 'VFA', name: 'Victoria Falls Airport', city: 'Victoria Falls', country: 'Zimbabwe' },
  { icao: 'FLKK', iata: 'LUN', name: 'Kenneth Kaunda International Airport', city: 'Lusaka', country: 'Zambia' },
  { icao: 'FLLI', iata: 'LVI', name: 'Harry Mwanga Nkumbula International Airport', city: 'Livingstone', country: 'Zambia' },
  { icao: 'FWKI', iata: 'LLW', name: 'Lilongwe International Airport', city: 'Lilongwe', country: 'Malawi' },
  { icao: 'FBSK', iata: 'GBE', name: 'Sir Seretse Khama International Airport', city: 'Gaborone', country: 'Botswana' },
  { icao: 'FYWH', iata: 'WDH', name: 'Hosea Kutako International Airport', city: 'Windhoek', country: 'Namibia' },
  { icao: 'HRYR', iata: 'KGL', name: 'Kigali International Airport', city: 'Kigali', country: 'Rwanda' },
  { icao: 'HUEN', iata: 'EBB', name: 'Entebbe International Airport', city: 'Entebbe', country: 'Uganda' },
  { icao: 'FMEE', iata: 'SEZ', name: 'Seychelles International Airport', city: 'Mahé', country: 'Seychelles' },

  // Australia & New Zealand
  { icao: 'YSSY', iata: 'SYD', name: 'Sydney Kingsford Smith Airport', city: 'Sydney', country: 'Australia' },
  { icao: 'YMML', iata: 'MEL', name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia' },
  { icao: 'YBBN', iata: 'BNE', name: 'Brisbane Airport', city: 'Brisbane', country: 'Australia' },
  { icao: 'YPPH', iata: 'PER', name: 'Perth Airport', city: 'Perth', country: 'Australia' },
  { icao: 'YPAD', iata: 'ADL', name: 'Adelaide Airport', city: 'Adelaide', country: 'Australia' },
  { icao: 'YSCB', iata: 'CBR', name: 'Canberra Airport', city: 'Canberra', country: 'Australia' },
  { icao: 'YBCG', iata: 'OOL', name: 'Gold Coast Airport', city: 'Gold Coast', country: 'Australia' },
  { icao: 'YBCS', iata: 'CNS', name: 'Cairns Airport', city: 'Cairns', country: 'Australia' },
  { icao: 'NZAA', iata: 'AKL', name: 'Auckland Airport', city: 'Auckland', country: 'New Zealand' },
  { icao: 'NZWN', iata: 'WLG', name: 'Wellington International Airport', city: 'Wellington', country: 'New Zealand' },
  { icao: 'NZCH', iata: 'CHC', name: 'Christchurch International Airport', city: 'Christchurch', country: 'New Zealand' },
  { icao: 'NZQN', iata: 'ZQN', name: 'Queenstown Airport', city: 'Queenstown', country: 'New Zealand' },

  // Pacific Islands
  { icao: 'NFFN', iata: 'NAN', name: 'Nadi International Airport', city: 'Nadi', country: 'Fiji' },
  { icao: 'NTAA', iata: 'PPT', name: 'Faa\'a International Airport', city: 'Papeete', country: 'French Polynesia' },
  { icao: 'NWWW', iata: 'NOU', name: 'La Tontouta International Airport', city: 'Nouméa', country: 'New Caledonia' },

  // Nordic Countries
  { icao: 'EKCH', iata: 'CPH', name: 'Copenhagen Airport', city: 'Copenhagen', country: 'Denmark' },
  { icao: 'ESSA', iata: 'ARN', name: 'Stockholm Arlanda Airport', city: 'Stockholm', country: 'Sweden' },
  { icao: 'ESSB', iata: 'BMA', name: 'Stockholm Bromma Airport', city: 'Stockholm', country: 'Sweden' },
  { icao: 'ESGG', iata: 'GOT', name: 'Göteborg Landvetter Airport', city: 'Gothenburg', country: 'Sweden' },
  { icao: 'ENGM', iata: 'OSL', name: 'Oslo Airport, Gardermoen', city: 'Oslo', country: 'Norway' },
  { icao: 'ENBR', iata: 'BGO', name: 'Bergen Airport, Flesland', city: 'Bergen', country: 'Norway' },
  { icao: 'ENTC', iata: 'TOS', name: 'Tromsø Airport', city: 'Tromsø', country: 'Norway' },
  { icao: 'EFHK', iata: 'HEL', name: 'Helsinki-Vantaa Airport', city: 'Helsinki', country: 'Finland' },
  { icao: 'BIKF', iata: 'KEF', name: 'Keflavík International Airport', city: 'Reykjavík', country: 'Iceland' },

  // Eastern Europe
  { icao: 'EPWA', iata: 'WAW', name: 'Warsaw Chopin Airport', city: 'Warsaw', country: 'Poland' },
  { icao: 'EPKK', iata: 'KRK', name: 'John Paul II International Airport', city: 'Kraków', country: 'Poland' },
  { icao: 'LKPR', iata: 'PRG', name: 'Václav Havel Airport Prague', city: 'Prague', country: 'Czech Republic' },
  { icao: 'LHBP', iata: 'BUD', name: 'Budapest Ferenc Liszt International Airport', city: 'Budapest', country: 'Hungary' },
  { icao: 'LROP', iata: 'OTP', name: 'Henri Coandă International Airport', city: 'Bucharest', country: 'Romania' },
  { icao: 'LBSF', iata: 'SOF', name: 'Sofia Airport', city: 'Sofia', country: 'Bulgaria' },
  { icao: 'LWSK', iata: 'SKP', name: 'Skopje International Airport', city: 'Skopje', country: 'North Macedonia' },
  { icao: 'BKPR', iata: 'PRN', name: 'Pristina International Airport', city: 'Pristina', country: 'Kosovo' },
  { icao: 'LYBE', iata: 'BEG', name: 'Belgrade Nikola Tesla Airport', city: 'Belgrade', country: 'Serbia' },
  { icao: 'LDZA', iata: 'ZAG', name: 'Franjo Tuđman Airport', city: 'Zagreb', country: 'Croatia' },
  { icao: 'LDDU', iata: 'DBV', name: 'Dubrovnik Airport', city: 'Dubrovnik', country: 'Croatia' },
  { icao: 'LDSP', iata: 'SPU', name: 'Split Airport', city: 'Split', country: 'Croatia' },
  { icao: 'LJLJ', iata: 'LJU', name: 'Ljubljana Jože Pučnik Airport', city: 'Ljubljana', country: 'Slovenia' },
  { icao: 'LQSA', iata: 'SJJ', name: 'Sarajevo International Airport', city: 'Sarajevo', country: 'Bosnia and Herzegovina' },
  { icao: 'LYPG', iata: 'TGD', name: 'Podgorica Airport', city: 'Podgorica', country: 'Montenegro' },
  { icao: 'LATI', iata: 'TIA', name: 'Tirana International Airport', city: 'Tirana', country: 'Albania' },
  { icao: 'EVRA', iata: 'RIX', name: 'Riga International Airport', city: 'Riga', country: 'Latvia' },
  { icao: 'EYVI', iata: 'VNO', name: 'Vilnius Airport', city: 'Vilnius', country: 'Lithuania' },
  { icao: 'EETN', iata: 'TLL', name: 'Tallinn Airport', city: 'Tallinn', country: 'Estonia' },
  { icao: 'UKBB', iata: 'KBP', name: 'Boryspil International Airport', city: 'Kyiv', country: 'Ukraine' },

  // Middle East (additional)
  { icao: 'OJAI', iata: 'AMM', name: 'Queen Alia International Airport', city: 'Amman', country: 'Jordan' },
  { icao: 'OLBA', iata: 'BEY', name: 'Beirut–Rafic Hariri International Airport', city: 'Beirut', country: 'Lebanon' },
  { icao: 'LLBG', iata: 'TLV', name: 'Ben Gurion Airport', city: 'Tel Aviv', country: 'Israel' },
  { icao: 'LLSD', iata: 'SDV', name: 'Sde Dov Airport', city: 'Tel Aviv', country: 'Israel' },
  { icao: 'OIII', iata: 'IKA', name: 'Imam Khomeini International Airport', city: 'Tehran', country: 'Iran' },
  { icao: 'OIIE', iata: 'THR', name: 'Mehrabad International Airport', city: 'Tehran', country: 'Iran' },
  { icao: 'ORBI', iata: 'BGW', name: 'Baghdad International Airport', city: 'Baghdad', country: 'Iraq' },
  { icao: 'ORMM', iata: 'BSR', name: 'Basra International Airport', city: 'Basra', country: 'Iraq' },
  { icao: 'ORNI', iata: 'NJF', name: 'Al Najaf International Airport', city: 'Najaf', country: 'Iraq' },
  { icao: 'ORER', iata: 'EBL', name: 'Erbil International Airport', city: 'Erbil', country: 'Iraq' },

  // Central Asia
  { icao: 'UAAA', iata: 'ALA', name: 'Almaty International Airport', city: 'Almaty', country: 'Kazakhstan' },
  { icao: 'UACC', iata: 'NQZ', name: 'Nursultan Nazarbayev International Airport', city: 'Astana', country: 'Kazakhstan' },
  { icao: 'UTTT', iata: 'TAS', name: 'Tashkent International Airport', city: 'Tashkent', country: 'Uzbekistan' },
  { icao: 'UCFM', iata: 'FRU', name: 'Manas International Airport', city: 'Bishkek', country: 'Kyrgyzstan' },
  { icao: 'UTDD', iata: 'DYU', name: 'Dushanbe International Airport', city: 'Dushanbe', country: 'Tajikistan' },
  { icao: 'UTAV', iata: 'SKD', name: 'Samarkand International Airport', city: 'Samarkand', country: 'Uzbekistan' },
  { icao: 'UTAA', iata: 'ASB', name: 'Ashgabat International Airport', city: 'Ashgabat', country: 'Turkmenistan' },
  { icao: 'UBBB', iata: 'GYD', name: 'Heydar Aliyev International Airport', city: 'Baku', country: 'Azerbaijan' },
  { icao: 'UGGG', iata: 'TBS', name: 'Tbilisi International Airport', city: 'Tbilisi', country: 'Georgia' },
  { icao: 'UDYZ', iata: 'EVN', name: 'Zvartnots International Airport', city: 'Yerevan', country: 'Armenia' },

  // Monaco / Andorra / Luxembourg / Malta / Cyprus
  { icao: 'LNMC', iata: 'MCM', name: 'Monaco Heliport', city: 'Monaco', country: 'Monaco' },
  { icao: 'ELLX', iata: 'LUX', name: 'Luxembourg Airport', city: 'Luxembourg', country: 'Luxembourg' },
  { icao: 'LMML', iata: 'MLA', name: 'Malta International Airport', city: 'Valletta', country: 'Malta' },
  { icao: 'LCLK', iata: 'LCA', name: 'Larnaca International Airport', city: 'Larnaca', country: 'Cyprus' },
  { icao: 'LCPH', iata: 'PFO', name: 'Paphos International Airport', city: 'Paphos', country: 'Cyprus' },

  // Ireland
  { icao: 'EIDW', iata: 'DUB', name: 'Dublin Airport', city: 'Dublin', country: 'Ireland' },
  { icao: 'EINN', iata: 'SNN', name: 'Shannon Airport', city: 'Shannon', country: 'Ireland' },
  { icao: 'EICK', iata: 'ORK', name: 'Cork Airport', city: 'Cork', country: 'Ireland' },

  // Pakistan & Bangladesh
  { icao: 'OPKC', iata: 'KHI', name: 'Jinnah International Airport', city: 'Karachi', country: 'Pakistan' },
  { icao: 'OPLA', iata: 'LHE', name: 'Allama Iqbal International Airport', city: 'Lahore', country: 'Pakistan' },
  { icao: 'OPIS', iata: 'ISB', name: 'Islamabad International Airport', city: 'Islamabad', country: 'Pakistan' },
  { icao: 'VGZR', iata: 'DAC', name: 'Hazrat Shahjalal International Airport', city: 'Dhaka', country: 'Bangladesh' },

  // Nepal & Bhutan
  { icao: 'VNKT', iata: 'KTM', name: 'Tribhuvan International Airport', city: 'Kathmandu', country: 'Nepal' },
  { icao: 'VQPR', iata: 'PBH', name: 'Paro International Airport', city: 'Paro', country: 'Bhutan' },

  // Afghanistan
  { icao: 'OAKB', iata: 'KBL', name: 'Kabul International Airport', city: 'Kabul', country: 'Afghanistan' },

  // Mongolia
  { icao: 'ZMUB', iata: 'UBN', name: 'Chinggis Khaan International Airport', city: 'Ulaanbaatar', country: 'Mongolia' },
];

// Helper function to search airports
export function searchAirports(query: string, limit: number = 20): Airport[] {
  if (!query || query.length < 2) return [];
  
  const searchTerm = query.toLowerCase();
  
  return AIRPORTS
    .filter(airport => 
      airport.icao.toLowerCase().includes(searchTerm) ||
      airport.iata.toLowerCase().includes(searchTerm) ||
      airport.name.toLowerCase().includes(searchTerm) ||
      airport.city.toLowerCase().includes(searchTerm) ||
      airport.country.toLowerCase().includes(searchTerm)
    )
    .slice(0, limit);
}

// Format airport for display
export function formatAirport(airport: Airport): string {
  return `${airport.city} (${airport.icao})`;
}

export function formatAirportFull(airport: Airport): string {
  return `${airport.name} - ${airport.city}, ${airport.country} (${airport.icao}/${airport.iata})`;
}
