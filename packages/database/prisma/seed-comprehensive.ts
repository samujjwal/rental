import { config } from 'dotenv';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { faker } from '@faker-js/faker';
import crypto from 'crypto';
import { seedPolicyRules } from './seed/policy-rules-seed';
import { seedCountryPacks } from './seed/country-packs-seed';

config({ path: '../../.env' });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── Nepal Constants ─────────────────────────────────────────────────────────

const NEPAL_LOCATIONS = [
  { city: 'Kathmandu', state: 'Bagmati Province', lat: 27.7172, lng: 85.324, zip: '44600' },
  { city: 'Lalitpur', state: 'Bagmati Province', lat: 27.6588, lng: 85.3247, zip: '44700' },
  { city: 'Bhaktapur', state: 'Bagmati Province', lat: 27.672, lng: 85.4298, zip: '44800' },
  { city: 'Kirtipur', state: 'Bagmati Province', lat: 27.6783, lng: 85.2775, zip: '44618' },
  { city: 'Hetauda', state: 'Bagmati Province', lat: 27.4288, lng: 85.032, zip: '44107' },
  { city: 'Pokhara', state: 'Gandaki Province', lat: 28.2096, lng: 83.9856, zip: '33700' },
  { city: 'Gorkha', state: 'Gandaki Province', lat: 28.003, lng: 84.6287, zip: '36400' },
  { city: 'Butwal', state: 'Lumbini Province', lat: 27.7006, lng: 83.4483, zip: '32907' },
  { city: 'Siddharthanagar', state: 'Lumbini Province', lat: 27.5044, lng: 83.4498, zip: '32900' },
  { city: 'Nepalgunj', state: 'Lumbini Province', lat: 28.05, lng: 81.6167, zip: '21900' },
  { city: 'Biratnagar', state: 'Koshi Province', lat: 26.4525, lng: 87.2718, zip: '56613' },
  { city: 'Dharan', state: 'Koshi Province', lat: 26.8125, lng: 87.2836, zip: '56700' },
  { city: 'Itahari', state: 'Koshi Province', lat: 26.6667, lng: 87.2833, zip: '56705' },
  { city: 'Janakpur', state: 'Madhesh Province', lat: 26.7271, lng: 85.9407, zip: '45600' },
  { city: 'Birgunj', state: 'Madhesh Province', lat: 27.0104, lng: 84.8778, zip: '44300' },
  { city: 'Surkhet', state: 'Karnali Province', lat: 28.6047, lng: 81.636, zip: '21700' },
  { city: 'Dhangadhi', state: 'Sudurpashchim Province', lat: 28.6833, lng: 80.6, zip: '10900' },
  { city: 'Mahendranagar', state: 'Sudurpashchim Province', lat: 28.9667, lng: 80.35, zip: '10400' },
];

const NEPAL_TOLES = [
  'Thamel', 'Lazimpat', 'Durbar Marg', 'New Baneshwor', 'Baluwatar',
  'Maharajgunj', 'Bouddha', 'Chabahil', 'Jawalakhel', 'Kupondole',
  'Pulchowk', 'Mangalbazar', 'Sukedhara', 'Basundhara', 'Budhanilkantha',
  'Gairidhara', 'Naxal', 'Kalanki', 'Swayambhu', 'Patan Dhoka',
  'Lakeside', 'Bagar', 'Nadipur', 'Chipledhunga', 'Prithvi Chowk',
  'Siddha Pokhari', 'Taumadhi', 'Dattatreya', 'Byasi', 'Mahendrapul',
];

const NEPALI_FIRST_NAMES = [
  'Aarav', 'Aayush', 'Bibek', 'Bishal', 'Deepak', 'Dipesh', 'Ganesh', 'Hari',
  'Kiran', 'Krishna', 'Manish', 'Nabin', 'Prakash', 'Pramod', 'Rajesh', 'Roshan',
  'Sagar', 'Sandip', 'Santosh', 'Sunil', 'Anita', 'Asha', 'Binita', 'Gita',
  'Kamala', 'Laxmi', 'Maya', 'Nirmala', 'Puja', 'Radha', 'Rashmi', 'Rita',
  'Sabina', 'Sita', 'Sunita', 'Sushma', 'Sarita', 'Usha', 'Yamuna', 'Samjhana',
];

const NEPALI_LAST_NAMES = [
  'Adhikari', 'Acharya', 'Basnet', 'Bhandari', 'Bhattarai', 'Chaudhary',
  'Dahal', 'Devkota', 'Ghimire', 'Gurung', 'Joshi', 'Karki', 'Koirala',
  'Lama', 'Maharjan', 'Magar', 'Neupane', 'Pandey', 'Poudel', 'Rai',
  'Regmi', 'Sapkota', 'Shah', 'Sharma', 'Shrestha', 'Subedi', 'Tamang',
  'Thapa', 'Tiwari', 'Upreti',
];

const VEHICLE_TYPES = [
  'Suzuki Alto', 'Hyundai i10', 'Hyundai i20', 'Toyota Aqua', 'Suzuki Swift',
  'Kia Seltos', 'Hyundai Creta', 'Toyota Hilux', 'Mahindra Scorpio', 'Tata Nexon',
  'Honda CRV', 'Suzuki Dzire', 'Royal Enfield Classic 350', 'Honda Shine', 'Yamaha FZ',
  'Hero Splendor', 'TVS Apache', 'Bajaj Pulsar',
];

const BIKE_TYPES = [
  'Royal Enfield Classic 350', 'Honda Shine 125', 'Yamaha FZ-S', 'Hero Splendor Plus',
  'TVS Apache RTR 160', 'Bajaj Pulsar NS200', 'Honda CB Hornet', 'Suzuki Access 125',
  'TVS Jupiter Scooter', 'Honda Activa 6G', 'KTM Duke 200', 'Benelli TNT 150',
];

const EQUIPMENT_TYPES = [
  'Honda Generator (5KVA)', 'Yamaha Generator (3KVA)', 'Concrete Mixer', 'Power Drill Set',
  'Scaffolding Set (10ft)', 'Electric Sander', 'Pressure Washer', 'Welding Machine',
  'Chainsaw', 'Lawn Mower', 'Air Compressor', 'Jack Hammer',
  'LED Floodlight Set', 'Extension Ladder (20ft)', 'Industrial Fan',
];

const CAMERA_TYPES = [
  'Canon EOS 90D DSLR + 18-135mm Lens', 'Nikon D7500 DSLR + Kit Lens',
  'Sony Alpha A7 III Mirrorless', 'DJI Mavic 3 Pro Drone',
  'GoPro Hero 12 Action Camera', 'DJI Osmo Mobile 6 Gimbal',
  'Sony FX3 Cinema Camera', 'Canon EF 70-200mm f/2.8 Lens',
  'Nikon 50mm f/1.8 Prime Lens', 'LED Ring Light + Stand Kit',
  'Godox Softbox Lighting Kit', 'Blackmagic Pocket Cinema 6K',
  'DJI RS 3 Pro Gimbal Stabilizer', 'Atomos Shogun Monitor/Recorder',
  'Audio-Technica AT2020 Shotgun Mic',
];

const MUSICAL_INSTRUMENTS = [
  'Tabla Set (Bayan + Dayan)', 'Madal (Traditional Nepali Drum)', 'Sarangi',
  'Bansuri (Bamboo Flute) Set', 'Harmonium', 'Sitar',
  'Acoustic Guitar (Yamaha F310)', 'Electric Guitar (Fender Stratocaster)',
  'Yamaha PSR-E373 Keyboard', 'Roland Electronic Drum Kit',
  'Violin (4/4 Size)', 'Ukulele (Concert)', 'Bass Guitar (Ibanez)',
  'Cajon Box Drum', 'Digital Piano (Casio CDP-S360)',
];

const SPORTS_ITEMS = [
  'Complete Trekking Gear Set (Boots + Poles + Pack)', 'Mountain Tent (4-Person)',
  'White Water Rafting Equipment (Full Kit)', 'Rock Climbing Harness + Rope Set',
  'Paragliding Tandem Equipment', 'Camping Sleeping Bag (-10°C)',
  'Kayak (Single Seater)', 'Mountain Bike (Trek Marlin 7)',
  'Road Bike (Giant Contend AR)', 'Badminton Racket + Net Set',
  'Cricket Kit (Full Set)', 'Football + Goalkeeper Kit',
  'Volleyball + Net Set', 'Table Tennis Table + Paddles',
  'Boxing Gloves + Punch Bag Set',
];

const CLOTHING_TYPES = [
  'Traditional Daura Suruwal (Men – Size M/L/XL)', 'Nepali Gunyo Cholo Set (Women)',
  'Sherpa Winter Jacket (Unisex)', 'Wedding Saree (Premium Silk)',
  'Bridal Lehenga Set (Full Designer)', 'Groom Sherwani Set',
  'Formal Business Suit (Men – Tailored)', 'Traditional Newari Dress Set',
  'Tibetan Chuba Robe', 'Pahadi Festival Dress Set',
  'Evening Gown (Western Style)', 'Traditional Tharu Dress',
  'School/College Graduation Gown', 'Dance Costume (Classical)',
  'Mascot / Character Costume',
];

const EVENT_TYPES = [
  'Banquet Hall', 'Rooftop Party Palace', 'Garden Venue',
  'Conference Hall', 'Birthday Party Hall',
  'Wedding Reception Venue', 'Cultural Program Hall',
  'Corporate Event Space', 'Outdoor Pavilion',
  'Community Hall',
];

const OFFICE_TYPES = [
  'Private Office (2-Person)', 'Hot Desk Coworking Space',
  'Dedicated Desk (Monthly)', 'Meeting Room (8-Seat)',
  'Training Room (20-Seat)', 'Virtual Office Package',
  'Executive Suite', 'Open Plan Office (10+ Desks)',
  'Recording / Podcast Studio', 'Photography Studio',
];

const PARKING_TYPES = [
  'Covered Garage Parking', 'Open Car Parking Space',
  'Basement Parking Slot', 'Motorbike Parking Bay',
  'Commercial Vehicle Yard', '24-Hour Guarded Parking',
  'Multi-level Parking Slot', 'EV-Ready Parking Spot',
];

const AMENITIES = [
  'WiFi', 'Hot Water', 'Kitchen', 'Parking', 'AC', 'Washing Machine', 'TV',
  'Elevator', 'Rooftop Terrace', 'Garden', 'CCTV Security', '24-Hour Water Supply',
  'Backup Power / Inverter', 'Solar Water Heater', 'Mountain View', 'Balcony',
  'Furnished', 'Pet Friendly',
];

const RULES_EN = [
  'No smoking inside the premises', 'No parties or events without prior approval',
  'Quiet hours from 10 PM to 7 AM', 'Shoes off inside the house',
  'Respect the neighbors', 'Do not waste water', 'Return keys at checkout',
];

// ── Category-specific amenities ───────────────────────────────────────────────
const CATEGORY_AMENITIES: Record<string, string[]> = {
  apartment: ['WiFi', 'Hot Water', 'Kitchen', 'Parking', 'AC', 'Washing Machine', 'TV', 'Elevator', 'CCTV Security', '24-Hour Water Supply', 'Backup Power / Inverter', 'Balcony', 'Furnished'],
  house:     ['WiFi', 'Hot Water', 'Kitchen', 'Parking', 'Garden', 'Rooftop Terrace', 'Washing Machine', 'TV', 'CCTV Security', '24-Hour Water Supply', 'Solar Water Heater', 'Mountain View', 'Pet Friendly'],
  villa:     ['Private Pool', 'WiFi', 'Hot Water', 'Full Kitchen', 'Parking', 'Garden', 'Rooftop Terrace', 'Mountain View', 'AC', 'CCTV Security', 'Backup Power', 'Solar Water Heater', 'Dedicated Staff'],
  studio:    ['WiFi', 'Hot Water', 'Kitchenette', 'AC', 'TV', 'Common Laundry', 'CCTV Security', '24-Hour Water Supply', 'Backup Power / Inverter', 'Furnished'],
  car:       ['Full Insurance', 'GPS Navigation', 'Dashcam', 'Child Seat Available', 'Music System', 'AC', 'First Aid Kit', 'Roadside Assistance', 'Fuel Refill on Return', 'Driver Available'],
  bike:      ['Helmet Included', 'Insurance Included', 'RC Book Provided', 'Mobile Holder', 'Fuel Full on Pickup', 'Basic Toolkit', 'Raincoat Available'],
  equipment: ['Delivery Available', 'Operator Available', 'Safety Manual Included', 'All Accessories Provided', 'Pick-up from Location'],
  'camera-electronics': ['All Accessories Included', 'Extra Batteries', 'Carrying Case', 'Memory Cards', 'Delivery Available', 'Technical Support', 'Insurance Option'],
  'event-space': ['AC / Cooling System', 'Stage & Podium', 'AV Equipment & PA System', 'Decorative Lighting', 'Catering Partnership', 'Parking for 50+ Cars', 'Backup Generator', 'Bridal Suite', 'CCTV Security'],
  'office-space': ['High-Speed Fiber WiFi', 'Ergonomic Chairs & Desks', 'Meeting Room Access', 'Printer & Scanner', '24/7 Secured Access', 'Coffee & Tea', 'Locker Storage', 'Receptionist Service', 'Backup Power'],
  'musical-instrument': ['Carrying Case / Bag', 'Tuned Before Rental', 'Cleaning Kit', 'Instruction Manual', 'Replacement Strings / Accessories'],
  'sports-equipment': ['Safety-Checked', 'Sanitized Before Use', 'Carrying Bag', 'User Manual', 'Delivery to Trailhead Available', 'Insurance Option'],
  'parking-space': ['CCTV 24/7', 'Security Guard', 'Covered Roof', '24-Hour Access', 'EV Charging (select slots)', 'Adequate Lighting'],
  'storage-space': ['CCTV 24/7', 'Secured Lock', 'Restricted Access', 'Dry & Clean', 'Ground Floor / Lift Access', 'Loading / Unloading Help', 'Fire Safety'],
  'clothing-costumes': ['Dry Cleaned', 'Professionally Pressed', 'Multiple Sizes', 'Matching Accessories', 'Alteration Service', 'Home Delivery Available'],
};

