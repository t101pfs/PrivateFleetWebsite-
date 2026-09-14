// Reference data for the public catering form. "Other" is always the last
// option so a diner can specify anything not listed here, per cuisine and
// as a whole top-level alternative to picking a cuisine at all.
export const OTHER_CUISINE = 'Other (specify)';
export const OTHER_COURSE = 'Other dish (specify)';

export const CUISINES: Record<string, string[]> = {
  'Saudi / Gulf': ['Kabsa', 'Mandi', 'Madfoon', 'Mutabbaq', 'Jareesh', 'Saleeg', OTHER_COURSE],
  'Lebanese': ['Mixed Grill', 'Kibbeh', 'Tabbouleh & Mezze', 'Shawarma Platter', 'Fattoush', OTHER_COURSE],
  'Turkish': ['Adana Kebab', 'Iskender Kebab', 'Manti', 'Meze Platter', 'Pide', OTHER_COURSE],
  'Indian': ['Butter Chicken', 'Biryani', 'Paneer Tikka', 'Rogan Josh', 'Tandoori Platter', OTHER_COURSE],
  'Pakistani': ['Chicken Karahi', 'Nihari', 'Seekh Kebab', 'Biryani', OTHER_COURSE],
  'Persian': ['Chelo Kabab', 'Ghormeh Sabzi', 'Zereshk Polo', 'Fesenjan', OTHER_COURSE],
  'Moroccan / North African': ['Lamb Tagine', 'Couscous Royale', 'Pastilla', 'Harira Soup', OTHER_COURSE],
  'Italian': ['Risotto', 'Fresh Pasta', 'Osso Buco', 'Margherita Pizza', 'Antipasti Platter', OTHER_COURSE],
  'French': ['Coq au Vin', 'Beef Bourguignon', 'Duck Confit', 'French Onion Soup', OTHER_COURSE],
  'Spanish / Mediterranean': ['Paella', 'Grilled Seafood', 'Iberico Ham Platter', 'Tapas Selection', OTHER_COURSE],
  'Greek': ['Moussaka', 'Souvlaki Platter', 'Greek Salad & Mezze', 'Grilled Sea Bass', OTHER_COURSE],
  'British': ['Beef Wellington', 'Roast Dinner', 'Fish & Chips', OTHER_COURSE],
  'American': ['Prime Steak', 'BBQ Platter', 'Burger & Fries', 'Grilled Salmon', OTHER_COURSE],
  'Mexican': ['Tacos al Pastor', 'Enchiladas', 'Fajitas Platter', 'Ceviche', OTHER_COURSE],
  'Japanese': ['Sushi & Sashimi Platter', 'Wagyu Teppanyaki', 'Tempura', 'Ramen', OTHER_COURSE],
  'Chinese': ['Peking Duck', 'Dim Sum Platter', 'Sweet & Sour', 'Kung Pao Chicken', OTHER_COURSE],
  'Thai': ['Green Curry', 'Pad Thai', 'Tom Yum Soup', 'Mango Sticky Rice', OTHER_COURSE],
  'Korean': ['Bulgogi', 'Korean BBQ Platter', 'Bibimbap', OTHER_COURSE],
  'Vietnamese': ['Pho', 'Banh Mi', 'Spring Rolls', OTHER_COURSE],
};

export const CUISINE_OPTIONS = [...Object.keys(CUISINES), OTHER_CUISINE];
