import breakfastImg from '@/assets/catering-menu/breakfast.jpg';
import soupImg from '@/assets/catering-menu/soup.jpg';
import appetizerImg from '@/assets/catering-menu/appetizer.jpg';
import saladImg from '@/assets/catering-menu/salad.jpg';
import chickenImg from '@/assets/catering-menu/chicken.jpg';
import beefImg from '@/assets/catering-menu/beef.jpg';
import lambImg from '@/assets/catering-menu/lamb.jpg';
import vealImg from '@/assets/catering-menu/veal.jpg';
import seafoodImg from '@/assets/catering-menu/seafood.jpg';
import pastaImg from '@/assets/catering-menu/pasta.jpg';
import riceImg from '@/assets/catering-menu/rice.jpg';
import potatoImg from '@/assets/catering-menu/potato.jpg';
import vegetableImg from '@/assets/catering-menu/vegetable.jpg';
import dessertImg from '@/assets/catering-menu/dessert.jpg';
import snackImg from '@/assets/catering-menu/snack.jpg';
import drinkImg from '@/assets/catering-menu/drink.jpg';

// The Private Fleet Services VIP catering menu - transcribed from the
// company's own menu booklet ("PFS CATERING VIP MENU"), one course per
// section, with that course's photo from the same booklet. Client-facing
// (the public catering form), bilingual EN/AR - the Arabic text is a
// translation done for this feature, not sourced from a separate Arabic
// booklet (none was provided), so it's a judgment call on dish naming
// rather than a verbatim transcription the way the English is.
//
// Each dish is stored once in English (the canonical value saved to
// catering_requests, so Ops/kitchen staff reading past orders always see
// one consistent name regardless of which language the client viewed) with
// an `ar` field purely for how it displays to an Arabic-reading client.
//
// Drinks isn't in the booklet (it only covers food) - that section's list
// is ours, standing in until there's a real drinks list to replace it with.
export type MenuSectionId =
  | 'breakfast' | 'soup' | 'appetizer' | 'salad' | 'chicken' | 'beef' | 'lamb'
  | 'veal' | 'seafood' | 'pasta' | 'rice' | 'potato' | 'vegetable' | 'dessert' | 'snack' | 'drink';

export interface MenuItem {
  en: string;
  ar: string;
}

export interface MenuSection {
  id: MenuSectionId;
  label: string;
  labelAr: string;
  image: string;
  items: MenuItem[];
}