const CATEGORY_RULES: Record<string, string[]> = {
  apartment: ['No smoking on premises', 'No parties without approval', 'Quiet hours 10 PM–7 AM', 'Shoes off indoors', 'Do not waste water', 'Return keys at checkout'],
  house:     ['No smoking on premises', 'Respect neighbors', 'No loud music after 9 PM', 'Keep gate locked', 'Garden plants – do not damage', 'Return keys at checkout'],
  villa:     ['No smoking indoors', 'Pool safety rules apply', 'No outside catering without prior approval', 'No pets in pool area', 'Return all keys at checkout'],
  studio:    ['No smoking', 'No overnight guests beyond booked count', 'Quiet hours 10 PM–7 AM', 'Keep common areas clean'],
  car:       ['Valid driving license required', 'No smoking in vehicle', 'No off-road driving', 'Return with full tank', 'Report any damage immediately', 'No subletting'],
  bike:      ['Valid driving license required', 'Helmet must be worn at all times', 'No pillion without permission', 'Return with full tank', 'No off-road use'],
  equipment: ['Operator must be trained', 'No subletting', 'Damage will be charged', 'Return in original condition', 'Report malfunctions immediately'],
  'camera-electronics': ['Handle with care', 'No modifications', 'Loss or theft – renter is liable', 'Return with all accessories', 'No subletting'],
  'event-space': ['No outside alcohol without permit', 'Noise curfew at 10 PM', 'Decor must not damage walls/floors', 'Venue must be vacated on time', 'Security deposit required'],
  'office-space': ['No smoking on premises', 'Keep shared areas tidy', 'No overnight stays', 'Meeting rooms must be booked in advance', 'Visitor sign-in required'],
  'musical-instrument': ['Handle with care', 'Return in tuned condition', 'No modifications to instrument', 'Replacement for damage – renter liable'],
  'sports-equipment': ['Follow safety guidelines', 'No subletting', 'Return cleaned', 'Damage assessment on return', 'Insurance strongly recommended'],
  'parking-space': ['No overnight stays in vehicle', 'One vehicle per slot', 'No repairs / oil changes in slot', 'No subletting'],
  'storage-space': ['No hazardous materials', 'Access during business hours only', 'No subletting', 'Insurance recommended for valuables'],
  'clothing-costumes': ['Handle with care – no alterations without approval', 'Return dry-cleaned', 'Loss or damage – renter liable', 'Timely return required'],
};

// ─── Helper functions ────────────────────────────────────────────────────────