export const MENU_SECTIONS: MenuSection[] = [
  {
    id: 'breakfast',
    label: 'Breakfast',
    labelAr: 'الإفطار',
    image: breakfastImg,
    items: [
      { en: 'Cheese Omelet (with tomato, green pepper & mushrooms)', ar: 'أومليت بالجبن (مع الطماطم والفلفل الأخضر والفطر)' },
      { en: 'Asparagus & Mozzarella Frittata (with tomato & green pepper)', ar: 'فريتاتا الهليون والموزاريلا (مع الطماطم والفلفل الأخضر)' },
      { en: 'Zucchini, Potato & Feta Frittata (with tomato, bell pepper & dill)', ar: 'فريتاتا الكوسا والبطاطس والفيتا (مع الطماطم والفلفل الحلو والشبت)' },
      { en: 'Turkey Bacon & Cheese Frittata (with rosemary)', ar: 'فريتاتا لحم الديك الرومي المقدد والجبن (مع إكليل الجبل)' },
      { en: 'Mushroom Frittata', ar: 'فريتاتا الفطر' },
      { en: 'Summer Frittata', ar: 'فريتاتا الصيف' },
      { en: 'Veggie Frittata', ar: 'فريتاتا الخضار' },
      { en: 'Spinach & Cheese Crepe', ar: 'كريب السبانخ والجبن' },
      { en: 'Gouda & Mushroom Crepe', ar: 'كريب الجودة والفطر' },
      { en: 'Sausage, Gouda & Edam Crepe', ar: 'كريب النقانق والجودة والإيدام' },
      { en: 'Sausage, Cheese, Tomato & Mushroom Crepe', ar: 'كريب النقانق والجبن والطماطم والفطر' },
      { en: 'Turkey & Cheese Crepe (plain or with mushrooms)', ar: 'كريب الديك الرومي والجبن (سادة أو مع الفطر)' },
      { en: 'Waffles with Bitter Chocolate Sauce', ar: 'وافل بصلصة الشوكولاتة المرة' },
      { en: "Quiche Laurent's", ar: 'كيش لوران' },
    ],
  },
  {
    id: 'soup',
    label: 'Soup',
    labelAr: 'الشوربة',
    image: soupImg,
    items: [
      { en: 'Minestrone Soup', ar: 'شوربة مينستروني' },
      { en: 'Carrot & Coriander Soup', ar: 'شوربة الجزر والكزبرة' },
      { en: 'Pumpkin Soup', ar: 'شوربة اليقطين' },
      { en: 'Lentil Soup', ar: 'شوربة العدس' },
      { en: 'Harirah Soup', ar: 'شوربة الحريرة' },
      { en: 'Tomato Soup', ar: 'شوربة الطماطم' },
      { en: 'Potato Leek Soup', ar: 'شوربة البطاطس والكراث' },
      { en: 'Vegetable Soup', ar: 'شوربة الخضار' },
      { en: 'Chicken Cream Soup', ar: 'شوربة كريمة الدجاج' },
      { en: 'Mushroom Cream Soup', ar: 'شوربة كريمة الفطر' },
      { en: 'Seafood Soup', ar: 'شوربة المأكولات البحرية' },
      { en: 'Broccoli Cream Soup', ar: 'شوربة كريمة البروكلي' },
    ],
  },
  {
    id: 'appetizer',
    label: 'Appetizers',
    labelAr: 'المقبلات',
    image: appetizerImg,
    items: [
      { en: 'Cold Canapés', ar: 'كنافيه باردة' },
      { en: 'Chicken Breast Fajitas', ar: 'فاهيتا صدر الدجاج' },
      { en: 'Prawns with Mango Salsa', ar: 'جمبري مع صلصة المانجو' },
      { en: 'Hammour Finger, Sesame Teriyaki', ar: 'أصابع الهامور بالسمسم والترياكي' },
      { en: 'Lobster with Smoked Turkey', ar: 'لوبستر مع الديك الرومي المدخن' },
      { en: 'Vine Leaves Stuffed with Rice', ar: 'ورق عنب محشي بالأرز' },
      { en: 'Vine Leaves Stuffed with Lobster', ar: 'ورق عنب محشي باللوبستر' },
      { en: 'Cold Seafood Platter', ar: 'طبق المأكولات البحرية الباردة' },
      { en: 'Arabic Mezza', ar: 'مزة عربية' },
      { en: 'Melon & Bresaola Skewers', ar: 'أسياخ الشمام والبريزاولا' },
      { en: 'Parmesan & Bresaola Skewers', ar: 'أسياخ البارميزان والبريزاولا' },
      { en: 'Caprese Skewers (mozzarella, tomato & basil)', ar: 'أسياخ كابريزي (موزاريلا وطماطم وريحان)' },
      { en: 'Grilled Halloumi on Tomato', ar: 'حلوم مشوي على الطماطم' },
    ],
  },
  {
    id: 'salad',
    label: 'Salads',
    labelAr: 'السلطات',
    image: saladImg,
    items: [
      { en: 'Green Salad', ar: 'سلطة خضراء' },
      { en: 'Greek Salad', ar: 'سلطة يونانية' },
      { en: 'Rocket Salad with Dry Tomato, Nuts & Parmesan', ar: 'سلطة الجرجير مع الطماطم المجففة والمكسرات والبارميزان' },
      { en: 'Chicken Caesar Salad', ar: 'سلطة سيزر بالدجاج' },
      { en: 'Nicosia Salad', ar: 'سلطة نيقوسيا' },
      { en: 'Tabbouleh with Spinach & Strawberry', ar: 'تبولة بالسبانخ والفراولة' },
      { en: 'Regular Tabbouleh', ar: 'تبولة عادية' },
      { en: 'Green Salad with Mango & Tomato', ar: 'سلطة خضراء بالمانجو والطماطم' },
      { en: 'Carrot, Orange & Apple Salad', ar: 'سلطة الجزر والبرتقال والتفاح' },
      { en: 'Grilled Chicken with Pineapple Salad', ar: 'سلطة الدجاج المشوي بالأناناس' },
      { en: 'Beef Salad with Tomato & Herb Oil', ar: 'سلطة اللحم البقري بالطماطم وزيت الأعشاب' },
      { en: 'Baby Spinach with Cherry Tomatoes & Homemade Roquefort', ar: 'سبانخ صغيرة مع طماطم كرزية وروكفور منزلي' },
      { en: 'Mixed Greens with Pomegranate Seeds, Goat Cheese & Balsamic', ar: 'خضار مشكلة مع حبوب الرمان وجبن الماعز والبلسمك' },
      { en: 'Mixed Greens with Rocket, Cherry Tomatoes & Grilled Halloumi', ar: 'خضار مشكلة مع الجرجير والطماطم الكرزية والحلوم المشوي' },
      { en: 'Rocket Salad with Walnuts or Pine Nuts, Sundried Tomato & Mozzarella Pearls', ar: 'سلطة الجرجير مع الجوز أو الصنوبر والطماطم المجففة ولآلئ الموزاريلا' },
      { en: 'Rocket Salad with Grilled Portobello Mushrooms & Baby Tomatoes', ar: 'سلطة الجرجير مع فطر البورتوبيلو المشوي والطماطم الصغيرة' },
      { en: 'Cool Dietary Vegetable Salad (potato, zucchini, tomato, olives, egg or grilled chicken)', ar: 'سلطة خضار حمية باردة (بطاطس، كوسا، طماطم، زيتون، بيض أو دجاج مشوي)' },
      { en: 'Parmesan Cheese Bowl (romaine, spinach, beetroot, dates, orange, walnuts)', ar: 'وعاء جبن البارميزان (خس روماني، سبانخ، شمندر، تمر، برتقال، جوز)' },
      { en: 'Tomato & Cucumber Salad with Feta (Greek style)', ar: 'سلطة الطماطم والخيار بالفيتا (على الطريقة اليونانية)' },
      { en: 'Caprese Salad (mozzarella, tomato & basil)', ar: 'سلطة كابريزي (موزاريلا وطماطم وريحان)' },
    ],
  },
  {
    id: 'chicken',
    label: 'Chicken',
    labelAr: 'الدجاج',
    image: chickenImg,
    items: [
      { en: 'Chicken Biryani', ar: 'برياني الدجاج' },
      { en: 'Chicken Kapsa', ar: 'كبسة الدجاج' },
      { en: 'Chicken Zorbian', ar: 'زربيان الدجاج' },
      { en: 'Marinated Grilled Chicken with Provençal Sauce', ar: 'دجاج مشوي متبل بصلصة البروفنسال' },
      { en: 'Chicken Stroganoff', ar: 'ستروغانوف الدجاج' },
      { en: 'Chicken Stir Fry with Vegetable Fried Rice', ar: 'دجاج سوتيه مع أرز مقلي بالخضار' },
      { en: 'Chicken Cordon Bleu', ar: 'دجاج كوردون بلو' },
      { en: 'Roasted Chicken', ar: 'دجاج مشوي بالفرن' },
      { en: 'Chicken Breast Stuffed with Mushroom & Parmesan', ar: 'صدر دجاج محشو بالفطر والبارميزان' },
      { en: 'Chicken Breast Stuffed with Arabic Rice', ar: 'صدر دجاج محشو بالأرز العربي' },
      { en: 'Chicken Tikka', ar: 'تكا الدجاج' },
      { en: 'Chicken Curry', ar: 'كاري الدجاج' },
      { en: 'Chicken Tajine', ar: 'طاجين الدجاج' },
      { en: 'Chicken Escalope', ar: 'إسكالوب الدجاج' },
      { en: 'Chicken Breast Stuffed with Spinach & Melting Cheese', ar: 'صدر دجاج محشو بالسبانخ والجبن الذائب' },
      { en: 'Chicken Roll Stuffed with Spinach, Parmesan & Dried Tomatoes', ar: 'لفافة دجاج محشوة بالسبانخ والبارميزان والطماطم المجففة' },
      { en: 'Grilled Chicken Chops (basil mayonnaise optional)', ar: 'قطع دجاج مشوية (مايونيز الريحان اختياري)' },
      { en: 'Chicken Teriyaki (or orange-infused)', ar: 'دجاج ترياكي (أو بنكهة البرتقال)' },
      { en: 'Oven-Baked Chicken Roll in Citrus Sauce (gouda & turkey bacon optional)', ar: 'لفافة دجاج مخبوزة بصلصة الحمضيات (جودة ولحم ديك رومي مقدد اختياري)' },
      { en: 'Oven-Baked Chicken with Okra in Tomato Sauce', ar: 'دجاج مخبوز بالبامية في صلصة الطماطم' },
    ],
  },
  {
    id: 'beef',
    label: 'Beef',
    labelAr: 'اللحم البقري',
    image: beefImg,
    items: [
      { en: 'Grilled Filet Mignon', ar: 'فيليه مينيون مشوي' },
      { en: 'Beef Escalope', ar: 'إسكالوب اللحم البقري' },
      { en: 'Beef Stroganoff', ar: 'ستروغانوف اللحم البقري' },
      { en: 'Beef Steak with Mushroom Sauce (tenderloin recommended)', ar: 'ستيك لحم بقري بصلصة الفطر (يُفضل التندرلوين)' },
      { en: 'Beef Steak in Peppercorn Sauce (tenderloin recommended)', ar: 'ستيك لحم بقري بصلصة الفلفل الأسود (يُفضل التندرلوين)' },
      { en: 'Beef Stir Fry with Vegetable Fried Rice', ar: 'لحم بقري سوتيه مع أرز مقلي بالخضار' },
      { en: 'Pot-Roasted Beef with Mushroom or Pepper Sauce', ar: 'لحم بقري مطهو بالقدر مع صلصة الفطر أو الفلفل' },
      { en: 'Grilled Beef Medallions in Black Pepper or Mushroom Sauce', ar: 'ميدالیات لحم بقري مشوية بصلصة الفلفل الأسود أو الفطر' },
      { en: 'Moussaka', ar: 'مسقعة' },
    ],
  },
  {
    id: 'lamb',
    label: 'Lamb',
    labelAr: 'لحم الضأن',
    image: lambImg,
    items: [
      { en: 'Lamb Biryani', ar: 'برياني لحم الضأن' },
      { en: 'Lamb Kapsa', ar: 'كبسة لحم الضأن' },
      { en: 'Lamb Zorbian', ar: 'زربيان لحم الضأن' },
      { en: 'Lamb Rack with Provençal Sauce', ar: 'ريش ضأن بصلصة البروفنسال' },
      { en: 'Lamb Chops with Mint Sauce', ar: 'قطع لحم ضأن بصلصة النعناع' },
      { en: 'Roasted Lamb', ar: 'لحم ضأن مشوي بالفرن' },
      { en: 'Lamb Curry', ar: 'كاري لحم الضأن' },
      { en: 'Lamb Tajine', ar: 'طاجين لحم الضأن' },
      { en: 'Mint-Marinated Boneless Lamb Shank (oven baked)', ar: 'موزة ضأن منزوعة العظم متبلة بالنعناع (مخبوزة)' },
      { en: 'Stuffed Lamb Roll with Herbs, Vegetables & Cheese (oven baked)', ar: 'لفافة لحم ضأن محشوة بالأعشاب والخضار والجبن (مخبوزة)' },
    ],
  },
  {
    id: 'veal',
    label: 'Veal',
    labelAr: 'لحم العجل',
    image: vealImg,
    items: [
      { en: 'Veal Escalope', ar: 'إسكالوب لحم العجل' },
      { en: 'Veal Cordon Bleu', ar: 'لحم عجل كوردون بلو' },
      { en: 'Roasted Veal Fillet', ar: 'فيليه لحم عجل مشوي بالفرن' },
      { en: 'Grilled Veal Loin Steak', ar: 'ستيك لحم عجل مشوي' },
      { en: 'Veal Piccata', ar: 'بيكاتا لحم العجل' },
    ],
  },
  {
    id: 'seafood',
    label: 'Seafood',
    labelAr: 'المأكولات البحرية',
    image: seafoodImg,
    items: [
      { en: 'Grilled Salmon with Lemon Butter Sauce', ar: 'سلمون مشوي بصلصة الزبدة والليمون' },
      { en: 'Hammour Sayyadia', ar: 'صيادية الهامور' },
      { en: 'Grilled Hammour with Lemon Sauce', ar: 'هامور مشوي بصلصة الليمون' },
      { en: 'Grilled Lobster Tail', ar: 'ذيل لوبستر مشوي' },
      { en: 'Lobster Thermidor', ar: 'لوبستر ثيرميدور' },
      { en: 'Grilled Shrimp', ar: 'جمبري مشوي' },
      { en: 'Baked Hammour', ar: 'هامور مخبوز' },
      { en: 'Baked Shrimp', ar: 'جمبري مخبوز' },
      { en: 'Grilled Sole Fish with Sauce', ar: 'سمك موسى مشوي بالصلصة' },
      { en: 'Grilled Sea Bass Fillet with Herbed Butter & Lemon', ar: 'فيليه سمك القاروص مشوي بزبدة الأعشاب والليمون' },
      { en: 'Grilled Salmon Fillet on Creamed Spinach', ar: 'فيليه سلمون مشوي على كريمة السبانخ' },
      { en: 'Herb-Crusted Salmon Steak (oven-finished on the grill)', ar: 'ستيك سلمون بقشرة الأعشاب (يُنهى في الفرن على الشواية)' },
      { en: 'Grilled Salmon in Sweet Mustard Sauce', ar: 'سلمون مشوي بصلصة الخردل الحلو' },
      { en: 'Grilled Sea Bream or Sea Bass Fillet with Green Parsley Sauce', ar: 'فيليه دنيس أو قاروص مشوي بصلصة البقدونس الأخضر' },
      { en: 'Grilled Tuna Steak, Mustard-Lemon Herb Marinade', ar: 'ستيك تونة مشوي متبل بالخردل والليمون والأعشاب' },
      { en: 'Prawns in Tomato Sauce with Feta (Garides Saganaki)', ar: 'جمبري بصلصة الطماطم والفيتا (غاريدس ساغاناكي)' },
      { en: 'Fennel-Poached Salmon (fennel, carrot, celery, onion)', ar: 'سلمون مسلوق بالشمر (شمر، جزر، كرفس، بصل)' },
    ],
  },
  {
    id: 'pasta',
    label: 'Pasta',
    labelAr: 'المعكرونة',
    image: pastaImg,
    items: [
      { en: 'Fettuccine Pasta', ar: 'معكرونة فيتوتشيني' },
      { en: 'Beef Lasagna', ar: 'لازانيا اللحم البقري' },
      { en: 'Vegetable Lasagna', ar: 'لازانيا الخضار' },
      { en: 'Tortellini with Cheese, Spinach & Cream Sauce', ar: 'تورتليني بالجبن والسبانخ وصلصة الكريمة' },
      { en: 'Macaroni with Tomato Sauce', ar: 'مكرونة بصلصة الطماطم' },
      { en: 'Spaghetti Bolognese', ar: 'سباغيتي بولونيز' },
      { en: 'Penne Arrabbiata', ar: 'بيني أرابياتا' },
      { en: 'Ravioli Pasta', ar: 'معكرونة رافيولي' },
      { en: 'Chicken Pasta', ar: 'معكرونة بالدجاج' },
      { en: 'White Pasta with Cream Sauce', ar: 'معكرونة بيضاء بصلصة الكريمة' },
      { en: 'Tricolor Pasta', ar: 'معكرونة ثلاثية الألوان' },
      { en: 'Tagliatelle', ar: 'تالياتيلي' },
      { en: 'Farfalle with Mushrooms & Cream Sauce', ar: 'فارفالي بالفطر وصلصة الكريمة' },
    ],
  },
  {
    id: 'rice',
    label: 'Rice',
    labelAr: 'الأرز',
    image: riceImg,
    items: [
      { en: 'Basmati Rice', ar: 'أرز بسمتي' },
      { en: 'Jasmine Rice', ar: 'أرز ياسمين' },
      { en: 'Saffron Rice', ar: 'أرز بالزعفران' },
      { en: 'Biryani Rice', ar: 'أرز برياني' },
      { en: 'Wild Rice with Toasted Pine Nuts', ar: 'أرز بري مع الصنوبر المحمص' },
      { en: 'White Rice with Green Beans & Carrot Cubes', ar: 'أرز أبيض بالفاصولياء الخضراء ومكعبات الجزر' },
    ],
  },
  {
    id: 'potato',
    label: 'Potatoes',
    labelAr: 'البطاطس',
    image: potatoImg,
    items: [
      { en: 'Oven-Baked Potato Cubes with Herbs & Citrus Sauce', ar: 'مكعبات بطاطس مخبوزة بالأعشاب وصلصة الحمضيات' },
      { en: 'Whole Baby Potatoes Baked with Fresh Herbs', ar: 'بطاطس صغيرة كاملة مخبوزة بالأعشاب الطازجة' },
      { en: 'Red New Baby Potatoes, Skin-On, Baked (herbed or spicy)', ar: 'بطاطس حمراء صغيرة بقشرها مخبوزة (بالأعشاب أو حارة)' },
      { en: 'Baked Whole Sweet Potato, Sliced', ar: 'بطاطا حلوة كاملة مخبوزة ومقطعة' },
      { en: 'Potatoes au Gratin', ar: 'بطاطس أوغراتان' },
      { en: 'Potato Purée', ar: 'بطاطس مهروسة' },
      { en: 'Sautéed Baby Potatoes with Rosemary & Garlic', ar: 'بطاطس صغيرة سوتيه بإكليل الجبل والثوم' },
    ],
  },
  {
    id: 'vegetable',
    label: 'Vegetables',
    labelAr: 'الخضار',
    image: vegetableImg,
    items: [
      { en: 'Rice-Stuffed Tomatoes & Bell Peppers with Parmesan or Breadcrumbs', ar: 'طماطم وفلفل حلو محشو بالأرز مع البارميزان أو فتات الخبز' },
      { en: 'Grilled Portobello Mushrooms Stuffed with Mozzarella & Tomato', ar: 'فطر بورتوبيلو مشوي محشو بالموزاريلا والطماطم' },
      { en: 'Sautéed Spinach (plain, with feta, tomato or mushrooms)', ar: 'سبانخ سوتيه (سادة، مع الفيتا أو الطماطم أو الفطر)' },
      { en: 'Oven-Baked Okra', ar: 'بامية مخبوزة' },
      { en: 'Broccoli au Gratin', ar: 'بروكلي أوغراتان' },
      { en: 'Grilled Eggplant & Zucchini Rolls (plain or with halloumi)', ar: 'لفائف الباذنجان والكوسا المشوية (سادة أو مع الحلوم)' },
      { en: 'Steamed Baby Carrots, Zucchini, Broccoli & Asparagus', ar: 'جزر وكوسا وبروكلي وهليون صغير مطهو بالبخار' },
      { en: 'Grilled Vegetable Skewers (mushroom, cherry tomato, zucchini, peppers, onion)', ar: 'أسياخ خضار مشوية (فطر، طماطم كرزية، كوسا، فلفل، بصل)' },
    ],
  },
  {
    id: 'dessert',
    label: 'Dessert',
    labelAr: 'الحلويات',
    image: dessertImg,
    items: [
      { en: 'Strawberry Cheesecake', ar: 'تشيز كيك الفراولة' },
      { en: 'Blueberry Cheesecake', ar: 'تشيز كيك التوت الأزرق' },
      { en: 'Lemon Cheesecake', ar: 'تشيز كيك الليمون' },
      { en: 'Plain Cheesecake', ar: 'تشيز كيك سادة' },
      { en: 'Fruit Tart', ar: 'تارت الفواكه' },
      { en: 'Lemon Tart', ar: 'تارت الليمون' },
      { en: 'Strawberry Tart', ar: 'تارت الفراولة' },
      { en: 'Apple Pie', ar: 'فطيرة التفاح' },
      { en: 'Chocolate Fudge Cake', ar: 'كيك فدج الشوكولاتة' },
      { en: 'Chocolate Brownie Cake', ar: 'كيك براوني الشوكولاتة' },
      { en: 'Chocolate Mousse', ar: 'موس الشوكولاتة' },
      { en: 'Vanilla Cake', ar: 'كيك الفانيليا' },
      { en: 'Black Forest Cake', ar: 'كيك الغابة السوداء' },
      { en: 'Tiramisu', ar: 'تيراميسو' },
      { en: 'Opera Cake', ar: 'كيك الأوبرا' },
      { en: 'Carrot Cake', ar: 'كيك الجزر' },
      { en: 'Mouhalabia with Rose Water', ar: 'مهلبية بماء الورد' },
      { en: 'Crème Caramel', ar: 'كريم كراميل' },
      { en: 'Arabic Pastries', ar: 'حلويات عربية' },
      { en: 'French Pastries', ar: 'حلويات فرنسية' },
      { en: 'Om Ali', ar: 'أم علي' },
      { en: 'Chocolate Soufflé (individual)', ar: 'سوفليه شوكولاتة (فردي)' },
      { en: 'Crème Brûlée (individual, torched brown sugar)', ar: 'كريم بروليه (فردي، سكر بني محروق)' },
      { en: 'Profiteroles in Warm Chocolate Sauce', ar: 'بروفيترول بصلصة الشوكولاتة الدافئة' },
      { en: 'Dietary Fresh Fruit Mousse (seasonal)', ar: 'موس فواكه طازجة حمية (موسمي)' },
      { en: 'Millefeuille (simple)', ar: 'ميل فاي (بسيط)' },
      { en: 'Millefeuille with Red Berries or Strawberries', ar: 'ميل فاي بالتوت الأحمر أو الفراولة' },
      { en: 'Dietary Seasonal Fruit Gel', ar: 'جل فواكه موسمية حمية' },
      { en: 'Panna Cotta with Chocolate or Berry Coulis', ar: 'بانا كوتا بصلصة الشوكولاتة أو التوت' },
      { en: 'English Truffle (traditional)', ar: 'ترافل إنجليزي (تقليدي)' },
      { en: 'Choux à la Crème (caramel-glazed cream puffs)', ar: 'شو ألا كريم (كريم بف مغطى بالكراميل)' },
      { en: 'Classic Éclairs (vanilla cream, dark chocolate)', ar: 'إكلير كلاسيكي (كريمة فانيليا، شوكولاتة داكنة)' },
      { en: 'Éclairs with Cinnamon or Lemon Cream (pink glaze)', ar: 'إكلير بكريمة القرفة أو الليمون (تزجيج وردي)' },
      { en: 'Caramel & Mascarpone Éclairs', ar: 'إكلير الكراميل والماسكاربوني' },
    ],
  },
  {
    id: 'snack',
    label: 'Hot Snacks',
    labelAr: 'المقبلات الساخنة',
    image: snackImg,
    items: [
      { en: 'Assorted Mini Pizza', ar: 'بيتزا صغيرة متنوعة' },
      { en: 'Sambousa (cheese, beef, chicken, vegetable)', ar: 'سمبوسة (جبن، لحم بقري، دجاج، خضار)' },
      { en: 'Kibbeh (chicken or beef)', ar: 'كبة (دجاج أو لحم بقري)' },
      { en: 'Spring Rolls (vegetable, beef, chicken)', ar: 'لفائف الربيع (خضار، لحم بقري، دجاج)' },
      { en: 'Chicken Wings', ar: 'أجنحة دجاج' },
      { en: 'Mini Chicken & Beef Shawarma Sandwiches', ar: 'سندويشات شاورما دجاج ولحم بقري صغيرة' },
      { en: 'Mini Chicken & Beef Kodo Sandwiches', ar: 'سندويشات كودو دجاج ولحم بقري صغيرة' },
      { en: 'Mini Panini (chicken & beef)', ar: 'بانيني صغير (دجاج ولحم بقري)' },
      { en: 'Mini Chicken & Beef Burgers', ar: 'برغر دجاج ولحم بقري صغير' },
      { en: 'Assorted Fatayer', ar: 'فطائر متنوعة' },
      { en: 'Beef Fatayer (puff pastry)', ar: 'فطائر اللحم البقري (عجين السفنج)' },
      { en: 'Mini Assorted Grilled Kebab', ar: 'كباب مشوي متنوع صغير' },
      { en: 'Chicken Satay', ar: 'ساتيه الدجاج' },
      { en: 'Chicken Fingers', ar: 'أصابع دجاج' },
      { en: 'Chicken Nuggets', ar: 'ناغتس دجاج' },
      { en: 'Fish Fingers', ar: 'أصابع سمك' },
      { en: 'Mozzarella Cheese Fingers', ar: 'أصابع جبن الموزاريلا' },
      { en: 'Assorted Quiches & Vol-au-Vent', ar: 'كيش وفول أو فون متنوع' },
      { en: 'Grilled Sausage in Crêpes', ar: 'نقانق مشوية في الكريب' },
      { en: 'Mini Chicken Cordon Bleu', ar: 'دجاج كوردون بلو صغير' },
      { en: 'Savory Crepes (turkey, cheese, mushroom, pepper, tomato)', ar: 'كريب مالح (ديك رومي، جبن، فطر، فلفل، طماطم)' },
      { en: 'Mini Grilled Shrimp Skewers', ar: 'أسياخ جمبري مشوية صغيرة' },
      { en: 'Bruschetta (tomato mozzarella basil / eggplant parmesan / vegetables mozzarella)', ar: 'بروسكيتا (طماطم موزاريلا ريحان / باذنجان بارميزان / خضار موزاريلا)' },
      { en: 'Meatballs with Mint & French Fries', ar: 'كرات اللحم بالنعناع والبطاطس المقلية' },
      { en: 'Beef Meatballs in Teriyaki Sauce', ar: 'كرات اللحم البقري بصلصة الترياكي' },
    ],
  },
  {
    id: 'drink',
    label: 'Drinks',
    labelAr: 'المشروبات',
    image: drinkImg,
    items: [
      { en: 'Arabic Coffee', ar: 'قهوة عربية' },
      { en: 'Espresso', ar: 'إسبريسو' },
      { en: 'Cappuccino', ar: 'كابتشينو' },
      { en: 'Turkish Coffee', ar: 'قهوة تركية' },
      { en: 'English Breakfast Tea', ar: 'شاي الإفطار الإنجليزي' },
      { en: 'Mint Tea', ar: 'شاي بالنعناع' },
      { en: 'Green Tea', ar: 'شاي أخضر' },
      { en: 'Karak Tea', ar: 'شاي كرك' },
      { en: 'Fresh Orange Juice', ar: 'عصير برتقال طازج' },
      { en: 'Fresh Pomegranate Juice', ar: 'عصير رمان طازج' },
      { en: 'Fresh Mango Juice', ar: 'عصير مانجو طازج' },
      { en: 'Fresh Watermelon Juice', ar: 'عصير بطيخ طازج' },
      { en: 'Mixed Berry Smoothie', ar: 'سموذي التوت المشكل' },
      { en: 'Still Water', ar: 'مياه غير فوارة' },
      { en: 'Sparkling Water', ar: 'مياه فوارة' },
      { en: 'Soft Drinks (Cola, Diet Cola, Lemon-Lime)', ar: 'مشروبات غازية (كولا، كولا دايت، ليمون)' },
      { en: 'Iced Tea', ar: 'شاي مثلج' },
      { en: 'Virgin Mojito', ar: 'موهيتو خالي من الكحول' },
      { en: 'Virgin Piña Colada', ar: 'بينا كولادا خالية من الكحول' },
      { en: 'Lemon & Mint Cooler', ar: 'مشروب الليمون والنعناع المنعش' },
    ],
  },
];