function randomNepalPhone(): string {
  const prefixes = ['984', '985', '986', '980', '981', '982', '974', '975', '976'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return `+977-${prefix}-${faker.string.numeric(7)}`;
}

function randomNepaliName() {
  const first = NEPALI_FIRST_NAMES[Math.floor(Math.random() * NEPALI_FIRST_NAMES.length)];
  const last = NEPALI_LAST_NAMES[Math.floor(Math.random() * NEPALI_LAST_NAMES.length)];
  return { first, last, username: `${first.toLowerCase()}.${last.toLowerCase()}${faker.number.int({ min: 1, max: 999 })}` };
}

function randomLocation() {
  return NEPAL_LOCATIONS[Math.floor(Math.random() * NEPAL_LOCATIONS.length)];
}

function randomTole() {
  return NEPAL_TOLES[Math.floor(Math.random() * NEPAL_TOLES.length)];
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function getBookingDateForMonth(monthIndex: number): Date {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthIndex, 1);
  const days = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = faker.number.int({ min: 1, max: Math.max(1, days - 7) });
  return new Date(target.getFullYear(), target.getMonth(), day);
}

function getSeasonalMultiplier(date: Date): number {
  const month = date.getMonth();
  if (month >= 9 && month <= 11) return 1.4; // Dashain/Tihar peak
  if (month >= 2 && month <= 4) return 1.2;  // Spring trekking season
  if (month >= 5 && month <= 7) return 0.8;  // Monsoon off-peak
  return 1.0;
}

function getWeightedBookingStatus(isPast: boolean, isCurrent: boolean): string {
  if (isCurrent) {
    return faker.helpers.weightedArrayElement([
      { weight: 35, value: 'IN_PROGRESS' },
      { weight: 25, value: 'CONFIRMED' },
      { weight: 10, value: 'PENDING' },
      { weight: 5, value: 'PENDING_OWNER_APPROVAL' },
      { weight: 5, value: 'PENDING_PAYMENT' },
      { weight: 5, value: 'DISPUTED' },
      { weight: 5, value: 'AWAITING_RETURN_INSPECTION' },
      { weight: 5, value: 'DRAFT' },
      { weight: 5, value: 'PAYMENT_FAILED' },
    ]);
  }
  if (isPast) {
    return faker.helpers.weightedArrayElement([
      { weight: 45, value: 'COMPLETED' },
      { weight: 15, value: 'CONFIRMED' },
      { weight: 10, value: 'CANCELLED' },
      { weight: 8, value: 'SETTLED' },
      { weight: 7, value: 'REFUNDED' },
      { weight: 5, value: 'DISPUTED' },
      { weight: 5, value: 'PAYMENT_FAILED' },
      { weight: 5, value: 'DRAFT' },
    ]);
  }
  return faker.helpers.weightedArrayElement([
    { weight: 40, value: 'CONFIRMED' },
    { weight: 15, value: 'PENDING' },
    { weight: 10, value: 'PENDING_OWNER_APPROVAL' },
    { weight: 8, value: 'PENDING_PAYMENT' },
    { weight: 7, value: 'CANCELLED' },
    { weight: 5, value: 'DRAFT' },
    { weight: 5, value: 'PAYMENT_FAILED' },
    { weight: 5, value: 'IN_PROGRESS' },
    { weight: 5, value: 'DISPUTED' },
  ]);
}

function getPaymentStatusFromBooking(status: string): string {
  switch (status) {
    case 'COMPLETED': case 'CONFIRMED': case 'IN_PROGRESS': case 'SETTLED':
    case 'AWAITING_RETURN_INSPECTION': return 'COMPLETED';
    case 'CANCELLED': case 'REFUNDED': return 'REFUNDED';
    case 'PENDING': case 'PENDING_OWNER_APPROVAL': case 'DRAFT': return 'PENDING';
    case 'PENDING_PAYMENT': return 'PROCESSING';
    case 'PAYMENT_FAILED': return 'FAILED';
    case 'DISPUTED': return 'COMPLETED';
    default: return 'PENDING';
  }
}

function getRealisticBookingDuration(): number {
  return faker.helpers.weightedArrayElement([
    { weight: 40, value: faker.number.int({ min: 2, max: 3 }) },
    { weight: 30, value: 7 },
    { weight: 20, value: 1 },
    { weight: 10, value: faker.number.int({ min: 14, max: 30 }) },
  ]);
}

// ─── LISTING TITLE & DESCRIPTION TEMPLATES (EN + NE) ─────────────────────────

function getListingTitle(categorySlug: string, area: string, descriptor: string): { en: string; ne: string } {
  switch (categorySlug) {
    case 'apartment':
      return {
        en: faker.helpers.arrayElement([
          `Modern Apartment in ${area}`, `Spacious Flat near ${area}`,
          `Cozy Apartment at ${area}`, `Furnished 2BHK in ${area}`,
          `Premium Apartment – ${area}`, `Sunny Apartment with Balcony – ${area}`,
        ]),
        ne: faker.helpers.arrayElement([
          `${area}मा आधुनिक अपार्टमेन्ट`, `${area} नजिकको फराकिलो फ्ल्याट`,
          `${area}मा सुविधा सम्पन्न अपार्टमेन्ट`, `${area}को फर्निस्ड २बीएचके`,
          `${area}मा प्रिमियम अपार्टमेन्ट`, `बालकनी सहितको अपार्टमेन्ट – ${area}`,
        ]),
      };
    case 'house':
      return {
        en: faker.helpers.arrayElement([
          `Entire House in ${area}`, `Family Home near ${area}`,
          `Traditional Nepali House – ${area}`, `New House with Garden – ${area}`,
          `4BHK House in ${area}`, `Spacious Home near ${area} – Garden & Parking`,
        ]),
        ne: faker.helpers.arrayElement([
          `${area}मा पूरा घर`, `${area} नजिकको पारिवारिक घर`,
          `परम्परागत नेपाली घर – ${area}`, `बगैँचा सहितको नयाँ घर – ${area}`,
          `${area}मा ४बीएचके घर`, `${area} नजिकको पार्किङ र बगैँचा सहितको घर`,
        ]),
      };
    case 'villa':
      return {
        en: faker.helpers.arrayElement([
          `Luxury Villa in ${area}`, `Mountain View Villa – ${area}`,
          `Private Pool Villa near ${area}`, `Heritage Villa with Garden – ${area}`,
        ]),
        ne: faker.helpers.arrayElement([
          `${area}मा लक्जरी भिला`, `हिमालको दृश्य सहितको भिला – ${area}`,
          `${area} नजिकको निजी पुल भिला`, `बगैँचा सहितको हेरिटेज भिला – ${area}`,
        ]),
      };
    case 'studio':
      return {
        en: faker.helpers.arrayElement([
          `Cozy Studio in ${area}`, `Modern Studio Apartment – ${area}`,
          `Compact Studio near ${area}`, `Furnished Studio with WiFi – ${area}`,
        ]),
        ne: faker.helpers.arrayElement([
          `${area}मा आरामदायी स्टुडियो`, `${area}मा आधुनिक स्टुडियो अपार्टमेन्ट`,
          `${area} नजिकको स्टुडियो`, `वाइफाइ सहितको फर्निस्ड स्टुडियो – ${area}`,
        ]),
      };
    case 'car':
      return {
        en: faker.helpers.arrayElement([
          `${descriptor} – Self Drive Available`, `${descriptor} for Rent (Daily/Weekly)`,
          `Well-Maintained ${descriptor}`, `${descriptor} with Driver Option`,
        ]),
        ne: faker.helpers.arrayElement([
          `${descriptor} – सेल्फ ड्राइभ उपलब्ध`, `भाडामा ${descriptor} (दैनिक/साप्ताहिक)`,
          `राम्रो अवस्थामा ${descriptor}`, `चालक सहित ${descriptor}`,
        ]),
      };
    case 'bike':
      return {
        en: faker.helpers.arrayElement([
          `${descriptor} – Daily / Weekly Rental`, `${descriptor} for City Rides`,
          `${descriptor} – Helmet & Insurance Included`, `${descriptor} – Best for Kathmandu Valley`,
        ]),
        ne: faker.helpers.arrayElement([
          `${descriptor} – दैनिक / साप्ताहिक भाडामा`, `सहर सवारीका लागि ${descriptor}`,
          `${descriptor} – हेल्मेट र बिमा समावेश`, `काठमाडौँ उपत्यकाका लागि ${descriptor}`,
        ]),
      };
    case 'equipment':
      return {
        en: faker.helpers.arrayElement([
          `${descriptor} for Rent`, `${descriptor} – Daily Hire`,
          `Professional ${descriptor} Available`, `${descriptor} – Delivery Available`,
        ]),
        ne: faker.helpers.arrayElement([
          `भाडामा ${descriptor}`, `${descriptor} – दैनिक भाडामा`,
          `प्रोफेशनल ${descriptor} उपलब्ध`, `${descriptor} – डेलिभरी उपलब्ध`,
        ]),
      };
    case 'camera-electronics':
      return {
        en: faker.helpers.arrayElement([
          `${descriptor} for Rent`, `Professional ${descriptor} – Daily/Weekly`,
          `${descriptor} with All Accessories`, `${descriptor} – Perfect for Events`,
        ]),
        ne: faker.helpers.arrayElement([
          `भाडामा ${descriptor}`, `प्रोफेशनल ${descriptor} – दैनिक/साप्ताहिक`,
          `सबै सामान सहित ${descriptor}`, `${descriptor} – कार्यक्रमका लागि उत्तम`,
        ]),
      };
    case 'event-space':
      return {
        en: faker.helpers.arrayElement([
          `${descriptor} in ${area} – Seats up to 500`, `${descriptor} – ${area}`,
          `${area} ${descriptor} – AC & Catering Available`, `Premium ${descriptor} – ${area}`,
        ]),
        ne: faker.helpers.arrayElement([
          `${area}मा ${descriptor} – ५०० सिट सम्म`, `${descriptor} – ${area}`,
          `${area} ${descriptor} – एसी र क्याटरिङ उपलब्ध`, `प्रिमियम ${descriptor} – ${area}`,
        ]),
      };
    case 'office-space':
      return {
        en: faker.helpers.arrayElement([
          `${descriptor} in ${area}`, `${descriptor} – ${area}`,
          `${descriptor} – High-Speed WiFi & Printer`, `Flexible ${descriptor} – ${area}`,
        ]),
        ne: faker.helpers.arrayElement([
          `${area}मा ${descriptor}`, `${descriptor} – ${area}`,
          `${descriptor} – हाई-स्पिड वाइफाइ र प्रिन्टर`, `लचिलो ${descriptor} – ${area}`,
        ]),
      };
    case 'musical-instrument':
      return {
        en: faker.helpers.arrayElement([
          `${descriptor} for Rent`, `${descriptor} – Practice / Events`,
          `Professional ${descriptor} Available`, `${descriptor} – Excellent Condition`,
        ]),
        ne: faker.helpers.arrayElement([
          `भाडामा ${descriptor}`, `${descriptor} – अभ्यास / कार्यक्रमका लागि`,
          `प्रोफेशनल ${descriptor} उपलब्ध`, `${descriptor} – उत्कृष्ट अवस्थामा`,
        ]),
      };
    case 'sports-equipment':
      return {
        en: faker.helpers.arrayElement([
          `${descriptor} for Rent`, `${descriptor} – Adventure Ready`,
          `${descriptor} – Full Kit Available`, `${descriptor} – Daily / Weekly Hire`,
        ]),
        ne: faker.helpers.arrayElement([
          `भाडामा ${descriptor}`, `${descriptor} – साहसिक यात्राका लागि`,
          `${descriptor} – पूर्ण किट उपलब्ध`, `${descriptor} – दैनिक / साप्ताहिक भाडा`,
        ]),
      };
    case 'parking-space':
      return {
        en: faker.helpers.arrayElement([
          `${descriptor} in ${area}`, `${descriptor} – Secure & Monitored`,
          `${descriptor} – ${area}`, `Monthly ${descriptor} – ${area}`,
        ]),
        ne: faker.helpers.arrayElement([
          `${area}मा ${descriptor}`, `${descriptor} – सुरक्षित र निगरानी`,
          `${descriptor} – ${area}`, `मासिक ${descriptor} – ${area}`,
        ]),
      };
    case 'storage-space':
      return {
        en: faker.helpers.arrayElement([
          `Secure Storage Unit in ${area}`, `Climate-Controlled Storage – ${area}`,
          `Warehouse / Godown Space near ${area}`, `Monthly Storage Unit – ${area}`,
        ]),
        ne: faker.helpers.arrayElement([
          `${area}मा सुरक्षित भण्डारण इकाई`, `जलवायु-नियन्त्रित भण्डारण – ${area}`,
          `${area} नजिकको गोदाम ठाउँ`, `मासिक भण्डारण इकाई – ${area}`,
        ]),
      };
    case 'clothing-costumes':
      return {
        en: faker.helpers.arrayElement([
          `${descriptor} for Rent`, `${descriptor} – Perfect for Festivals`,
          `Designer ${descriptor} – Cleaned & Ready`, `${descriptor} – Wedding / Events`,
        ]),
        ne: faker.helpers.arrayElement([
          `भाडामा ${descriptor}`, `${descriptor} – चाडपर्वका लागि उत्तम`,
          `डिजाइनर ${descriptor} – सफा र तयार`, `${descriptor} – बिवाह / कार्यक्रमका लागि`,
        ]),
      };
    default:
      return {
        en: `${descriptor} in ${area} for Rent`,
        ne: `${area}मा भाडामा ${descriptor}`,
      };
  }
}

function getListingDescription(categorySlug: string): { en: string; ne: string } {
  switch (categorySlug) {
    case 'apartment':
      return {
        en: 'Well-maintained apartment ideally located for short and long stays. Features a fully equipped kitchen, clean bathrooms, reliable WiFi, and 24-hour water supply. The building offers parking and is close to shops, restaurants, and public transport.',
        ne: 'छोटो र लामो दुवै बसाइका लागि उपयुक्त राम्रोसँग मर्मत गरिएको अपार्टमेन्ट। पूर्ण सुसज्जित भान्सा, सफा बाथरुम, भरपर्दो वाइफाइ, र २४ घण्टा पानीको सुविधा। भवनमा पार्किङ छ र पसल, रेस्टुरेन्ट र सार्वजनिक यातायातको नजिक।',
      };
    case 'house':
      return {
        en: 'Beautiful house with traditional Nepali architecture and modern comforts. Enjoy a peaceful garden, rooftop terrace with mountain views, spacious rooms, and a warm family atmosphere. Perfect for families visiting Nepal.',
        ne: 'परम्परागत नेपाली वास्तुकला र आधुनिक सुविधाहरू भएको सुन्दर घर। शान्त बगैँचा, हिमालको दृश्य सहितको छतमा छत, फराकिलो कोठाहरू, र न्यानो पारिवारिक वातावरण। नेपाल भ्रमणमा आउने परिवारहरूका लागि उपयुक्त।',
      };
    case 'villa':
      return {
        en: 'Stunning luxury villa with panoramic mountain views. Features private pool, manicured gardens, modern interiors, and dedicated staff. An unmatched retreat for discerning travelers.',
        ne: 'हिमालको विशाल दृश्य सहितको शानदार लक्जरी भिला। निजी स्विमिङ पुल, सजिएको बगैँचा, आधुनिक भित्री भाग, र समर्पित कर्मचारी। विशिष्ट यात्रीहरूका लागि अतुलनीय बिश्राम स्थल।',
      };
    case 'studio':
      return {
        en: 'Compact and fully furnished studio apartment in a prime location. Ideal for solo travelers, students, or working professionals. Features a kitchenette, en-suite bathroom, fast WiFi, and 24/7 security.',
        ne: 'मुख्य स्थानमा कम्प्याक्ट र पूर्ण फर्निस्ड स्टुडियो अपार्टमेन्ट। एकल यात्री, विद्यार्थी, वा काम गर्ने पेशेवरका लागि आदर्श। किचनेट, एन-सूट बाथरुम, छिटो वाइफाइ, र २४/७ सुरक्षा।',
      };
    case 'car':
      return {
        en: 'Well-maintained vehicle available for self-drive or with driver. Ideal for city commuting, valley tours, or highway trips. Clean interior, regularly serviced, with full insurance coverage.',
        ne: 'सेल्फ-ड्राइभ वा चालक सहित उपलब्ध सवारी साधन। शहर यातायात, उपत्यका भ्रमण, वा राजमार्ग यात्राका लागि आदर्श। सफा भित्री भाग, नियमित सर्भिस, पूर्ण बिमा सहित।',
      };
    case 'bike':
      return {
        en: 'Motorcycle/scooter in excellent condition available for daily or weekly rental. Perfect for navigating Kathmandu traffic or scenic hill rides. Helmet and basic insurance included. RC book and government-compliant paperwork provided.',
        ne: 'दैनिक वा साप्ताहिक भाडामा उत्कृष्ट अवस्थामा मोटरसाइकल/स्कुटर उपलब्ध। काठमाडौँ ट्राफिक वा दर्शनीय पहाडी सवारीका लागि उपयुक्त। हेल्मेट र आधारभूत बिमा समावेश। आरसी पुस्तिका र सरकार-अनुपालन कागजात उपलब्ध।',
      };
    case 'equipment':
      return {
        en: 'Heavy-duty construction/industrial equipment available for daily or weekly hire. Well-serviced, safety-compliant, and ready for immediate use. Delivery within Kathmandu Valley available. Operator can be provided on request.',
        ne: 'दैनिक वा साप्ताहिक भाडामा उपलब्ध हेभी-ड्युटी निर्माण/औद्योगिक उपकरण। राम्रोसँग सर्भिस गरिएको, सुरक्षा-अनुपालन, र तत्काल उपयोगका लागि तयार। काठमाडौँ उपत्यकाभित्र डेलिभरी उपलब्ध। अनुरोधमा अपरेटर प्रदान गर्न सकिन्छ।',
      };
    case 'camera-electronics':
      return {
        en: 'Professional-grade camera and electronics available for daily or weekly rental. Kept in pristine condition with all accessories, batteries, and cables. Pickup from Thamel/Kathmandu or delivery available. Great for weddings, events, films, and travel photography.',
        ne: 'दैनिक वा साप्ताहिक भाडामा उपलब्ध प्रोफेशनल-ग्रेड क्यामरा र इलेक्ट्रोनिक्स। सबै सामान, ब्याट्री, र केबल सहित उत्कृष्ट अवस्थामा। थमेल/काठमाडौँबाट पिकअप वा डेलिभरी उपलब्ध। बिवाह, कार्यक्रम, फिल्म, र यात्रा फोटोग्राफीका लागि उत्कृष्ट।',
      };
    case 'event-space':
      return {
        en: 'Elegant event venue in the heart of Nepal, ideal for weddings, corporate events, birthday parties, and cultural programs. Fully air-conditioned, with modern AV equipment, decorative lighting, catering support, and ample parking. Capacity from 50 to 500+ guests.',
        ne: 'नेपालको केन्द्रमा सुरुचिपूर्ण कार्यक्रम स्थल, बिवाह, कर्पोरेट कार्यक्रम, जन्मदिन पार्टी, र सांस्कृतिक कार्यक्रमका लागि आदर्श। पूर्ण एयर-कन्डिसन, आधुनिक एभी उपकरण, सजावटी बत्ती, क्याटरिङ सहायता, र पर्याप्त पार्किङ। ५० देखि ५०० भन्दा बढी अतिथि क्षमता।',
      };
    case 'office-space':
      return {
        en: 'Modern coworking and private office space in a prime business location. High-speed fiber internet, ergonomic furniture, meeting room access, printing/scanning, and 24/7 secured entry. Perfect for startups, freelancers, and remote teams. Flexible daily, weekly, and monthly terms.',
        ne: 'मुख्य व्यापारिक स्थानमा आधुनिक को-वर्किङ र निजी कार्यालय ठाउँ। हाई-स्पिड फाइबर इन्टरनेट, एर्गोनोमिक फर्निचर, बैठक कोठा पहुँच, प्रिन्टिङ/स्क्यानिङ, र २४/७ सुरक्षित प्रवेश। स्टार्टअप, फ्रिल्यान्सर, र रिमोट टिमका लागि उत्तम। लचिलो दैनिक, साप्ताहिक, र मासिक सर्तहरू।',
      };
    case 'musical-instrument':
      return {
        en: 'Quality musical instrument available for rent by the day or week. Kept in excellent playing condition, regularly tuned, and cleaned before each rental. Carrying case/bag included. Suitable for events, practice sessions, studio recordings, and cultural programs.',
        ne: 'दिन वा हप्ताको हिसाबले भाडामा उपलब्ध गुणस्तरीय संगीत वाद्ययन्त्र। उत्कृष्ट बजाउने अवस्थामा राखिएको, नियमित ट्युन, र प्रत्येक भाडा अघि सफा गरिएको। क्यारिङ केस/ब्याग समावेश। कार्यक्रम, अभ्यास सत्र, स्टुडियो रेकर्डिङ र सांस्कृतिक कार्यक्रमका लागि उपयुक्त।',
      };
    case 'sports-equipment':
      return {
        en: 'High-quality sports and adventure gear available for daily or weekly rental. Ideal for trekking, cycling, water sports, and outdoor activities in Nepal. Equipment is sanitized, safety-checked, and ready to use. Delivery to trailheads available on request.',
        ne: 'दैनिक वा साप्ताहिक भाडामा उपलब्ध उच्च गुणस्तरका खेल र साहसिक सामान। नेपालमा ट्रेकिङ, साइकलिङ, जल खेलकुद, र आउटडोर गतिविधिका लागि आदर्श। उपकरण सफा, सुरक्षा-जाँच, र प्रयोगको लागि तयार। अनुरोधमा ट्रेलहेड डेलिभरी उपलब्ध।',
      };
    case 'parking-space':
      return {
        en: 'Secure and convenient parking space available for monthly rental. CCTV-monitored 24/7, with easy vehicle access. Suitable for cars, bikes, or SUVs. Located in a prime area with nearby amenities. Monthly and quarterly plans available.',
        ne: 'मासिक भाडामा उपलब्ध सुरक्षित र सुविधाजनक पार्किङ ठाउँ। २४/७ सीसीटीभी निगरानी, सजिलो गाडी पहुँच सहित। कार, बाइक, वा एसयुभीका लागि उपयुक्त। नजिकका सुविधाहरूसहित मुख्य क्षेत्रमा। मासिक र त्रैमासिक योजनाहरू उपलब्ध।',
      };
    case 'storage-space':
      return {
        en: 'Secure storage units available for personal and commercial use. Dry, clean space with 24/7 CCTV surveillance and restricted access. Ideal for household goods, business inventory, documents, and equipment. Flexible monthly plans. Loading/unloading assistance available.',
        ne: 'व्यक्तिगत र व्यावसायिक प्रयोगका लागि सुरक्षित भण्डारण इकाइहरू उपलब्ध। सुख्खा, सफा ठाउँ, २४/७ सीसीटीभी निगरानी र प्रतिबन्धित पहुँच सहित। घरको सामान, व्यापारिक इन्भेन्टरी, कागजात र उपकरणका लागि आदर्श। लचिलो मासिक योजनाहरू। लोडिङ/अनलोडिङ सहायता उपलब्ध।',
      };
    case 'clothing-costumes':
      return {
        en: 'Premium traditional and designer outfits available for rent. Dry-cleaned and professionally pressed before each rental. Ideal for Dashain, Tihar, Teej, weddings, photoshoots, and cultural events. Alterations available on request. Wide variety of sizes and styles.',
        ne: 'भाडामा उपलब्ध प्रिमियम परम्परागत र डिजाइनर पोशाक। प्रत्येक भाडा अघि ड्राई-क्लिन र व्यावसायिक रूपमा इस्त्री गरिएको। दशैँ, तिहार, तीज, बिवाह, फोटोसूट, र सांस्कृतिक कार्यक्रमका लागि आदर्श। अनुरोधमा परिवर्तन उपलब्ध। साइज र शैलीको विस्तृत विविधता।',
      };
    default:
      return {
        en: 'Quality rental available in a convenient Nepal location. Well maintained, clean, and ready for use. Contact us for availability and pricing details.',
        ne: 'नेपालको सुविधाजनक स्थानमा गुणस्तरीय भाडा उपलब्ध। राम्रोसँग मर्मत गरिएको, सफा, र प्रयोगको लागि तयार। उपलब्धता र मूल्य विवरणको लागि सम्पर्क गर्नुहोस्।',
      };
  }
}

// ─── MAIN SEED ───────────────────────────────────────────────────────────────

async function main() {
  console.log('🇳🇵 Starting GharBatai Nepal comprehensive database seeding...\n');

  // Clean existing data
  console.log('🧹 Cleaning existing data...');

  // Phase 2 tables may not exist yet (no migration); skip gracefully
  const safeDelete = async (fn: () => Promise<any>) => {
    try {
      await fn();
    } catch (e: any) {
      if (e?.code === 'P2021') {
        return;
      }

      if (e instanceof TypeError && /deleteMany/.test(e.message)) {
        return;
      }

      throw e;
    }
  };
  await safeDelete(() => prisma.bookingPriceBreakdown.deleteMany());
  await safeDelete(() => prisma.fxRateSnapshot.deleteMany());
  await safeDelete(() => prisma.availabilitySlot.deleteMany());
  await safeDelete(() => prisma.inventoryUnit.deleteMany());
  await safeDelete(() => prisma.listingAttributeValue.deleteMany());
  await safeDelete(() => prisma.categoryAttributeDefinition.deleteMany());
  await safeDelete(() => prisma.listingVersion.deleteMany());
  await safeDelete(() => prisma.listingContent.deleteMany());
  await safeDelete(() => prisma.identityDocument.deleteMany());
  await safeDelete(() => prisma.aiConversationTurn.deleteMany());
  await safeDelete(() => prisma.aiConversation.deleteMany());
  await safeDelete(() => prisma.anomalyDetection.deleteMany());
  await safeDelete(() => prisma.complianceRecord.deleteMany());
  await safeDelete(() => prisma.deviceFingerprint.deleteMany());
  await safeDelete(() => prisma.demandForecast.deleteMany());
  await safeDelete(() => prisma.demandSignal.deleteMany());
  await safeDelete(() => prisma.disputeEscalation.deleteMany());
  await safeDelete(() => prisma.escrowTransaction.deleteMany());
  await safeDelete(() => prisma.fraudSignal.deleteMany());
  await safeDelete(() => prisma.hostActivationCampaign.deleteMany());
  await safeDelete(() => prisma.inventoryGraphEdge.deleteMany());
  await safeDelete(() => prisma.inventoryGraphNode.deleteMany());
  await safeDelete(() => prisma.marketOpportunity.deleteMany());
  await safeDelete(() => prisma.marketplaceHealthMetric.deleteMany());
  await safeDelete(() => prisma.moderationAction.deleteMany());
  await safeDelete(() => prisma.platformMetric.deleteMany());
  await safeDelete(() => prisma.pricingRecommendation.deleteMany());
  await safeDelete(() => prisma.reputationScore.deleteMany());
  await safeDelete(() => prisma.searchEvent.deleteMany());
  await safeDelete(() => prisma.serviceHealthCheck.deleteMany());
  await safeDelete(() => prisma.trustScore.deleteMany());
  await safeDelete(() => prisma.userSearchProfile.deleteMany());

  await prisma.disputeResolution.deleteMany();
  await prisma.disputeTimelineEvent.deleteMany();
  await prisma.disputeResponse.deleteMany();
  await prisma.disputeEvidence.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.messageReadReceipt.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.conditionReport.deleteMany();
  await prisma.insuranceClaim.deleteMany();
  await prisma.insurancePolicy.deleteMany();
  await prisma.bookingStateHistory.deleteMany();
  await prisma.depositHold.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.favoriteListing.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.userPreferences.deleteMany();
  await prisma.deviceToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  await prisma.cancellationPolicy.deleteMany();
  await prisma.emailTemplate.deleteMany();
  console.log('✓ Cleaned existing data\n');

  // ── Cancellation Policies ──────────────────────────────────────────────────

  console.log('📋 Creating cancellation policies...');
  const policies = await Promise.all([
    prisma.cancellationPolicy.create({
      data: {
        name: 'Flexible',
        description: 'Free cancellation up to 24 hours before check-in',
        type: 'flexible',
        fullRefundHours: 24,
        partialRefundHours: 48,
        partialRefundPercent: new Prisma.Decimal(1.0),
        noRefundHours: 0,
      },
    }),
    prisma.cancellationPolicy.create({
      data: {
        name: 'Moderate',
        description: 'Free cancellation up to 7 days before check-in',
        type: 'moderate',
        fullRefundHours: 168,
        partialRefundHours: 336,
        partialRefundPercent: new Prisma.Decimal(0.5),
        noRefundHours: 24,
      },
    }),
    prisma.cancellationPolicy.create({
      data: {
        name: 'Strict',
        description: 'No refunds unless property is unavailable',
        type: 'strict',
        fullRefundHours: 0,
        partialRefundHours: 0,
        partialRefundPercent: new Prisma.Decimal(0),
        noRefundHours: 0,
      },
    }),
    prisma.cancellationPolicy.create({
      data: {
        name: 'Super Flexible',
        description: 'Free cancellation up to 48 hours before check-in',
        type: 'super_flexible',
        fullRefundHours: 48,
        partialRefundHours: 72,
        partialRefundPercent: new Prisma.Decimal(1.0),
        noRefundHours: 0,
      },
    }),
  ]);
  console.log(`✓ Created ${policies.length} cancellation policies\n`);

  // ── Categories (Nepal-focused) ─────────────────────────────────────────────

  console.log('📂 Creating categories...');
  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Apartment', slug: 'apartment', description: 'Apartments and flats', icon: 'apartment', isActive: true, active: true, order: 1, pricingMode: 'PER_NIGHT', searchableFields: ['bedrooms', 'bathrooms', 'amenities'], requiredFields: ['bedrooms', 'bathrooms', 'address'] } }),
    prisma.category.create({ data: { name: 'House', slug: 'house', description: 'Entire houses', icon: 'house', isActive: true, active: true, order: 2, pricingMode: 'PER_NIGHT', searchableFields: ['bedrooms', 'bathrooms', 'amenities'], requiredFields: ['bedrooms', 'bathrooms', 'address'] } }),
    prisma.category.create({ data: { name: 'Car', slug: 'car', description: 'Cars and SUVs for rent', icon: 'car', isActive: true, active: true, order: 3, pricingMode: 'PER_DAY', searchableFields: ['make', 'model'], requiredFields: ['make', 'model'] } }),
    prisma.category.create({ data: { name: 'Bike', slug: 'bike', description: 'Motorcycles and scooters', icon: 'bike', isActive: true, active: true, order: 4, pricingMode: 'PER_DAY', searchableFields: ['type', 'brand'], requiredFields: ['type'] } }),
    prisma.category.create({ data: { name: 'Equipment', slug: 'equipment', description: 'Tools, generators, and equipment', icon: 'tools', isActive: true, active: true, order: 5, pricingMode: 'PER_DAY', searchableFields: ['type', 'condition'], requiredFields: ['type'] } }),
    prisma.category.create({ data: { name: 'Camera & Electronics', slug: 'camera-electronics', description: 'Cameras, drones, electronics', icon: 'camera', isActive: true, active: true, order: 6, pricingMode: 'PER_DAY', searchableFields: ['brand', 'model'], requiredFields: ['brand', 'type'] } }),
    prisma.category.create({ data: { name: 'Villa', slug: 'villa', description: 'Luxury villas and resorts', icon: 'villa', isActive: true, active: true, order: 7, pricingMode: 'PER_NIGHT', searchableFields: ['bedrooms', 'bathrooms', 'pool'], requiredFields: ['bedrooms', 'bathrooms', 'address'] } }),
    prisma.category.create({ data: { name: 'Event Space', slug: 'event-space', description: 'Party palaces, banquets, venues', icon: 'event', isActive: true, active: true, order: 8, pricingMode: 'PER_HOUR', searchableFields: ['capacity', 'amenities'], requiredFields: ['capacity', 'address'] } }),
    prisma.category.create({ data: { name: 'Office Space', slug: 'office-space', description: 'Coworking and offices', icon: 'office', isActive: true, active: true, order: 9, pricingMode: 'PER_MONTH', searchableFields: ['desks', 'amenities'], requiredFields: ['address'] } }),
    prisma.category.create({ data: { name: 'Musical Instrument', slug: 'musical-instrument', description: 'Tabla, madal, guitar, and more', icon: 'music', isActive: true, active: true, order: 10, pricingMode: 'PER_DAY', searchableFields: ['instrument', 'brand'], requiredFields: ['instrument'] } }),
    prisma.category.create({ data: { name: 'Sports Equipment', slug: 'sports-equipment', description: 'Trekking, rafting, sports gear', icon: 'sports', isActive: true, active: true, order: 11, pricingMode: 'PER_WEEK', searchableFields: ['sport', 'type'], requiredFields: ['type'] } }),
    prisma.category.create({ data: { name: 'Parking Space', slug: 'parking-space', description: 'Parking spaces and garages', icon: 'parking', isActive: true, active: true, order: 12, pricingMode: 'PER_MONTH', searchableFields: ['location'], requiredFields: ['location'] } }),
    prisma.category.create({ data: { name: 'Storage Space', slug: 'storage-space', description: 'Storage units and godowns', icon: 'storage', isActive: true, active: true, order: 13, pricingMode: 'PER_MONTH', searchableFields: ['size', 'type'], requiredFields: ['size', 'address'] } }),
    prisma.category.create({ data: { name: 'Clothing & Costumes', slug: 'clothing-costumes', description: 'Formal wear, costumes, jewelry', icon: 'clothing', isActive: true, active: true, order: 14, pricingMode: 'CUSTOM', searchableFields: ['type', 'size'], requiredFields: ['type', 'size'] } }),
    prisma.category.create({ data: { name: 'Studio', slug: 'studio', description: 'Studios and single rooms', icon: 'studio', isActive: true, active: true, order: 15, pricingMode: 'PER_NIGHT', searchableFields: ['amenities'], requiredFields: ['address'] } }),
  ]);
  console.log(`✓ Created ${categories.length} categories\n`);

  // ── Email Templates ────────────────────────────────────────────────────────

  console.log('📧 Creating email templates (all 14 types)...');
  const emailTemplates = await Promise.all([
    prisma.emailTemplate.create({ data: { name: 'booking_confirmation', subject: 'बुकिङ पुष्टि - {{bookingId}}', body: '<h1>तपाईंको बुकिङ पुष्टि भयो</h1><p>बुकिङ ID: {{bookingId}}</p>', type: 'BOOKING_CONFIRMATION', description: 'Sent when a booking is confirmed', variables: ['bookingId', 'listingTitle', 'checkInDate', 'checkOutDate'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'booking_cancelled', subject: 'बुकिङ रद्द - {{bookingId}}', body: '<h1>तपाईंको बुकिङ रद्द गरिएको छ</h1>', type: 'BOOKING_CANCELLATION', description: 'Sent on cancellation', variables: ['bookingId', 'refundAmount'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'payment_confirmation', subject: 'भुक्तानी पुष्टि - रु {{amount}}', body: '<h1>भुक्तानी पुष्टि भयो</h1><p>रकम: रु {{amount}}</p>', type: 'PAYMENT_CONFIRMATION', description: 'Sent when payment is confirmed', variables: ['amount', 'currency', 'bookingId'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'payment_receipt', subject: 'भुक्तानी रसिद - रु {{amount}}', body: '<h1>भुक्तानी प्राप्त भयो</h1><p>रकम: रु {{amount}}</p>', type: 'PAYMENT_RECEIPT', description: 'Sent when payment is received', variables: ['amount', 'currency', 'bookingId'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'welcome', subject: 'GharBatai मा स्वागत छ!', body: '<h1>नमस्ते {{firstName}}!</h1><p>GharBatai मा तपाईंलाई स्वागत छ।</p>', type: 'WELCOME', description: 'Welcome email for new users', variables: ['firstName', 'lastName'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'password_reset', subject: 'पासवर्ड रिसेट अनुरोध', body: '<h1>पासवर्ड रिसेट</h1><p>तपाईंको रिसेट लिंक: {{resetLink}}</p>', type: 'PASSWORD_RESET', description: 'Password reset request', variables: ['resetLink', 'firstName'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'email_verification', subject: 'इमेल प्रमाणीकरण - GharBatai', body: '<h1>इमेल प्रमाणित गर्नुहोस्</h1><p>लिंक: {{verificationLink}}</p>', type: 'EMAIL_VERIFICATION', description: 'Email verification link', variables: ['verificationLink', 'firstName'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'listing_approved', subject: 'तपाईंको लिस्टिङ स्वीकृत भयो!', body: '<h1>बधाई छ!</h1><p>तपाईंको "{{listingTitle}}" स्वीकृत भयो।</p>', type: 'LISTING_APPROVED', description: 'Sent when listing is approved', variables: ['listingTitle', 'listingId'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'listing_rejected', subject: 'लिस्टिङ अस्वीकृत - {{listingTitle}}', body: '<h1>लिस्टिङ अस्वीकृत</h1><p>कारण: {{reason}}</p>', type: 'LISTING_REJECTED', description: 'Sent when listing is rejected', variables: ['listingTitle', 'reason'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'review_reminder', subject: 'कृपया आफ्नो अनुभव मूल्याङ्कन गर्नुहोस्', body: '<h1>तपाईंको अनुभव कस्तो थियो?</h1>', type: 'REVIEW_REMINDER', description: 'Sent to request a review', variables: ['listingTitle', 'bookingId'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'payout_notification', subject: 'भुक्तानी प्रक्रिया पूरा - रु {{amount}}', body: '<h1>तपाईंको भुक्तानी पठाइयो</h1><p>रकम: रु {{amount}}</p>', type: 'PAYOUT_NOTIFICATION', description: 'Sent when payout is processed', variables: ['amount', 'currency'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'dispute_opened', subject: 'विवाद खोलिएको छ - #{{disputeId}}', body: '<h1>नयाँ विवाद</h1><p>विवाद #{{disputeId}} दर्ता भएको छ।</p>', type: 'DISPUTE_OPENED', description: 'Sent when dispute is opened', variables: ['disputeId', 'bookingId'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'dispute_resolved', subject: 'विवाद समाधान भयो - #{{disputeId}}', body: '<h1>विवाद समाधान</h1><p>विवाद #{{disputeId}} समाधान भएको छ।</p>', type: 'DISPUTE_RESOLVED', description: 'Sent when dispute is resolved', variables: ['disputeId', 'outcome'], isActive: true, category: 'transactional' } }),
    prisma.emailTemplate.create({ data: { name: 'system_notification', subject: 'GharBatai प्रणाली सूचना', body: '<h1>प्रणाली सूचना</h1><p>{{message}}</p>', type: 'SYSTEM_NOTIFICATION', description: 'General system notifications', variables: ['message'], isActive: true, category: 'system' } }),
  ]);
  console.log(`✓ Created ${emailTemplates.length} email templates (all 14 EmailTemplateType values)\n`);

  // ── Users (Nepali names, Nepal locations) ──────────────────────────────────

  console.log('👥 Creating users...');
  const hashedPassword = await bcrypt.hash('password123', 10);
  const testPassword = await bcrypt.hash('Test123!@#', 10);

  // E2E test users
  console.log('🧪 Creating E2E test users...');
  const testRenter = await prisma.user.create({
    data: {
      email: 'renter@test.com', username: 'testrenter', passwordHash: testPassword,
      firstName: 'Sagar', lastName: 'Shrestha', phone: '+977-984-1234567',
      profilePhotoUrl: faker.image.avatar(), bio: 'E2E test renter – Kathmandu',
      role: 'USER', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      isActive: true, averageRating: 4.5, totalReviews: 12, responseRate: 95,
      responseTime: '< 2 hours', city: 'Kathmandu', state: 'Bagmati Province',
      country: 'Nepal', lastLoginAt: new Date(), mfaEnabled: false,
      stripeCustomerId: `cus_test_renter_${faker.string.alphanumeric(10)}`,
    },
  });
  console.log('✓ Created test renter: renter@test.com (Sagar Shrestha)');

  const testOwner = await prisma.user.create({
    data: {
      email: 'owner@test.com', username: 'testowner', passwordHash: testPassword,
      firstName: 'Anita', lastName: 'Sharma', phone: '+977-985-2345678',
      profilePhotoUrl: faker.image.avatar(), bio: 'E2E test owner – Pokhara host',
      role: 'HOST', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      isActive: true, averageRating: 4.8, totalReviews: 45, responseRate: 98,
      responseTime: '< 1 hour', city: 'Pokhara', state: 'Gandaki Province',
      country: 'Nepal', lastLoginAt: new Date(), mfaEnabled: false,
      stripeCustomerId: `cus_test_owner_${faker.string.alphanumeric(10)}`,
      stripeConnectId: `acct_test_owner_${faker.string.alphanumeric(12)}`,
      stripeChargesEnabled: true, stripePayoutsEnabled: true, stripeOnboardingComplete: true,
    },
  });
  console.log('✓ Created test owner: owner@test.com (Anita Sharma)');

  const testAdmin = await prisma.user.create({
    data: {
      email: 'admin@test.com', username: 'testadmin', passwordHash: testPassword,
      firstName: 'Rajesh', lastName: 'Pandey', phone: '+977-986-3456789',
      profilePhotoUrl: faker.image.avatar(), bio: 'E2E test admin',
      role: 'ADMIN', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      isActive: true, averageRating: 5, totalReviews: 5, responseRate: 100,
      responseTime: '< 1 hour', city: 'Kathmandu', state: 'Bagmati Province',
      country: 'Nepal', lastLoginAt: new Date(), mfaEnabled: false,
    },
  });
  console.log('✓ Created test admin: admin@test.com (Rajesh Pandey)\n');

  // Platform admin, superadmin, host with MFA
  const platformAdmin = await prisma.user.create({
    data: {
      email: 'admin@gharbatai.com', username: 'admin', passwordHash: hashedPassword,
      firstName: 'Hari', lastName: 'Bhattarai', phone: '+977-984-0000001',
      profilePhotoUrl: faker.image.avatar(), bio: 'Platform administrator',
      role: 'ADMIN', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      isActive: true, averageRating: 5, totalReviews: 0, responseRate: 100,
      responseTime: '< 1 hour', city: 'Kathmandu', state: 'Bagmati Province',
      country: 'Nepal', lastLoginAt: new Date(), mfaEnabled: true,
    },
  });

  const superAdmin = await prisma.user.create({
    data: {
      email: 'superadmin@gharbatai.com', username: 'superadmin', passwordHash: hashedPassword,
      firstName: 'Prakash', lastName: 'Koirala', phone: '+977-984-0000002',
      profilePhotoUrl: faker.image.avatar(), bio: 'Super administrator',
      role: 'SUPER_ADMIN', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      isActive: true, lastLoginAt: new Date(), mfaEnabled: true,
      city: 'Kathmandu', state: 'Bagmati Province', country: 'Nepal',
    },
  });

  const hostMFA = await prisma.user.create({
    data: {
      email: 'host.mfa@gharbatai.com', username: 'hostmfa', passwordHash: hashedPassword,
      firstName: 'Dipesh', lastName: 'Gurung', phone: '+977-986-1111111',
      profilePhotoUrl: faker.image.avatar(), bio: 'MFA-enabled host',
      role: 'HOST', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      isActive: true, averageRating: 4.7, totalReviews: 30, responseRate: 95,
      responseTime: '< 1 hour', city: 'Pokhara', state: 'Gandaki Province',
      country: 'Nepal', lastLoginAt: new Date(), mfaEnabled: true,
      stripeCustomerId: `cus_hostmfa_${faker.string.alphanumeric(10)}`,
      stripeConnectId: `acct_hostmfa_${faker.string.alphanumeric(12)}`,
      stripeChargesEnabled: true, stripePayoutsEnabled: true, stripeOnboardingComplete: true,
    },
  });

  // Specialized admin roles (ALL UserRole values covered)
  const opsAdmin = await prisma.user.create({
    data: {
      email: 'ops@gharbatai.com', username: 'opsadmin', passwordHash: hashedPassword,
      firstName: 'Binod', lastName: 'Karki', phone: '+977-984-3333333',
      profilePhotoUrl: faker.image.avatar(), bio: 'सञ्चालन प्रशासक',
      role: 'OPERATIONS_ADMIN', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      isActive: true, city: 'Kathmandu', state: 'Bagmati Province', country: 'Nepal', lastLoginAt: new Date(),
    },
  });
  const finAdmin = await prisma.user.create({
    data: {
      email: 'finance@gharbatai.com', username: 'finadmin', passwordHash: hashedPassword,
      firstName: 'Sarita', lastName: 'Neupane', phone: '+977-985-4444444',
      profilePhotoUrl: faker.image.avatar(), bio: 'वित्तीय प्रशासक',
      role: 'FINANCE_ADMIN', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      isActive: true, city: 'Lalitpur', state: 'Bagmati Province', country: 'Nepal', lastLoginAt: new Date(),
    },
  });
  const supportAdmin = await prisma.user.create({
    data: {
      email: 'support@gharbatai.com', username: 'supportadmin', passwordHash: hashedPassword,
      firstName: 'Nirmala', lastName: 'Thapa', phone: '+977-986-5555555',
      profilePhotoUrl: faker.image.avatar(), bio: 'ग्राहक सहायता प्रशासक',
      role: 'SUPPORT_ADMIN', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      isActive: true, city: 'Bhaktapur', state: 'Bagmati Province', country: 'Nepal', lastLoginAt: new Date(),
    },
  });
  const customerUser = await prisma.user.create({
    data: {
      email: 'customer@gharbatai.com', username: 'customeruser', passwordHash: hashedPassword,
      firstName: 'Manish', lastName: 'Maharjan', phone: '+977-980-6666666',
      profilePhotoUrl: faker.image.avatar(), bio: 'नियमित ग्राहक',
      role: 'CUSTOMER', status: 'ACTIVE', emailVerified: true, phoneVerified: true,
      isActive: true, city: 'Kirtipur', state: 'Bagmati Province', country: 'Nepal', lastLoginAt: new Date(),
    },
  });

  // 100 regular users with Nepali names and Nepal locations
  const regularUsers = await Promise.all(
    Array.from({ length: 100 }, async (_, i) => {
      const isHost = i % 3 === 0;
      const name = randomNepaliName();
      const loc = randomLocation();
      return prisma.user.create({
        data: {
          email: `${name.username}@gmail.com`,
          username: name.username,
          passwordHash: hashedPassword,
          firstName: name.first,
          lastName: name.last,
          phone: randomNepalPhone(),
          profilePhotoUrl: faker.image.avatar(),
          bio: faker.lorem.sentence(),
          role: isHost ? 'HOST' : 'USER',
          status: faker.helpers.weightedArrayElement([
            { weight: 80, value: 'ACTIVE' },
            { weight: 8, value: 'SUSPENDED' },
            { weight: 7, value: 'PENDING_VERIFICATION' },
            { weight: 5, value: 'DELETED' },
          ]),
          emailVerified: faker.datatype.boolean({ probability: 0.9 }),
          phoneVerified: faker.datatype.boolean({ probability: 0.7 }),
          isActive: true,
          averageRating: isHost ? faker.number.float({ min: 3.5, max: 5, fractionDigits: 1 }) : 0,
          totalReviews: isHost ? faker.number.int({ min: 0, max: 200 }) : 0,
          responseRate: isHost ? faker.number.int({ min: 80, max: 100 }) : 0,
          responseTime: isHost ? '< 2 hours' : undefined,
          city: loc.city,
          state: loc.state,
          country: 'Nepal',
          lastLoginAt: faker.date.recent({ days: 30 }),
          mfaEnabled: faker.datatype.boolean({ probability: 0.2 }),
          stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
          stripeConnectId: isHost ? `acct_${faker.string.alphanumeric(16)}` : undefined,
          stripeChargesEnabled: isHost ? faker.datatype.boolean({ probability: 0.8 }) : false,
          stripePayoutsEnabled: isHost ? faker.datatype.boolean({ probability: 0.8 }) : false,
          stripeOnboardingComplete: isHost ? faker.datatype.boolean({ probability: 0.7 }) : false,
        },
      });
    }),
  );

  const users = [testRenter, testOwner, testAdmin, platformAdmin, superAdmin, hostMFA, opsAdmin, finAdmin, supportAdmin, customerUser, ...regularUsers];
  console.log(`✓ Created ${users.length} users\n`);

  // ── User Preferences (en/ne, NPR, Asia/Kathmandu) ─────────────────────────

  console.log('⚙️  Creating user preferences...');
  const userPreferences = await Promise.all(
    users.map((user) =>
      prisma.userPreferences.create({
        data: {
          userId: user.id,
          language: faker.helpers.arrayElement(['en', 'ne']),
          currency: faker.helpers.weightedArrayElement([
            { weight: 80, value: 'NPR' },
            { weight: 15, value: 'USD' },
            { weight: 5, value: 'INR' },
          ]),
          timezone: 'Asia/Kathmandu',
          emailNotifications: faker.datatype.boolean({ probability: 0.8 }),
          pushNotifications: faker.datatype.boolean({ probability: 0.6 }),
          smsNotifications: faker.datatype.boolean({ probability: 0.3 }),
          marketingEmails: faker.datatype.boolean({ probability: 0.4 }),
          autoAcceptBookings: faker.datatype.boolean({ probability: 0.2 }),
          instantBook: faker.datatype.boolean({ probability: 0.3 }),
          minBookingDuration: faker.number.int({ min: 1, max: 7 }),
          maxBookingDuration: faker.number.int({ min: 30, max: 365 }),
          advanceBookingNotice: faker.number.int({ min: 1, max: 48 }),
        },
      }),
    ),
  );
  console.log(`✓ Created ${userPreferences.length} user preferences\n`);

  // ── Sessions & Device Tokens ───────────────────────────────────────────────

  console.log('🔐 Creating sessions...');
  const sessions = await Promise.all(
    users.slice(0, 50).map((user) =>
      prisma.session.create({
        data: {
          userId: user.id, token: generateToken(), refreshToken: generateToken(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ipAddress: faker.internet.ipv4(), userAgent: faker.internet.userAgent(),
        },
      }),
    ),
  );
  console.log(`✓ Created ${sessions.length} sessions`);

  console.log('📱 Creating device tokens...');
  const deviceTokens = await Promise.all(
    users.slice(0, 40).map((user) =>
      prisma.deviceToken.create({
        data: {
          userId: user.id, token: `token_${faker.string.alphanumeric(32)}`,
          platform: faker.helpers.arrayElement(['ios', 'android', 'web']),
          active: faker.datatype.boolean({ probability: 0.8 }),
        },
      }),
    ),
  );
  console.log(`✓ Created ${deviceTokens.length} device tokens\n`);

  // ── Identity Documents (ALL 4 IdentityDocumentType values, ALL VerificationStatus values) ──

  console.log('🪪 Creating identity documents...');
  const identityDocs = await Promise.all(
    users.slice(0, 60).flatMap((user, i) => {
      const docTypes: Array<{ type: string; url: string }> = [];
      // Ensure all 4 document types are covered across users
      if (i % 4 === 0) docTypes.push({ type: 'NATIONAL_ID', url: `https://example.com/docs/citizenship-${faker.string.alphanumeric(12)}.pdf` });
      else if (i % 4 === 1) docTypes.push({ type: 'PASSPORT', url: `https://example.com/docs/passport-${faker.string.alphanumeric(12)}.pdf` });
      else if (i % 4 === 2) docTypes.push({ type: 'DRIVERS_LICENSE', url: `https://example.com/docs/license-${faker.string.alphanumeric(12)}.pdf` });
      else docTypes.push({ type: 'OTHER', url: `https://example.com/docs/other-${faker.string.alphanumeric(12)}.pdf` });
      // Ensure all 4 VerificationStatus values covered
      const statuses = ['PENDING', 'VERIFIED', 'APPROVED', 'REJECTED'];
      return docTypes.map((doc) =>
        prisma.identityDocument.create({
          data: {
            userId: user.id,
            documentType: doc.type as any,
            documentUrl: doc.url,
            status: statuses[i % 4] as any,
            rejectionReason: statuses[i % 4] === 'REJECTED' ? 'कागजात अस्पष्ट छ, कृपया पुनः अपलोड गर्नुहोस्' : undefined,
            verifiedAt: ['VERIFIED', 'APPROVED'].includes(statuses[i % 4]) ? faker.date.recent({ days: 60 }) : undefined,
            verifiedBy: ['VERIFIED', 'APPROVED'].includes(statuses[i % 4]) ? platformAdmin.id : undefined,
            expiresAt: doc.type === 'PASSPORT' ? faker.date.future({ years: 5 }) : doc.type === 'DRIVERS_LICENSE' ? faker.date.future({ years: 3 }) : undefined,
          },
        }).catch(() => null),
      );
    }),
  );
  console.log(`✓ Created ${identityDocs.filter(Boolean).length} identity documents (ALL 4 types, ALL verification statuses)\n`);

  // ── Organizations ──────────────────────────────────────────────────────────

  console.log('🏢 Creating organizations...');
  const hostUsers = users.filter((u) => u.role === 'HOST');
  const organizations = await Promise.all(
    hostUsers.slice(0, 15).map((user) => {
      const loc = randomLocation();
      const orgName = faker.helpers.arrayElement([
        `${user.lastName} Properties`, `${loc.city} Rentals`, `Nepal ${faker.company.buzzNoun()} Hub`,
        `${user.firstName}'s Stays`, `Himalayan ${faker.company.buzzNoun()}`,
      ]);
      return prisma.organization.create({
        data: {
          name: orgName, slug: `${faker.helpers.slugify(orgName).toLowerCase()}-${faker.string.alphanumeric(5)}`,
          description: faker.lorem.paragraph(), logo: faker.image.url(),
          website: faker.internet.url(), email: faker.internet.email(),
          phone: randomNepalPhone(), address: `Ward ${faker.number.int({ min: 1, max: 35 })}, ${randomTole()}`,
          city: loc.city, state: loc.state, country: 'Nepal',
          ownerId: user.id, businessType: faker.helpers.arrayElement(['INDIVIDUAL', 'LLC', 'CORPORATION']),
          status: 'ACTIVE', verificationStatus: faker.helpers.arrayElement(['PENDING', 'VERIFIED', 'REJECTED']),
        },
      });
    }),
  );
  console.log(`✓ Created ${organizations.length} organizations`);

  const orgMembers = await Promise.all(
    organizations.flatMap((org) =>
      users.slice(0, 5).filter((u) => u.id !== org.ownerId).map((user) =>
        prisma.organizationMember.create({
          data: { organizationId: org.id, userId: user.id, role: faker.helpers.arrayElement(['OWNER', 'ADMIN', 'MEMBER']) },
        }).catch(() => null),
      ),
    ),
  );
  console.log(`✓ Created ${orgMembers.filter(Boolean).length} organization members\n`);

  // ── Listings (Nepal-specific) ──────────────────────────────────────────────

  console.log('🏠 Creating listings with Nepal data...');
  const listings: any[] = [];

  for (const category of categories) {
    const count = category.slug === 'apartment' ? 80 : category.slug === 'house' ? 60 : 40;

    for (let i = 0; i < count; i++) {
      const owner = hostUsers[Math.floor(Math.random() * hostUsers.length)];
      const policy = policies[Math.floor(Math.random() * policies.length)];
      const org = organizations[Math.floor(Math.random() * organizations.length)];
      const loc = randomLocation();
      const area = randomTole();

      // Category-specific descriptors
      let descriptor = area;
      if (category.slug === 'car') descriptor = VEHICLE_TYPES[i % VEHICLE_TYPES.length];
      else if (category.slug === 'bike') descriptor = BIKE_TYPES[i % BIKE_TYPES.length];
      else if (category.slug === 'equipment') descriptor = EQUIPMENT_TYPES[i % EQUIPMENT_TYPES.length];
      else if (category.slug === 'camera-electronics') descriptor = CAMERA_TYPES[i % CAMERA_TYPES.length];
      else if (category.slug === 'musical-instrument') descriptor = MUSICAL_INSTRUMENTS[i % MUSICAL_INSTRUMENTS.length];
      else if (category.slug === 'sports-equipment') descriptor = SPORTS_ITEMS[i % SPORTS_ITEMS.length];
      else if (category.slug === 'clothing-costumes') descriptor = CLOTHING_TYPES[i % CLOTHING_TYPES.length];
      else if (category.slug === 'event-space') descriptor = EVENT_TYPES[i % EVENT_TYPES.length];
      else if (category.slug === 'office-space') descriptor = OFFICE_TYPES[i % OFFICE_TYPES.length];
      else if (category.slug === 'parking-space') descriptor = PARKING_TYPES[i % PARKING_TYPES.length];
      // For accommodation/storage, descriptor stays as area (neighbourhood name)

      const titles = getListingTitle(category.slug, area, descriptor);
      const descs = getListingDescription(category.slug);

      // Nepal-appropriate pricing in NPR
      const priceMap: Record<string, { min: number; max: number }> = {
        apartment: { min: 2000, max: 15000 },
        house: { min: 5000, max: 30000 },
        car: { min: 3000, max: 12000 },
        bike: { min: 500, max: 3000 },
        equipment: { min: 500, max: 8000 },
        'camera-electronics': { min: 1000, max: 5000 },
        villa: { min: 15000, max: 80000 },
        'event-space': { min: 20000, max: 150000 },
        'office-space': { min: 10000, max: 50000 },
        'musical-instrument': { min: 200, max: 2000 },
        'sports-equipment': { min: 300, max: 3000 },
        'parking-space': { min: 3000, max: 10000 },
        'storage-space': { min: 5000, max: 20000 },
        'clothing-costumes': { min: 500, max: 5000 },
        studio: { min: 1500, max: 8000 },
      };
      const priceRange = priceMap[category.slug] || { min: 1000, max: 10000 };
      const basePrice = faker.number.float({ min: priceRange.min, max: priceRange.max, fractionDigits: 0 });

      const listing = await prisma.listing.create({
        data: {
          title: titles.en,
          slug: `${category.slug}-${loc.city.toLowerCase()}-${i}-${faker.string.alphanumeric(6)}`,
          description: descs.en,
          address: `Ward ${faker.number.int({ min: 1, max: 35 })}, ${area}`,
          city: loc.city,
          state: loc.state,
          zipCode: loc.zip,
          country: 'Nepal',
          latitude: loc.lat + (Math.random() - 0.5) * 0.05,
          longitude: loc.lng + (Math.random() - 0.5) * 0.05,
          type: (() => {
            switch (category.slug) {
              case 'apartment': return 'APARTMENT';
              case 'house': return 'HOUSE';
              case 'villa': return 'VILLA';
              case 'studio': return 'STUDIO';
              case 'event-space': return faker.helpers.arrayElement(['CABIN', 'OTHER']);
              case 'office-space': return faker.helpers.arrayElement(['LOFT', 'OTHER']);
              default: return 'OTHER';
            }
          })(),
          status: faker.helpers.weightedArrayElement([
            { weight: 50, value: 'AVAILABLE' },
            { weight: 15, value: 'RENTED' },
            { weight: 10, value: 'MAINTENANCE' },
            { weight: 8, value: 'UNAVAILABLE' },
            { weight: 7, value: 'DRAFT' },
            { weight: 5, value: 'SUSPENDED' },
            { weight: 5, value: 'ARCHIVED' },
          ]),
          verificationStatus: faker.helpers.arrayElement(['PENDING', 'VERIFIED', 'APPROVED', 'REJECTED']),
          condition: faker.helpers.arrayElement(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']),
          bookingMode: faker.helpers.arrayElement(['REQUEST', 'INSTANT_BOOK']),
          basePrice: new Prisma.Decimal(basePrice),
          currency: 'NPR',
          securityDeposit: new Prisma.Decimal(basePrice * 2),
          cleaningFee: new Prisma.Decimal(Math.max(500, basePrice * 0.1)),
          amenities: faker.helpers.arrayElements(
            CATEGORY_AMENITIES[category.slug] ?? AMENITIES,
            { min: 3, max: Math.min(8, (CATEGORY_AMENITIES[category.slug] ?? AMENITIES).length) },
          ),
          features: faker.helpers.arrayElements(['Pet Friendly', 'Furnished', 'Mountain View', 'Wheelchair Accessible'], { min: 1, max: 3 }),
          photos: Array.from({ length: faker.number.int({ min: 4, max: 10 }) }, () =>
            `https://picsum.photos/seed/${faker.string.alphanumeric(12)}/800/600.jpg`,
          ),
          rules: faker.helpers.arrayElements(
            CATEGORY_RULES[category.slug] ?? RULES_EN,
            { min: 2, max: Math.min(4, (CATEGORY_RULES[category.slug] ?? RULES_EN).length) },
          ),
          ownerId: owner.id,
          categoryId: category.id,
          cancellationPolicyId: policy.id,
          organizationId: Math.random() > 0.7 ? org.id : undefined,
          bedrooms: ['apartment', 'house', 'villa', 'studio'].includes(category.slug) ? faker.number.int({ min: 1, max: 5 }) : undefined,
          bathrooms: ['apartment', 'house', 'villa', 'studio'].includes(category.slug) ? faker.number.float({ min: 1, max: 4, fractionDigits: 1 }) : undefined,
          maxGuests: faker.number.int({ min: 2, max: 10 }),
          averageRating: faker.number.float({ min: 3, max: 5, fractionDigits: 1 }),
          totalReviews: faker.number.int({ min: 0, max: 100 }),
          totalBookings: faker.number.int({ min: 0, max: 50 }),
          views: faker.number.int({ min: 50, max: 2000 }),
          viewCount: faker.number.int({ min: 50, max: 2000 }),
          instantBookable: faker.datatype.boolean({ probability: 0.6 }),
          minStayNights: 1,
          maxStayNights: faker.number.int({ min: 30, max: 365 }),
          checkInTime: '14:00',
          checkOutTime: '11:00',
          weeklyDiscount: faker.number.int({ min: 5, max: 20 }),
          monthlyDiscount: faker.number.int({ min: 10, max: 30 }),
          featured: faker.datatype.boolean({ probability: 0.1 }),
          isActive: true,
        },
      });
      listings.push({ ...listing, _titleNe: titles.ne, _descNe: descs.ne });
    }
  }
  console.log(`✓ Created ${listings.length} listings\n`);

  // ── Listing Content (bilingual en + ne) ────────────────────────────────────

  console.log('🌐 Creating bilingual listing content (en + ne)...');
  let contentCount = 0;
  for (const listing of listings) {
    try {
      // English content
      await prisma.listingContent.create({
        data: {
          listingId: listing.id,
          locale: 'en',
          title: listing.title,
          description: listing.description || '',
          rules: (listing.rules || []).join('\n'),
          highlights: JSON.stringify(faker.helpers.arrayElements(AMENITIES, { min: 2, max: 5 })),
        },
      });
      // Nepali content
      await prisma.listingContent.create({
        data: {
          listingId: listing.id,
          locale: 'ne',
          title: listing._titleNe || listing.title,
          description: listing._descNe || listing.description || '',
          rules: faker.helpers.arrayElements([
            'भवन भित्र धुम्रपान निषेध',
            'पूर्व अनुमति बिना पार्टी निषेध',
            'राति १० बजेदेखि बिहान ७ बजेसम्म शान्त',
            'घर भित्र जुत्ता खोल्नुहोस्',
            'छिमेकीहरूलाई सम्मान गर्नुहोस्',
            'पानी बर्बाद नगर्नुहोस्',
            'चेकआउटमा चाबी फिर्ता गर्नुहोस्',
          ], { min: 2, max: 4 }).join('\n'),
          highlights: JSON.stringify(
            faker.helpers.arrayElements(
              ['वाइफाइ', 'तातो पानी', 'पार्किङ', 'हिमालको दृश्य', 'बालकनी', '२४ घण्टा पानी', 'इन्भर्टर'],
              { min: 2, max: 5 },
            ),
          ),
        },
      });
      contentCount += 2;
    } catch {
      // Skip duplicates
    }
  }
  console.log(`✓ Created ${contentCount} listing content entries (${contentCount / 2} listings × 2 locales)\n`);

  // ── Availability ───────────────────────────────────────────────────────────

  console.log('📅 Creating availability records...');
  const availabilityRecords = await Promise.all(
    listings.slice(0, 200).map((listing) =>
      prisma.availability.create({
        data: {
          propertyId: listing.id,
          startDate: faker.date.future({ years: 0.5 }),
          endDate: faker.date.future({ years: 1 }),
          status: faker.helpers.arrayElement(['AVAILABLE', 'BOOKED', 'BLOCKED']),
          price: new Prisma.Decimal(faker.number.float({ min: 1000, max: 30000, fractionDigits: 0 })),
          notes: faker.lorem.sentence(),
        },
      }),
    ),
  );
  console.log(`✓ Created ${availabilityRecords.length} availability records\n`);

  // ── Bookings (NPR, 12-month time series) ───────────────────────────────────

  console.log('📅 Skipping bookings due to schema mismatch...');
  const bookings: any[] = [];
  // const renters = users.filter((u) => u.role === 'USER' || u.role === 'CUSTOMER');

  // for (let i = 0; i < 300; i++) {
  //   const listing = listings[Math.floor(Math.random() * listings.length)];
  //   const renter = renters[Math.floor(Math.random() * renters.length)];
  //   if (listing.ownerId === renter.id) continue;

  //   const monthIndex = Math.floor((i / 300) * 12);
  //   const startDate = getBookingDateForMonth(11 - monthIndex);
  //   const nights = getRealisticBookingDuration();
  //   const endDate = new Date(startDate.getTime() + nights * 24 * 60 * 60 * 1000);
  //   const seasonal = getSeasonalMultiplier(startDate);
  //   const base = Number(listing.basePrice) * seasonal;
  //   const total = base * nights + Number(listing.cleaningFee || 0);
  //   const now = new Date();
  //   const isPast = endDate < now;
  //   const isCurrent = Math.abs(now.getTime() - startDate.getTime()) < 7 * 24 * 60 * 60 * 1000;
  //   const status = getWeightedBookingStatus(isPast, isCurrent);

  //   try {
  //     const booking = await prisma.booking.create({
  //       data: {
  //         listingId: listing.id, ownerId: listing.ownerId, renterId: renter.id,
  //         startDate, endDate,
  //         basePrice: new Prisma.Decimal(base),
  //         securityDeposit: listing.securityDeposit,
  //         cleaningFee: listing.cleaningFee,
  //         serviceFee: new Prisma.Decimal(total * 0.1),
  //         totalPrice: new Prisma.Decimal(total),
  //         currency: 'NPR',
  //         status: status as any,
  //         guestCount: faker.number.int({ min: 1, max: 6 }),
  //         specialRequests: faker.lorem.sentence(),
  //         guestNotes: faker.lorem.sentence(),
  //         ownerNotes: faker.lorem.sentence(),
  //         checkInTime: '14:00', checkOutTime: '11:00',
  //         ownerEarnings: new Prisma.Decimal(total * 0.9),
  //         platformFee: new Prisma.Decimal(total * 0.1),
  //         createdAt: startDate,
  //       },
  //     });
  //     bookings.push(booking);
  //   } catch (error) {
  //     console.error(`Error creating booking ${i}:`, error);
  //     /* skip */
  //   }
  // }
  console.log(`✓ Created ${bookings.length} bookings\n`);

  // ── Booking State History ──────────────────────────────────────────────────

  console.log('📝 Creating booking state history...');
  const stateHistory = await Promise.all(
    bookings.slice(0, 150).map((b) =>
      prisma.bookingStateHistory.create({
        data: { bookingId: b.id, fromStatus: 'PENDING', toStatus: b.status as any, reason: faker.lorem.sentence(), changedBy: users[0].id },
      }),
    ),
  );
  console.log(`✓ Created ${stateHistory.length} booking state history records\n`);

  // ── Payments (NPR) ────────────────────────────────────────────────────────

  console.log('💳 Creating payments...');
  const payments = await Promise.all(
    bookings.slice(0, 250).map((b) => {
      const payStatus = getPaymentStatusFromBooking(b.status);
      return prisma.payment.create({
        data: {
          bookingId: b.id, amount: b.totalPrice, currency: 'NPR',
          status: payStatus as any,
          paymentMethod: faker.helpers.arrayElement(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL']),
          paymentIntentId: `pi_${faker.string.alphanumeric(24)}`,
          stripePaymentIntentId: `pi_${faker.string.alphanumeric(24)}`,
          chargeId: `ch_${faker.string.alphanumeric(24)}`,
          stripeChargeId: `ch_${faker.string.alphanumeric(24)}`,
          fee: new Prisma.Decimal(Number(b.totalPrice) * 0.03),
          netAmount: new Prisma.Decimal(Number(b.totalPrice) * 0.97),
          processedAt: payStatus === 'COMPLETED' ? b.createdAt : faker.date.recent({ days: 30 }),
          description: `Payment for booking ${b.id}`,
          createdAt: b.createdAt,
        },
      });
    }),
  );
  console.log(`✓ Created ${payments.length} payments\n`);

  // ── Refunds ────────────────────────────────────────────────────────────────

  console.log('💰 Creating refunds...');
  const refunds = await Promise.all(
    bookings.filter((b) => b.status === 'CANCELLED').slice(0, 50).map((b) =>
      prisma.refund.create({
        data: {
          bookingId: b.id, amount: new Prisma.Decimal(Number(b.totalPrice) * 0.8),
          currency: 'NPR', status: faker.helpers.arrayElement(['PENDING', 'COMPLETED', 'FAILED']),
          refundId: `re_${faker.string.alphanumeric(24)}`,
          reason: faker.helpers.arrayElement(['Guest request', 'Host cancellation', 'Dashain plans changed']),
          description: faker.lorem.sentence(),
        },
      }),
    ),
  );
  console.log(`✓ Created ${refunds.length} refunds\n`);

  // ── Deposit Holds ──────────────────────────────────────────────────────────

  console.log('🔒 Creating deposit holds...');
  const depositHolds = await Promise.all(
    bookings.slice(0, 100).map((b) =>
      prisma.depositHold.create({
        data: {
          bookingId: b.id, amount: b.securityDeposit || new Prisma.Decimal(0),
          currency: 'NPR',
          status: faker.helpers.arrayElement(['PENDING', 'AUTHORIZED', 'HELD', 'RELEASED', 'CAPTURED', 'FAILED']),
          stripeId: `ch_${faker.string.alphanumeric(24)}`,
          paymentIntentId: `pi_${faker.string.alphanumeric(24)}`,
          expiresAt: faker.date.future({ days: 30 }),
          releasedAt: faker.datatype.boolean({ probability: 0.5 }) ? faker.date.recent({ days: 30 }) : undefined,
          capturedAt: faker.datatype.boolean({ probability: 0.3 }) ? faker.date.recent({ days: 30 }) : undefined,
        },
      }),
    ),
  );
  console.log(`✓ Created ${depositHolds.length} deposit holds\n`);

  // ── Payouts (NPR) ─────────────────────────────────────────────────────────

  console.log('💸 Creating payouts...');
  const payouts = await Promise.all(
    hostUsers.slice(0, 30).map((user) =>
      prisma.payout.create({
        data: {
          ownerId: user.id,
          amount: new Prisma.Decimal(faker.number.float({ min: 10000, max: 500000, fractionDigits: 0 })),
          currency: 'NPR',
          status: faker.helpers.arrayElement(['PENDING', 'PROCESSING', 'IN_TRANSIT', 'COMPLETED', 'PAID', 'FAILED', 'CANCELLED']),
          stripeId: `tr_${faker.string.alphanumeric(24)}`,
          transferId: `tr_${faker.string.alphanumeric(24)}`,
          paidAt: faker.datatype.boolean({ probability: 0.7 }) ? faker.date.recent({ days: 30 }) : undefined,
          processedAt: faker.date.recent({ days: 30 }),
        },
      }),
    ),
  );
  console.log(`✓ Created ${payouts.length} payouts\n`);

  // ── Ledger Entries (NPR) ───────────────────────────────────────────────────

  console.log('📊 Creating ledger entries (ALL AccountType, TransactionType, LedgerEntryStatus)...');
  const allAccountTypes = ['REVENUE', 'EXPENSE', 'LIABILITY', 'ASSET', 'EQUITY', 'CASH', 'RECEIVABLE', 'PAYABLE'] as const;
  const allTransactionTypes = ['PLATFORM_FEE', 'SERVICE_FEE', 'PAYMENT', 'REFUND', 'PAYOUT', 'DEPOSIT_HOLD', 'OWNER_EARNING', 'DEPOSIT_RELEASE', 'DISPUTE'] as const;
  const allLedgerStatuses = ['PENDING', 'POSTED', 'SETTLED', 'CANCELLED'] as const;
  const ledgerEntries = await Promise.all(
    payments.map((p, idx) => {
      const b = bookings.find((bk: any) => bk.id === p.bookingId);
      if (!b) return null;
      const acctType = allAccountTypes[idx % allAccountTypes.length];
      const txnType = allTransactionTypes[idx % allTransactionTypes.length];
      const ledgerStatus = allLedgerStatuses[idx % allLedgerStatuses.length];
      return [
        prisma.ledgerEntry.create({
          data: { bookingId: b.id, accountId: b.ownerId, accountType: acctType, side: 'CREDIT', transactionType: txnType, amount: new Prisma.Decimal(Number(b.totalPrice) * 0.9), currency: 'NPR', description: `${txnType} — बुकिङ ${b.id}`, status: ledgerStatus, createdAt: b.createdAt },
        }),
        prisma.ledgerEntry.create({
          data: { bookingId: b.id, accountId: 'platform', accountType: 'REVENUE', side: 'DEBIT', transactionType: 'PLATFORM_FEE', amount: new Prisma.Decimal(Number(b.totalPrice) * 0.1), currency: 'NPR', description: `प्लेटफर्म शुल्क — बुकिङ ${b.id}`, status: ledgerStatus, createdAt: b.createdAt },
        }),
      ];
    }).flat(),
  );
  console.log(`✓ Created ${ledgerEntries.filter(Boolean).length} ledger entries\n`);

  // ── Reviews ────────────────────────────────────────────────────────────────

  console.log('⭐ Creating reviews...');
  const reviews = await Promise.all(
    bookings.filter((b) => b.status === 'COMPLETED').slice(0, 150).map((b) => {
      const listing = listings.find((l: any) => l.id === b.listingId);
      if (!listing) return null;
      return prisma.review.create({
        data: {
          bookingId: b.id, listingId: listing.id, reviewerId: b.renterId, revieweeId: listing.ownerId,
          type: faker.helpers.arrayElement(['LISTING_REVIEW', 'RENTER_REVIEW', 'OWNER_REVIEW']),
          rating: faker.number.int({ min: 1, max: 5 }),
          overallRating: faker.number.int({ min: 1, max: 5 }),
          accuracyRating: faker.number.int({ min: 1, max: 5 }),
          communicationRating: faker.number.int({ min: 1, max: 5 }),
          cleanlinessRating: faker.number.int({ min: 1, max: 5 }),
          valueRating: faker.number.int({ min: 1, max: 5 }),
          locationRating: faker.number.int({ min: 1, max: 5 }),
          checkInRating: faker.number.int({ min: 1, max: 5 }),
          comment: faker.helpers.arrayElement([
            'Great experience! The place was exactly as described.',
            'Very clean and well-maintained. Host was responsive.',
            'Loved the mountain view. Will definitely come back!',
            'Good value for money. Location was convenient.',
            'Excellent WiFi and hot water. Perfect for remote work.',
            'The neighborhood was quiet and safe. Highly recommended.',
            'राम्रो अनुभव! सबै कुरा विवरण अनुसार थियो।',
            'धेरै सफा र राम्रोसँग मर्मत गरिएको। होस्ट प्रतिक्रियाशील थिए।',
            'हिमालको दृश्य मन पर्यो। फेरि आउने छु!',
            'पैसाको तुलनामा राम्रो मूल्य। स्थान सुविधाजनक थियो।',
            'वाइफाइ र तातो पानी उत्तम। रिमोट कामको लागि उपयुक्त।',
            'छिमेकी शान्त र सुरक्षित थियो। सबैलाई सिफारिस गर्छु।',
          ]),
          response: faker.lorem.sentence(),
          status: faker.helpers.weightedArrayElement([
            { weight: 75, value: 'PUBLISHED' }, { weight: 10, value: 'DRAFT' },
            { weight: 10, value: 'HIDDEN' }, { weight: 5, value: 'FLAGGED' },
          ]),
        },
      });
    }).filter(Boolean),
  );
  console.log(`✓ Created ${reviews.length} reviews\n`);

  // ── Favorites, Notifications, Condition Reports ────────────────────────────

  console.log('❤️  Creating favorites...');
  const favorites = await Promise.all(
    users.slice(0, 50).flatMap((u) =>
      listings.slice(0, 10).map((l) =>
        prisma.favoriteListing.create({ data: { userId: u.id, listingId: l.id } }).catch(() => null),
      ),
    ),
  );
  console.log(`✓ Created ${favorites.filter(Boolean).length} favorites`);

  console.log('🔔 Creating notifications (ALL 14 NotificationType values)...');
  const notificationTemplates: { type: string; titleEn: string; titleNe: string; msgEn: string; msgNe: string; url: string }[] = [
    { type: 'BOOKING_REQUEST', titleEn: 'New Booking Request', titleNe: 'नयाँ बुकिङ अनुरोध', msgEn: 'You have a new booking request for your property.', msgNe: 'तपाईंको सम्पत्तिको लागि नयाँ बुकिङ अनुरोध आएको छ।', url: '/bookings' },
    { type: 'BOOKING_CONFIRMED', titleEn: 'Booking Confirmed', titleNe: 'बुकिङ पुष्टि भयो', msgEn: 'Your booking has been confirmed!', msgNe: 'तपाईंको बुकिङ पुष्टि भएको छ!', url: '/bookings' },
    { type: 'BOOKING_CANCELLED', titleEn: 'Booking Cancelled', titleNe: 'बुकिङ रद्द भयो', msgEn: 'A booking has been cancelled.', msgNe: 'एउटा बुकिङ रद्द भएको छ।', url: '/bookings' },
    { type: 'BOOKING_REMINDER', titleEn: 'Upcoming Check-in', titleNe: 'आगामी चेक इन', msgEn: 'Your check-in is coming up soon.', msgNe: 'तपाईंको चेक इन छिट्टै आउँदैछ।', url: '/bookings' },
    { type: 'PAYMENT_RECEIVED', titleEn: 'Payment Received', titleNe: 'भुक्तानी प्राप्त भयो', msgEn: 'Payment has been received for your booking.', msgNe: 'तपाईंको बुकिङको लागि भुक्तानी प्राप्त भयो।', url: '/payments' },
    { type: 'REVIEW_RECEIVED', titleEn: 'New Review', titleNe: 'नयाँ समीक्षा', msgEn: 'You received a new review from a guest.', msgNe: 'तपाईंले अतिथिबाट नयाँ समीक्षा पाउनुभयो।', url: '/reviews' },
    { type: 'MESSAGE_RECEIVED', titleEn: 'New Message', titleNe: 'नयाँ सन्देश', msgEn: 'You have a new message.', msgNe: 'तपाईंलाई नयाँ सन्देश छ।', url: '/messages' },
    { type: 'SYSTEM_UPDATE', titleEn: 'System Update', titleNe: 'प्रणाली अपडेट', msgEn: 'GharBatai has been updated with new features.', msgNe: 'GharBatai मा नयाँ सुविधाहरू थपिएका छन्।', url: '/' },
    { type: 'SYSTEM_ANNOUNCEMENT', titleEn: 'Announcement', titleNe: 'घोषणा', msgEn: 'Important announcement from GharBatai.', msgNe: 'GharBatai बाट महत्त्वपूर्ण घोषणा।', url: '/' },
    { type: 'MARKETING', titleEn: 'Special Offer', titleNe: 'विशेष प्रस्ताव', msgEn: 'Check out our latest deals this Dashain!', msgNe: 'यो दशैंमा हाम्रो विशेष प्रस्ताव हेर्नुहोस्!', url: '/deals' },
    { type: 'PAYOUT_PROCESSED', titleEn: 'Payout Processed', titleNe: 'भुक्तानी प्रक्रिया भयो', msgEn: 'Your payout has been processed.', msgNe: 'तपाईंको भुक्तानी प्रक्रिया भएको छ।', url: '/payouts' },
    { type: 'VERIFICATION_COMPLETE', titleEn: 'Verification Complete', titleNe: 'प्रमाणीकरण पूरा भयो', msgEn: 'Your identity verification is complete.', msgNe: 'तपाईंको परिचय प्रमाणीकरण पूरा भएको छ।', url: '/profile' },
    { type: 'DISPUTE_OPENED', titleEn: 'Dispute Opened', titleNe: 'विवाद खोलियो', msgEn: 'A dispute has been opened regarding your booking.', msgNe: 'तपाईंको बुकिङको बारेमा विवाद खोलिएको छ।', url: '/disputes' },
    { type: 'LISTING_APPROVED', titleEn: 'Listing Approved', titleNe: 'लिस्टिङ स्वीकृत भयो', msgEn: 'Your listing has been approved and is now live!', msgNe: 'तपाईंको लिस्टिङ स्वीकृत भयो र अहिले लाइभ छ!', url: '/listings' },
  ];
  const notifications = await Promise.all(
    users.slice(0, 80).map((u, i) => {
      const tmpl = notificationTemplates[i % notificationTemplates.length];
      const isNepali = faker.datatype.boolean({ probability: 0.4 });
      return prisma.notification.create({
        data: {
          userId: u.id,
          type: tmpl.type as any,
          title: isNepali ? tmpl.titleNe : tmpl.titleEn,
          message: isNepali ? tmpl.msgNe : tmpl.msgEn,
          actionUrl: tmpl.url, read: faker.datatype.boolean({ probability: 0.6 }),
          readAt: faker.datatype.boolean({ probability: 0.6 }) ? faker.date.recent({ days: 30 }) : undefined,
          sentViaEmail: faker.datatype.boolean({ probability: 0.8 }),
          sentViaPush: faker.datatype.boolean({ probability: 0.5 }),
          sentViaSMS: faker.datatype.boolean({ probability: 0.2 }),
        },
      });
    }),
  );
  console.log(`✓ Created ${notifications.length} notifications (ALL 14 types, en + ne)`);

  console.log('📸 Creating condition reports...');
  const conditionReports = await Promise.all(
    bookings.slice(0, 80).map((b) => {
      const listing = listings.find((l: any) => l.id === b.listingId);
      if (!listing) return null;
      return prisma.conditionReport.create({
        data: {
          bookingId: b.id, propertyId: listing.id, createdBy: b.renterId,
          checkIn: faker.datatype.boolean({ probability: 0.8 }),
          checkOut: faker.datatype.boolean({ probability: 0.6 }),
          photos: Array.from({ length: faker.number.int({ min: 2, max: 6 }) }, () =>
            `https://picsum.photos/seed/${faker.string.alphanumeric(12)}/800/600.jpg`,
          ),
          notes: faker.helpers.arrayElement([
            'सबै राम्रो अवस्थामा छ। केही क्षति भेटिएन।',
            'भान्साको नानो खुट्टा भेटियो — फोटो संलग्न छ।',
            'All items in excellent condition. No issues found.',
            'Minor scuff mark on kitchen counter — documented with photos.',
            'बाथरुमको ट्याप बिस्तारै लिक छ — फोटो राखिएको छ।',
            'Property returned in same condition as check-in.',
          ]),
          status: faker.helpers.arrayElement(['DRAFT', 'SUBMITTED', 'APPROVED', 'DISPUTED']),
          reportType: faker.helpers.arrayElement(['CHECK_IN', 'CHECK_OUT']),
        },
      });
    }),
  );
  console.log(`✓ Created ${conditionReports.filter(Boolean).length} condition reports\n`);

  // ── Insurance ──────────────────────────────────────────────────────────────

  console.log('🛡️  Creating insurance policies and claims...');
  const insurancePolicies = await Promise.all(
    bookings.slice(0, 100).map((b) => {
      const listing = listings.find((l: any) => l.id === b.listingId);
      if (!listing) return null;
      return prisma.insurancePolicy.create({
        data: {
          policyNumber: `POL-${faker.string.alphanumeric(10)}`, bookingId: b.id,
          propertyId: listing.id, userId: b.renterId,
          type: faker.helpers.arrayElement(['PROPERTY_DAMAGE', 'LIABILITY', 'TRIP_CANCELLATION', 'MEDICAL']),
          provider: faker.helpers.arrayElement([
            'Nepal Insurance Company (नेपाल बीमा कम्पनी)',
            'SBI General Nepal (एसबिआई जेनरल नेपाल)',
            'Prabhu Insurance (प्रभु बीमा)',
            'Shikhar Insurance (शिखर बीमा)',
            'GharBatai Platform Insurance',
          ]),
          coverage: new Prisma.Decimal(Number(b.totalPrice) * 2),
          coverageAmount: new Prisma.Decimal(Number(b.totalPrice) * 2),
          premium: new Prisma.Decimal(Number(b.totalPrice) * 0.05),
          currency: 'NPR',
          status: faker.helpers.arrayElement(['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING']),
          startDate: b.startDate, endDate: b.endDate,
          documents: [`https://example.com/doc/${faker.string.alphanumeric(12)}.pdf`],
        },
      });
    }),
  );
  console.log(`✓ Created ${insurancePolicies.filter(Boolean).length} insurance policies`);

  const insuranceClaims = await Promise.all(
    insurancePolicies.filter(Boolean).slice(0, 30).map((p) =>
      prisma.insuranceClaim.create({
        data: {
          policyId: p!.id, bookingId: p!.bookingId, propertyId: p!.propertyId,
          claimNumber: `CLM-${faker.string.alphanumeric(10)}`,
          claimAmount: new Prisma.Decimal(faker.number.float({ min: 5000, max: 100000, fractionDigits: 0 })),
          description: faker.lorem.paragraph(), incidentDate: faker.date.recent({ days: 30 }),
          status: faker.helpers.arrayElement(['PENDING', 'APPROVED', 'REJECTED', 'PROCESSING', 'PAID', 'CANCELLED']),
          approvedAmount: new Prisma.Decimal(faker.number.float({ min: 2000, max: 80000, fractionDigits: 0 })),
          documents: [`https://example.com/doc/${faker.string.alphanumeric(12)}.pdf`],
          notes: faker.lorem.sentence(),
        },
      }),
    ),
  );
  console.log(`✓ Created ${insuranceClaims.length} insurance claims\n`);

  // ── Conversations & Messages ───────────────────────────────────────────────

  console.log('💬 Creating conversations and messages...');
  const conversations = await Promise.all(
    bookings.slice(0, 100).map((b) => {
      const listing = listings.find((l: any) => l.id === b.listingId);
      if (!listing) return null;
      return prisma.conversation.create({
        data: {
          bookingId: b.id, listingId: listing.id,
          type: faker.helpers.arrayElement(['GENERAL', 'BOOKING', 'DISPUTE', 'SUPPORT']),
          status: faker.helpers.arrayElement(['ACTIVE', 'ARCHIVED', 'CLOSED']),
          lastMessageAt: faker.date.recent({ days: 30 }),
        },
      });
    }),
  );

  await Promise.all(
    conversations.filter(Boolean).flatMap((conv) => {
      const b = bookings.find((bk: any) => bk.id === conv!.bookingId);
      if (!b) return [];
      return [
        prisma.conversationParticipant.create({ data: { conversationId: conv!.id, userId: b.renterId, lastReadAt: faker.date.recent({ days: 30 }) } }),
        prisma.conversationParticipant.create({ data: { conversationId: conv!.id, userId: b.ownerId, lastReadAt: faker.date.recent({ days: 30 }) } }),
      ];
    }),
  );

  const messages = await Promise.all(
    conversations.filter(Boolean).slice(0, 80).flatMap((conv) =>
      Array.from({ length: faker.number.int({ min: 2, max: 8 }) }, async () => {
        const b = bookings.find((bk: any) => bk.id === conv!.bookingId);
        if (!b) return null;
        const sender = faker.datatype.boolean() ? b.renterId : b.ownerId;
        return prisma.message.create({
          data: {
            conversationId: conv!.id, senderId: sender,
            content: faker.helpers.arrayElement([
              'Namaste! Is the property still available?',
              'नमस्ते! के सम्पत्ति अझै उपलब्ध छ?',
              'Thank you! What time can I check in?',
              'धन्यवाद! म कति बजे चेक इन गर्न सक्छु?',
              'Can I bring my pet? The listing says pet friendly.',
              'के म पाल्टु जनावर ल्याउन सक्छु? लिस्टिङमा पाल्टु मैत्री भन्छ।',
              'Is hot water available 24 hours?',
              'के चिसो पानी सधैं तातो पानी उपलब्ध छ?',
              'How far is it from Tribhuvan Airport?',
              'त्रिभुवन विमानस्थलबाट कति टाढा छ?',
              faker.lorem.sentences(2),
            ]),
            type: 'TEXT', attachments: [],
            readAt: faker.datatype.boolean({ probability: 0.7 }) ? faker.date.recent({ days: 30 }) : undefined,
          },
        });
      }),
    ).filter(Boolean),
  );

  // MessageReadReceipts for delivered messages
  console.log('📭 Creating message read receipts...');
  const validMessages = messages.filter(Boolean) as any[];
  const msgReadReceipts = await Promise.all(
    validMessages.slice(0, 100).map((msg) => {
      const b = bookings.find((bk: any) => conversations.find((c: any) => c?.id === msg.conversationId)?.bookingId === bk.id);
      if (!b) return null;
      const reader = msg.senderId === b.renterId ? b.ownerId : b.renterId;
      return prisma.messageReadReceipt.create({
        data: { messageId: msg.id, userId: reader, readAt: faker.date.recent({ days: 14 }) },
      }).catch(() => null);
    }),
  );
  console.log(`✓ Created ${msgReadReceipts.filter(Boolean).length} message read receipts`);

  console.log(`✓ Created ${conversations.filter(Boolean).length} conversations, ${validMessages.length} messages\n`);

  // ── Disputes ───────────────────────────────────────────────────────────────

  console.log('⚖️  Creating disputes...');
  const disputes = await Promise.all(
    bookings.filter((b) => b.status === 'COMPLETED').slice(0, 40).map((b) =>
      prisma.dispute.create({
        data: {
          bookingId: b.id,
          initiatorId: faker.datatype.boolean() ? b.renterId : b.ownerId,
          defendantId: faker.datatype.boolean() ? b.ownerId : b.renterId,
          assignedTo: users[0].id,
          title: faker.lorem.words(4),
          type: faker.helpers.arrayElement(['PROPERTY_DAMAGE', 'PAYMENT_ISSUE', 'CANCELLATION', 'CLEANING_FEE', 'RULES_VIOLATION', 'MISSING_ITEMS', 'CONDITION_MISMATCH', 'REFUND_REQUEST', 'OTHER']),
          status: faker.helpers.arrayElement(['OPEN', 'UNDER_REVIEW', 'INVESTIGATING', 'RESOLVED', 'CLOSED', 'DISMISSED', 'WITHDRAWN']),
          priority: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
          description: faker.lorem.paragraph(),
          amount: new Prisma.Decimal(faker.number.float({ min: 5000, max: 100000, fractionDigits: 0 })),
          resolvedAt: faker.datatype.boolean({ probability: 0.6 }) ? faker.date.recent({ days: 30 }) : undefined,
        },
      }),
    ),
  );

  await Promise.all(disputes.slice(0, 30).flatMap((d) =>
    Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () =>
      prisma.disputeEvidence.create({ data: { disputeId: d.id, type: faker.helpers.arrayElement(['photo', 'document', 'message', 'receipt']), url: `https://example.com/evidence/${faker.string.alphanumeric(12)}`, caption: faker.lorem.sentence(), uploadedBy: d.initiatorId } }),
    ),
  ));

  await Promise.all(disputes.filter((d) => d.status === 'RESOLVED').slice(0, 20).map((d, i) => {
    const allResolutionTypes = ['FULL_REFUND', 'PARTIAL_REFUND', 'CHARGE_BACK', 'COMPENSATION', 'DISMISSED'] as const;
    return prisma.disputeResolution.create({ data: { disputeId: d.id, type: allResolutionTypes[i % allResolutionTypes.length], outcome: faker.lorem.sentence(), amount: new Prisma.Decimal(faker.number.float({ min: 0, max: 50000, fractionDigits: 0 })), details: faker.lorem.paragraph(), resolvedBy: users[0].id } });
  }));

  // DisputeResponse and DisputeTimelineEvent for each dispute
  await Promise.all(disputes.map((d) => [
    prisma.disputeResponse.create({ data: { disputeId: d.id, userId: d.initiatorId, content: faker.helpers.arrayElement(['मलाई यो समाधान स्वीकार्य छैन।', 'I disagree with this assessment.', 'कृपया प्रमाण हेर्नुहोस्।']), type: faker.helpers.arrayElement(['statement', 'evidence', 'counter_claim']), attachments: [] } }).catch(() => null),
    prisma.disputeTimelineEvent.create({ data: { disputeId: d.id, event: faker.helpers.arrayElement(['created', 'evidence_submitted', 'escalated', 'response_received', 'resolved']), details: faker.helpers.arrayElement(['विवाद दर्ता भयो', 'प्रमाण पेश गरियो', 'Dispute escalated to senior admin', 'Response received from defendant']) } }).catch(() => null),
  ]).flat());

  console.log(`✓ Created ${disputes.length} disputes with evidence and resolutions\n`);

  // ── Audit Logs ─────────────────────────────────────────────────────────────

  console.log('📝 Creating audit logs...');
  const auditLogs = await Promise.all(
    users.slice(0, 50).map((u) =>
      prisma.auditLog.create({
        data: {
          userId: u.id, action: faker.helpers.arrayElement(['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT']),
          entityType: faker.helpers.arrayElement(['Listing', 'Booking', 'User', 'Payment']),
          entityId: listings[0].id,
          oldValues: JSON.stringify({ status: 'PENDING' }),
          newValues: JSON.stringify({ status: 'ACTIVE' }),
          ipAddress: faker.internet.ipv4(), userAgent: faker.internet.userAgent(),
        },
      }),
    ),
  );
  console.log(`✓ Created ${auditLogs.length} audit logs\n`);

  // ── E2E Test User Enrichment ───────────────────────────────────────────────

  console.log('🧪 Enriching E2E test user data...');

  const testOwnerListings = await Promise.all(
    categories.slice(0, 5).flatMap((cat, catIdx) =>
      Array.from({ length: 2 }, async (_, i) => {
        const loc = catIdx < 3 ? NEPAL_LOCATIONS[5] : NEPAL_LOCATIONS[0]; // Pokhara or Kathmandu
        const area = randomTole();
        const titles = getListingTitle(cat.slug, area, VEHICLE_TYPES[i] || area);
        const viewCount = faker.number.int({ min: 300, max: 1500 });
        return prisma.listing.create({
          data: {
            title: titles.en, slug: `test-owner-${cat.slug}-${catIdx * 2 + i}`,
            description: getListingDescription(cat.slug).en,
            address: `Ward ${faker.number.int({ min: 1, max: 35 })}, ${area}`,
            city: loc.city, state: loc.state, zipCode: loc.zip, country: 'Nepal',
            latitude: loc.lat, longitude: loc.lng,
            ownerId: testOwner.id, categoryId: cat.id,
            cancellationPolicyId: policies[i % policies.length].id,
            type: faker.helpers.arrayElement(['APARTMENT', 'HOUSE', 'VILLA', 'CONDO', 'TOWNHOUSE']),
            status: i === 0 ? 'AVAILABLE' : 'RENTED', verificationStatus: 'VERIFIED',
            bookingMode: i % 2 === 0 ? 'INSTANT_BOOK' : 'REQUEST',
            basePrice: new Prisma.Decimal(faker.number.float({ min: 3000, max: 20000, fractionDigits: 0 })),
            currency: 'NPR', securityDeposit: new Prisma.Decimal(10000), cleaningFee: new Prisma.Decimal(2000),
            amenities: ['WiFi', 'Kitchen', 'Parking', 'Hot Water', 'Mountain View'],
            photos: Array.from({ length: 6 }, () => `https://picsum.photos/seed/${faker.string.alphanumeric(12)}/800/600.jpg`),
            rules: ['No smoking', 'Shoes off inside', 'Quiet hours 10 PM – 7 AM'],
            bedrooms: faker.number.int({ min: 1, max: 4 }), bathrooms: 2, maxGuests: 4,
            averageRating: faker.number.float({ min: 4.2, max: 4.9, fractionDigits: 1 }),
            totalReviews: faker.number.int({ min: 10, max: 40 }),
            totalBookings: faker.number.int({ min: 15, max: 50 }),
            views: viewCount, viewCount,
            instantBookable: i % 2 === 0, minStayNights: 1, maxStayNights: 90,
            checkInTime: '14:00', checkOutTime: '11:00', featured: i === 0, isActive: true,
          },
        });
      }),
    ),
  );
  console.log(`  ✓ Created ${testOwnerListings.length} test owner listings`);

  // Add bilingual content for test owner listings
  for (const listing of testOwnerListings) {
    const area = randomTole();
    await prisma.listingContent.create({
      data: { listingId: listing.id, locale: 'en', title: listing.title, description: listing.description || '', rules: (listing.rules as string[]).join('\n') },
    }).catch(() => null);
    await prisma.listingContent.create({
      data: {
        listingId: listing.id, locale: 'ne',
        title: `${area}मा ${listing.title.includes('Apartment') ? 'अपार्टमेन्ट' : listing.title.includes('House') ? 'घर' : 'भाडा'}`,
        description: getListingDescription('apartment').ne,
        rules: 'धुम्रपान निषेध\nजुत्ता खोल्नुहोस्\nशान्त समय राति १०–बिहान ७',
      },
    }).catch(() => null);
  }

  const testRenterBookings = []; // Temporarily disabled due to schema mismatch
  // const testRenterBookings = await Promise.all(
  //   testOwnerListings.slice(0, 10).map(async (listing, i) => {
  //     const startDate = getBookingDateForMonth(10 - i);
  //     const nights = getRealisticBookingDuration();
  //     const endDate = new Date(startDate.getTime() + nights * 24 * 60 * 60 * 1000);
  //     const statuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'];
  //     const base = Number(listing.basePrice);
  //     const total = base * nights + Number(listing.cleaningFee || 0);
      
  //     try {
  //       return await prisma.booking.create({
  //         data: {
  //           listingId: listing.id, 
  //           ownerId: listing.ownerId, 
  //           renterId: testRenter.id,
  //           startDate, 
  //           endDate, 
  //           basePrice: listing.basePrice,
  //           securityDeposit: listing.securityDeposit, 
  //           cleaningFee: listing.cleaningFee,
  //           serviceFee: new Prisma.Decimal(total * 0.1),
  //           totalPrice: new Prisma.Decimal(total),
  //           currency: 'NPR', 
  //           status: statuses[i % statuses.length] as any,
  //           guestCount: faker.number.int({ min: 1, max: 4 }),
  //           specialRequests: 'Test booking for E2E tests',
  //           checkInTime: '14:00', 
  //           checkOutTime: '11:00',
  //           ownerEarnings: new Prisma.Decimal(total * 0.9),
  //           platformFee: new Prisma.Decimal(total * 0.1), 
  //           createdAt: startDate,
  //         },
  //       });
  //     } catch (error) {
  //       console.error(`Error creating booking ${i}:`, error);
  //       return null;
  //     }
  //   }),
  // );
  console.log(`  ✓ Created ${testRenterBookings.length} test renter bookings`);

  const testRenterReviews = await Promise.all(
    testRenterBookings.filter((b): b is NonNullable<typeof b> => b !== null && b.status === 'COMPLETED').map((b) =>
      prisma.review.create({
        data: {
          bookingId: b.id, listingId: b.listingId, reviewerId: testRenter.id, revieweeId: testOwner.id,
          type: 'LISTING_REVIEW', rating: faker.number.int({ min: 4, max: 5 }),
          overallRating: faker.number.int({ min: 4, max: 5 }),
          accuracyRating: 5, communicationRating: 5,
          cleanlinessRating: 5, locationRating: 5, valueRating: 5,
          comment: faker.lorem.sentences(2),
        },
      }).catch(() => null),
    ),
  );
  console.log(`  ✓ Created ${testRenterReviews.length} test renter reviews`);

  console.log('✓ E2E test user data enrichment complete!\n');

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log('\n🇳🇵 GharBatai Nepal database seeding completed!\n');
  console.log('═'.repeat(60));
  console.log('📊 SEEDING SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  🌍 Country: Nepal | Currency: NPR | Locales: en, ne`);
  console.log(`  👥 Users: ${users.length} (Nepali names)`);
  console.log(`  ⚙️  User Preferences: ${userPreferences.length} (en/ne, NPR)`);
  console.log(`  🔐 Sessions: ${sessions.length}`);
  console.log(`  📱 Device Tokens: ${deviceTokens.length}`);
  console.log(`  📂 Categories: ${categories.length}`);
  console.log(`  📋 Cancellation Policies: ${policies.length}`);
  console.log(`  🪪 Identity Documents: ${identityDocs.filter(Boolean).length} (ALL 4 doc types)`);
  console.log(`  📧 Email Templates: ${emailTemplates.length} (ALL 14 types)`);
  console.log(`  🏢 Organizations: ${organizations.length}`);
  console.log(`  🏠 Listings: ${listings.length} (Nepal locations, NPR)`);
  console.log(`  🌐 Listing Contents: ${contentCount} (en + ne bilingual)`);
  console.log(`  📅 Availability: ${availabilityRecords.length}`);
  console.log(`  📆 Bookings: ${bookings.length} (NPR, 12-month spread)`);
  console.log(`  📝 Booking State History: ${stateHistory.length}`);
  console.log(`  💳 Payments: ${payments.length} (NPR)`);
  console.log(`  💰 Refunds: ${refunds.length}`);
  console.log(`  🔒 Deposit Holds: ${depositHolds.length}`);
  console.log(`  💸 Payouts: ${payouts.length} (NPR)`);
  console.log(`  📊 Ledger Entries: ${ledgerEntries.filter(Boolean).length}`);
  console.log(`  ⭐ Reviews: ${reviews.length} (en + ne comments)`);
  console.log(`  ❤️  Favorites: ${favorites.filter(Boolean).length}`);
  console.log(`  🔔 Notifications: ${notifications.length}`);
  console.log(`  📸 Condition Reports: ${conditionReports.filter(Boolean).length}`);
  console.log(`  🛡️  Insurance Policies: ${insurancePolicies.filter(Boolean).length}`);
  console.log(`  📋 Insurance Claims: ${insuranceClaims.length}`);
  console.log(`  💬 Conversations: ${conversations.filter(Boolean).length}`);
  console.log(`  ✉️  Messages: ${validMessages.length} (en + ne)`);
  console.log(`  📭 Message Read Receipts: ${msgReadReceipts.filter(Boolean).length}`);
  console.log(`  ⚖️  Disputes: ${disputes.length}`);
  console.log(`  📝 Audit Logs: ${auditLogs.length}`);
  console.log('═'.repeat(60));

  // ── Seed PolicyRules ───────────────────────────────────────────────────────
  console.log('\n📜 Seeding PolicyRules (TAX, FEE, CANCELLATION, BOOKING_CONSTRAINT)...');
  await seedPolicyRules(prisma);

  // ── Seed Country Packs (TH, ID, DE) ────────────────────────────────────────
  console.log('\n🌏 Seeding Country Packs (Thailand, Indonesia, Germany)...');
  await seedCountryPacks(prisma);

  console.log('\n🔑 LOGIN CREDENTIALS:');
  console.log('  Test Renter: renter@test.com / Test123!@# (Sagar Shrestha)');
  console.log('  Test Owner: owner@test.com / Test123!@# (Anita Sharma)');
  console.log('  Test Admin: admin@test.com / Test123!@# (Rajesh Pandey)');
  console.log('  Admin: admin@gharbatai.com / password123');
  console.log('  Super Admin: superadmin@gharbatai.com / password123');
  console.log('  Ops Admin: ops@gharbatai.com / password123');
  console.log('  Finance Admin: finance@gharbatai.com / password123');
  console.log('  Support Admin: support@gharbatai.com / password123');
  console.log('  Customer: customer@gharbatai.com / password123');
  console.log('═'.repeat(60) + '\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
