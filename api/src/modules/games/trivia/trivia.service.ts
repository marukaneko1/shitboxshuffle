import { Injectable } from "@nestjs/common";
import { TriviaState, TriviaQuestion, TriviaConfig, TriviaAnswer, TriviaPlayer, TriviaTheme } from "./trivia.types";

// Trivia questions organized by theme — 200 per category, shuffled every game
const QUESTIONS_BY_THEME: Record<string, TriviaQuestion[]> = {
  geography: [
    { question: "What is the capital of France?", allAnswers: ["London", "Berlin", "Paris", "Madrid"], correctAnswer: "Paris", category: "geography" },
    { question: "Which ocean is the largest?", allAnswers: ["Atlantic", "Indian", "Arctic", "Pacific"], correctAnswer: "Pacific", category: "geography" },
    { question: "How many continents are there?", allAnswers: ["5", "6", "7", "8"], correctAnswer: "7", category: "geography" },
    { question: "What is the longest river in the world?", allAnswers: ["Amazon", "Nile", "Mississippi", "Yangtze"], correctAnswer: "Nile", category: "geography" },
    { question: "Which country is known as the Land of the Rising Sun?", allAnswers: ["China", "South Korea", "Japan", "Thailand"], correctAnswer: "Japan", category: "geography" },
    { question: "What is the smallest country in the world?", allAnswers: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"], correctAnswer: "Vatican City", category: "geography" },
    { question: "Which mountain is the tallest in the world?", allAnswers: ["K2", "Mount Everest", "Kangchenjunga", "Lhotse"], correctAnswer: "Mount Everest", category: "geography" },
    { question: "What is the capital of Australia?", allAnswers: ["Sydney", "Melbourne", "Canberra", "Brisbane"], correctAnswer: "Canberra", category: "geography" },
    { question: "Which desert is the largest in the world?", allAnswers: ["Gobi", "Sahara", "Arabian", "Antarctic"], correctAnswer: "Antarctic", category: "geography" },
    { question: "What is the capital of Brazil?", allAnswers: ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador"], correctAnswer: "Brasília", category: "geography" },
    { question: "Which country has the most time zones?", allAnswers: ["Russia", "United States", "France", "China"], correctAnswer: "France", category: "geography" },
    { question: "What is the deepest ocean trench?", allAnswers: ["Puerto Rico Trench", "Mariana Trench", "Tonga Trench", "Kuril-Kamchatka Trench"], correctAnswer: "Mariana Trench", category: "geography" },
    { question: "Which city is known as the Big Apple?", allAnswers: ["Chicago", "Los Angeles", "New York", "Boston"], correctAnswer: "New York", category: "geography" },
    { question: "What is the capital of Canada?", allAnswers: ["Toronto", "Vancouver", "Ottawa", "Montreal"], correctAnswer: "Ottawa", category: "geography" },
    { question: "Which country is shaped like a boot?", allAnswers: ["Greece", "Italy", "Spain", "Portugal"], correctAnswer: "Italy", category: "geography" },
    { question: "What is the capital of Japan?", allAnswers: ["Osaka", "Kyoto", "Tokyo", "Hiroshima"], correctAnswer: "Tokyo", category: "geography" },
    { question: "What is the largest country by land area?", allAnswers: ["Canada", "China", "United States", "Russia"], correctAnswer: "Russia", category: "geography" },
    { question: "What is the capital of Germany?", allAnswers: ["Munich", "Hamburg", "Frankfurt", "Berlin"], correctAnswer: "Berlin", category: "geography" },
    { question: "Which continent is the Sahara Desert on?", allAnswers: ["Asia", "South America", "Africa", "Australia"], correctAnswer: "Africa", category: "geography" },
    { question: "What is the tallest waterfall in the world?", allAnswers: ["Niagara Falls", "Victoria Falls", "Angel Falls", "Iguazu Falls"], correctAnswer: "Angel Falls", category: "geography" },
    { question: "Which sea is the saltiest body of water?", allAnswers: ["Red Sea", "Dead Sea", "Caspian Sea", "Mediterranean Sea"], correctAnswer: "Dead Sea", category: "geography" },
    { question: "What is the capital of India?", allAnswers: ["Mumbai", "Kolkata", "New Delhi", "Chennai"], correctAnswer: "New Delhi", category: "geography" },
    { question: "Which country contains most of the Amazon rainforest?", allAnswers: ["Colombia", "Peru", "Bolivia", "Brazil"], correctAnswer: "Brazil", category: "geography" },
    { question: "What is the longest mountain range in the world?", allAnswers: ["Himalayas", "Rockies", "Alps", "Andes"], correctAnswer: "Andes", category: "geography" },
    { question: "Which African country has the largest population?", allAnswers: ["Egypt", "Ethiopia", "Nigeria", "South Africa"], correctAnswer: "Nigeria", category: "geography" },
    { question: "What is the capital of Argentina?", allAnswers: ["Santiago", "Lima", "Bogotá", "Buenos Aires"], correctAnswer: "Buenos Aires", category: "geography" },
    { question: "Which is the only country to border both Spain and France?", allAnswers: ["Monaco", "Andorra", "Liechtenstein", "Luxembourg"], correctAnswer: "Andorra", category: "geography" },
    { question: "What is the capital of South Korea?", allAnswers: ["Busan", "Incheon", "Seoul", "Daegu"], correctAnswer: "Seoul", category: "geography" },
    { question: "Which ocean lies between Africa and Australia?", allAnswers: ["Atlantic", "Arctic", "Pacific", "Indian"], correctAnswer: "Indian", category: "geography" },
    { question: "What is the most populous city in the world?", allAnswers: ["Mumbai", "Shanghai", "Tokyo", "Mexico City"], correctAnswer: "Tokyo", category: "geography" },
    { question: "Which country owns the Galapagos Islands?", allAnswers: ["Peru", "Colombia", "Chile", "Ecuador"], correctAnswer: "Ecuador", category: "geography" },
    { question: "What is the capital of Egypt?", allAnswers: ["Alexandria", "Luxor", "Cairo", "Giza"], correctAnswer: "Cairo", category: "geography" },
    { question: "Which European country has the most natural lakes?", allAnswers: ["Norway", "Sweden", "Finland", "Russia"], correctAnswer: "Finland", category: "geography" },
    { question: "What is the capital of Mexico?", allAnswers: ["Guadalajara", "Monterrey", "Tijuana", "Mexico City"], correctAnswer: "Mexico City", category: "geography" },
    { question: "Which strait separates Europe from Africa?", allAnswers: ["Strait of Dover", "Strait of Hormuz", "Strait of Gibraltar", "Bosphorus"], correctAnswer: "Strait of Gibraltar", category: "geography" },
    { question: "What is the capital of New Zealand?", allAnswers: ["Auckland", "Christchurch", "Wellington", "Hamilton"], correctAnswer: "Wellington", category: "geography" },
    { question: "Which is the smallest continent by land area?", allAnswers: ["Europe", "Antarctica", "Australia", "South America"], correctAnswer: "Australia", category: "geography" },
    { question: "What is the capital of South Africa?", allAnswers: ["Cape Town", "Johannesburg", "Durban", "Pretoria"], correctAnswer: "Pretoria", category: "geography" },
    { question: "Which country owns Easter Island?", allAnswers: ["Peru", "Ecuador", "New Zealand", "Chile"], correctAnswer: "Chile", category: "geography" },
    { question: "What is the capital of Spain?", allAnswers: ["Barcelona", "Seville", "Madrid", "Valencia"], correctAnswer: "Madrid", category: "geography" },
    { question: "What is the capital of Russia?", allAnswers: ["St. Petersburg", "Vladivostok", "Moscow", "Novosibirsk"], correctAnswer: "Moscow", category: "geography" },
    { question: "What is the capital of Italy?", allAnswers: ["Milan", "Naples", "Venice", "Rome"], correctAnswer: "Rome", category: "geography" },
    { question: "Which country is the largest in Africa by area?", allAnswers: ["Sudan", "Democratic Republic of Congo", "Libya", "Algeria"], correctAnswer: "Algeria", category: "geography" },
    { question: "What is the capital of Norway?", allAnswers: ["Bergen", "Stavanger", "Trondheim", "Oslo"], correctAnswer: "Oslo", category: "geography" },
    { question: "What is the capital of Turkey?", allAnswers: ["Istanbul", "Izmir", "Ankara", "Bursa"], correctAnswer: "Ankara", category: "geography" },
    { question: "Which country has the longest coastline in the world?", allAnswers: ["United States", "Russia", "Norway", "Canada"], correctAnswer: "Canada", category: "geography" },
    { question: "What is the capital of Portugal?", allAnswers: ["Porto", "Faro", "Braga", "Lisbon"], correctAnswer: "Lisbon", category: "geography" },
    { question: "Which river runs through London?", allAnswers: ["Severn", "Avon", "Thames", "Trent"], correctAnswer: "Thames", category: "geography" },
    { question: "What is the capital of Thailand?", allAnswers: ["Chiang Mai", "Phuket", "Bangkok", "Pattaya"], correctAnswer: "Bangkok", category: "geography" },
    { question: "What is the official language of Brazil?", allAnswers: ["Spanish", "French", "English", "Portuguese"], correctAnswer: "Portuguese", category: "geography" },
    { question: "What is the capital of Saudi Arabia?", allAnswers: ["Mecca", "Jeddah", "Medina", "Riyadh"], correctAnswer: "Riyadh", category: "geography" },
    { question: "What is the capital of Pakistan?", allAnswers: ["Karachi", "Lahore", "Islamabad", "Peshawar"], correctAnswer: "Islamabad", category: "geography" },
    { question: "Which volcano destroyed the city of Pompeii?", allAnswers: ["Mount Etna", "Stromboli", "Vesuvius", "Santorini"], correctAnswer: "Vesuvius", category: "geography" },
    { question: "What is the capital of the Philippines?", allAnswers: ["Cebu", "Davao", "Manila", "Quezon City"], correctAnswer: "Manila", category: "geography" },
    { question: "What is the capital of Nigeria?", allAnswers: ["Lagos", "Kano", "Ibadan", "Abuja"], correctAnswer: "Abuja", category: "geography" },
    { question: "Which river forms the border between Mexico and the United States?", allAnswers: ["Colorado", "Rio Grande", "Pecos", "Arkansas"], correctAnswer: "Rio Grande", category: "geography" },
    { question: "What is the capital of Ukraine?", allAnswers: ["Lviv", "Odessa", "Kharkiv", "Kyiv"], correctAnswer: "Kyiv", category: "geography" },
    { question: "Which is the largest island in the world?", allAnswers: ["New Guinea", "Borneo", "Madagascar", "Greenland"], correctAnswer: "Greenland", category: "geography" },
    { question: "What is the capital of Indonesia?", allAnswers: ["Surabaya", "Medan", "Bandung", "Jakarta"], correctAnswer: "Jakarta", category: "geography" },
    { question: "What is the capital of the Netherlands?", allAnswers: ["Rotterdam", "The Hague", "Utrecht", "Amsterdam"], correctAnswer: "Amsterdam", category: "geography" },
    { question: "Which mountain range forms the border between Europe and Asia?", allAnswers: ["Caucasus", "Carpathians", "Ural Mountains", "Alps"], correctAnswer: "Ural Mountains", category: "geography" },
    { question: "What is the capital of Poland?", allAnswers: ["Kraków", "Gdańsk", "Łódź", "Warsaw"], correctAnswer: "Warsaw", category: "geography" },
    { question: "Which African country was formerly known as Abyssinia?", allAnswers: ["Sudan", "Eritrea", "Somalia", "Ethiopia"], correctAnswer: "Ethiopia", category: "geography" },
    { question: "What is the capital of Iran?", allAnswers: ["Isfahan", "Mashhad", "Tabriz", "Tehran"], correctAnswer: "Tehran", category: "geography" },
    { question: "Which country is made up of over 17,000 islands?", allAnswers: ["Japan", "Philippines", "Maldives", "Indonesia"], correctAnswer: "Indonesia", category: "geography" },
    { question: "What is the capital of Bangladesh?", allAnswers: ["Chittagong", "Khulna", "Rajshahi", "Dhaka"], correctAnswer: "Dhaka", category: "geography" },
    { question: "What is the largest city in South America by population?", allAnswers: ["Buenos Aires", "Rio de Janeiro", "Lima", "São Paulo"], correctAnswer: "São Paulo", category: "geography" },
    { question: "What is the capital of Vietnam?", allAnswers: ["Ho Chi Minh City", "Da Nang", "Hue", "Hanoi"], correctAnswer: "Hanoi", category: "geography" },
    { question: "What is the capital of Colombia?", allAnswers: ["Medellín", "Cali", "Barranquilla", "Bogotá"], correctAnswer: "Bogotá", category: "geography" },
    { question: "Which lake is the highest navigable lake in the world?", allAnswers: ["Lake Baikal", "Lake Victoria", "Lake Geneva", "Lake Titicaca"], correctAnswer: "Lake Titicaca", category: "geography" },
    { question: "What is the capital of Romania?", allAnswers: ["Cluj-Napoca", "Timișoara", "Iași", "Bucharest"], correctAnswer: "Bucharest", category: "geography" },
    { question: "What is the capital of Malaysia?", allAnswers: ["Johor Bahru", "Penang", "Ipoh", "Kuala Lumpur"], correctAnswer: "Kuala Lumpur", category: "geography" },
    { question: "Which is the smallest ocean?", allAnswers: ["Southern", "Indian", "Atlantic", "Arctic"], correctAnswer: "Arctic", category: "geography" },
    { question: "What is the capital of Kenya?", allAnswers: ["Mombasa", "Kisumu", "Nakuru", "Nairobi"], correctAnswer: "Nairobi", category: "geography" },
    { question: "Which U.S. state has the longest coastline?", allAnswers: ["Florida", "California", "Hawaii", "Alaska"], correctAnswer: "Alaska", category: "geography" },
    { question: "What is the capital of the Czech Republic?", allAnswers: ["Brno", "Ostrava", "Plzeň", "Prague"], correctAnswer: "Prague", category: "geography" },
    { question: "What is the capital of Hungary?", allAnswers: ["Debrecen", "Miskolc", "Győr", "Budapest"], correctAnswer: "Budapest", category: "geography" },
    { question: "Which river is the longest in South America?", allAnswers: ["Orinoco", "Paraguay", "Paraná", "Amazon"], correctAnswer: "Amazon", category: "geography" },
    { question: "What is the capital of Morocco?", allAnswers: ["Casablanca", "Marrakech", "Fes", "Rabat"], correctAnswer: "Rabat", category: "geography" },
    { question: "What is the capital of Switzerland?", allAnswers: ["Geneva", "Zurich", "Basel", "Bern"], correctAnswer: "Bern", category: "geography" },
    { question: "Which mountain is the highest in Africa?", allAnswers: ["Mount Kenya", "Rwenzori", "Toubkal", "Mount Kilimanjaro"], correctAnswer: "Mount Kilimanjaro", category: "geography" },
    { question: "What is the capital of Greece?", allAnswers: ["Thessaloniki", "Patras", "Piraeus", "Athens"], correctAnswer: "Athens", category: "geography" },
    { question: "What is the capital of Chile?", allAnswers: ["Valparaíso", "Concepción", "Antofagasta", "Santiago"], correctAnswer: "Santiago", category: "geography" },
    { question: "What is the capital of Cuba?", allAnswers: ["Santiago de Cuba", "Cienfuegos", "Trinidad", "Havana"], correctAnswer: "Havana", category: "geography" },
    { question: "Which country is home to the Great Barrier Reef?", allAnswers: ["New Zealand", "Papua New Guinea", "Fiji", "Australia"], correctAnswer: "Australia", category: "geography" },
    { question: "What is the capital of Venezuela?", allAnswers: ["Maracaibo", "Valencia", "Barquisimeto", "Caracas"], correctAnswer: "Caracas", category: "geography" },
    { question: "What is the capital of Ireland?", allAnswers: ["Cork", "Galway", "Limerick", "Dublin"], correctAnswer: "Dublin", category: "geography" },
    { question: "Which body of water separates the UK from France?", allAnswers: ["North Sea", "Irish Sea", "Celtic Sea", "English Channel"], correctAnswer: "English Channel", category: "geography" },
    { question: "What is the capital of Austria?", allAnswers: ["Graz", "Salzburg", "Innsbruck", "Vienna"], correctAnswer: "Vienna", category: "geography" },
    { question: "Which country is the world's largest producer of coffee?", allAnswers: ["Colombia", "Ethiopia", "Vietnam", "Brazil"], correctAnswer: "Brazil", category: "geography" },
    { question: "What is the capital of Denmark?", allAnswers: ["Aarhus", "Odense", "Aalborg", "Copenhagen"], correctAnswer: "Copenhagen", category: "geography" },
    { question: "What is the capital of Finland?", allAnswers: ["Tampere", "Turku", "Espoo", "Helsinki"], correctAnswer: "Helsinki", category: "geography" },
    { question: "Which country has the most UNESCO World Heritage Sites?", allAnswers: ["France", "Spain", "China", "Italy"], correctAnswer: "Italy", category: "geography" },
    { question: "What is the capital of Peru?", allAnswers: ["Cusco", "Arequipa", "Trujillo", "Lima"], correctAnswer: "Lima", category: "geography" },
    { question: "Which city is known as the 'City of Canals'?", allAnswers: ["Amsterdam", "Bruges", "Stockholm", "Venice"], correctAnswer: "Venice", category: "geography" },
    { question: "What is the capital of Ethiopia?", allAnswers: ["Dire Dawa", "Mekelle", "Gondar", "Addis Ababa"], correctAnswer: "Addis Ababa", category: "geography" },
    { question: "What is the capital of Belgium?", allAnswers: ["Antwerp", "Ghent", "Liège", "Brussels"], correctAnswer: "Brussels", category: "geography" },
    { question: "Which river runs through Paris?", allAnswers: ["Loire", "Rhône", "Rhine", "Seine"], correctAnswer: "Seine", category: "geography" },
    { question: "What is the capital of Jamaica?", allAnswers: ["Montego Bay", "Negril", "Ocho Rios", "Kingston"], correctAnswer: "Kingston", category: "geography" },
    { question: "Which country is known as the 'Land of the Midnight Sun'?", allAnswers: ["Iceland", "Sweden", "Finland", "Norway"], correctAnswer: "Norway", category: "geography" },
    { question: "What is the capital of Croatia?", allAnswers: ["Split", "Dubrovnik", "Rijeka", "Zagreb"], correctAnswer: "Zagreb", category: "geography" },
    { question: "Which river runs through Vienna, Budapest, and Belgrade?", allAnswers: ["Rhine", "Elbe", "Vistula", "Danube"], correctAnswer: "Danube", category: "geography" },
    { question: "What is the capital of Iceland?", allAnswers: ["Akureyri", "Keflavik", "Selfoss", "Reykjavik"], correctAnswer: "Reykjavik", category: "geography" },
    { question: "What is the capital of Tunisia?", allAnswers: ["Sfax", "Sousse", "Kairouan", "Tunis"], correctAnswer: "Tunis", category: "geography" },
    { question: "Which is the largest city in Australia by population?", allAnswers: ["Melbourne", "Brisbane", "Perth", "Sydney"], correctAnswer: "Sydney", category: "geography" },
    { question: "What is the capital of Slovakia?", allAnswers: ["Košice", "Prešov", "Žilina", "Bratislava"], correctAnswer: "Bratislava", category: "geography" },
    { question: "Which country is home to the ancient city of Petra?", allAnswers: ["Israel", "Lebanon", "Syria", "Jordan"], correctAnswer: "Jordan", category: "geography" },
    { question: "What is the capital of Lebanon?", allAnswers: ["Tripoli", "Sidon", "Tyre", "Beirut"], correctAnswer: "Beirut", category: "geography" },
    { question: "What is the capital of Libya?", allAnswers: ["Benghazi", "Misrata", "Tobruk", "Tripoli"], correctAnswer: "Tripoli", category: "geography" },
    { question: "Into which body of water does the Mississippi River empty?", allAnswers: ["Atlantic Ocean", "Caribbean Sea", "Pacific Ocean", "Gulf of Mexico"], correctAnswer: "Gulf of Mexico", category: "geography" },
    { question: "What is the capital of Cambodia?", allAnswers: ["Siem Reap", "Battambang", "Sihanoukville", "Phnom Penh"], correctAnswer: "Phnom Penh", category: "geography" },
    { question: "Which country is home to the Blue Lagoon geothermal spa?", allAnswers: ["Norway", "Greenland", "Finland", "Iceland"], correctAnswer: "Iceland", category: "geography" },
    { question: "Which country has the most active volcanoes?", allAnswers: ["Japan", "United States", "Philippines", "Indonesia"], correctAnswer: "Indonesia", category: "geography" },
    { question: "What is the capital of Georgia (the country)?", allAnswers: ["Batumi", "Kutaisi", "Rustavi", "Tbilisi"], correctAnswer: "Tbilisi", category: "geography" },
    { question: "What is the capital of Qatar?", allAnswers: ["Al Wakrah", "Al Khor", "Umm Salal", "Doha"], correctAnswer: "Doha", category: "geography" },
    { question: "Which two oceans does the Panama Canal connect?", allAnswers: ["Indian and Pacific", "Atlantic and Arctic", "Indian and Atlantic", "Atlantic and Pacific"], correctAnswer: "Atlantic and Pacific", category: "geography" },
    { question: "In which country is Mount Fuji located?", allAnswers: ["South Korea", "China", "Taiwan", "Japan"], correctAnswer: "Japan", category: "geography" },
    { question: "Which U.S. state is Yellowstone National Park primarily in?", allAnswers: ["Montana", "Idaho", "Colorado", "Wyoming"], correctAnswer: "Wyoming", category: "geography" },
    { question: "What is the capital of Paraguay?", allAnswers: ["Ciudad del Este", "Encarnación", "Concepción", "Asunción"], correctAnswer: "Asunción", category: "geography" },
    { question: "What is the highest peak in North America?", allAnswers: ["Mount Logan", "Mount Whitney", "Mount Rainier", "Denali"], correctAnswer: "Denali", category: "geography" },
    { question: "What is the capital of Algeria?", allAnswers: ["Oran", "Constantine", "Annaba", "Algiers"], correctAnswer: "Algiers", category: "geography" },
    { question: "Which country is home to the Kremlin?", allAnswers: ["Belarus", "Ukraine", "Kazakhstan", "Russia"], correctAnswer: "Russia", category: "geography" },
    { question: "What is the capital of Luxembourg?", allAnswers: ["Esch-sur-Alzette", "Differdange", "Dudelange", "Luxembourg City"], correctAnswer: "Luxembourg City", category: "geography" },
    { question: "What is the capital of Nepal?", allAnswers: ["Pokhara", "Lalitpur", "Bhaktapur", "Kathmandu"], correctAnswer: "Kathmandu", category: "geography" },
    { question: "Which city is known as the 'Eternal City'?", allAnswers: ["Athens", "Jerusalem", "Cairo", "Rome"], correctAnswer: "Rome", category: "geography" },
    { question: "What is the capital of Zimbabwe?", allAnswers: ["Bulawayo", "Mutare", "Gweru", "Harare"], correctAnswer: "Harare", category: "geography" },
    { question: "What is the longest river in China?", allAnswers: ["Yellow River", "Pearl River", "Mekong", "Yangtze"], correctAnswer: "Yangtze", category: "geography" },
    { question: "What is the capital of Mozambique?", allAnswers: ["Beira", "Nampula", "Matola", "Maputo"], correctAnswer: "Maputo", category: "geography" },
    { question: "Which country is home to the Amazon River delta?", allAnswers: ["Peru", "Colombia", "Venezuela", "Brazil"], correctAnswer: "Brazil", category: "geography" },
    { question: "What is the capital of Senegal?", allAnswers: ["Touba", "Thiès", "Kaolack", "Dakar"], correctAnswer: "Dakar", category: "geography" },
    { question: "What is the capital of Ghana?", allAnswers: ["Kumasi", "Tamale", "Sekondi", "Accra"], correctAnswer: "Accra", category: "geography" },
    { question: "In which ocean are the Maldives located?", allAnswers: ["Pacific", "Atlantic", "Arctic", "Indian"], correctAnswer: "Indian", category: "geography" },
    { question: "What is the capital of Haiti?", allAnswers: ["Cap-Haïtien", "Les Cayes", "Gonaïves", "Port-au-Prince"], correctAnswer: "Port-au-Prince", category: "geography" },
    { question: "Which European country is known as the 'Land of Fire and Ice'?", allAnswers: ["Norway", "Greenland", "Faroe Islands", "Iceland"], correctAnswer: "Iceland", category: "geography" },
    { question: "What is the capital of Uruguay?", allAnswers: ["Salto", "Paysandú", "Rivera", "Montevideo"], correctAnswer: "Montevideo", category: "geography" },
    { question: "Which is the largest island in the Mediterranean Sea?", allAnswers: ["Sardinia", "Corsica", "Cyprus", "Sicily"], correctAnswer: "Sicily", category: "geography" },
    { question: "What is the capital of Estonia?", allAnswers: ["Tartu", "Narva", "Pärnu", "Tallinn"], correctAnswer: "Tallinn", category: "geography" },
    { question: "Which river is known as China's Sorrow due to its flooding?", allAnswers: ["Yangtze", "Pearl", "Mekong", "Yellow River"], correctAnswer: "Yellow River", category: "geography" },
    { question: "What is the capital of Uzbekistan?", allAnswers: ["Samarkand", "Namangan", "Andijan", "Tashkent"], correctAnswer: "Tashkent", category: "geography" },
    { question: "Which country has the largest population in the world as of 2024?", allAnswers: ["United States", "Indonesia", "China", "India"], correctAnswer: "India", category: "geography" },
    { question: "What is the capital of Laos?", allAnswers: ["Luang Prabang", "Savannakhet", "Pakse", "Vientiane"], correctAnswer: "Vientiane", category: "geography" },
    { question: "In which country are the Pyramids of Giza?", allAnswers: ["Jordan", "Sudan", "Libya", "Egypt"], correctAnswer: "Egypt", category: "geography" },
    { question: "Which country is known as the 'Land of the Long White Cloud'?", allAnswers: ["Fiji", "Samoa", "Tonga", "New Zealand"], correctAnswer: "New Zealand", category: "geography" },
    { question: "What is the capital of Latvia?", allAnswers: ["Daugavpils", "Jelgava", "Jūrmala", "Riga"], correctAnswer: "Riga", category: "geography" },
    { question: "What is the capital of Lithuania?", allAnswers: ["Kaunas", "Klaipėda", "Šiauliai", "Vilnius"], correctAnswer: "Vilnius", category: "geography" },
    { question: "Which city is home to the Colosseum?", allAnswers: ["Athens", "Florence", "Naples", "Rome"], correctAnswer: "Rome", category: "geography" },
    { question: "What is the capital of Serbia?", allAnswers: ["Novi Sad", "Niš", "Kragujevac", "Belgrade"], correctAnswer: "Belgrade", category: "geography" },
    { question: "What is the capital of Angola?", allAnswers: ["Lubango", "Benguela", "Huambo", "Luanda"], correctAnswer: "Luanda", category: "geography" },
    { question: "Which river runs through Baghdad?", allAnswers: ["Euphrates", "Jordan", "Nile", "Tigris"], correctAnswer: "Tigris", category: "geography" },
    { question: "What is the capital of Ecuador?", allAnswers: ["Guayaquil", "Cuenca", "Ambato", "Quito"], correctAnswer: "Quito", category: "geography" },
    { question: "Which country is home to the Acropolis?", allAnswers: ["Turkey", "Italy", "Cyprus", "Greece"], correctAnswer: "Greece", category: "geography" },
    { question: "What is the capital of Sudan?", allAnswers: ["Omdurman", "Port Sudan", "Kassala", "Khartoum"], correctAnswer: "Khartoum", category: "geography" },
    { question: "Which sea is bordered by Turkey, Ukraine, and Russia?", allAnswers: ["Red Sea", "Caspian Sea", "Aegean Sea", "Black Sea"], correctAnswer: "Black Sea", category: "geography" },
    { question: "What is the capital of Zambia?", allAnswers: ["Ndola", "Kitwe", "Livingstone", "Lusaka"], correctAnswer: "Lusaka", category: "geography" },
    { question: "Which river formed the Grand Canyon?", allAnswers: ["Columbia", "Rio Grande", "Snake", "Colorado River"], correctAnswer: "Colorado River", category: "geography" },
    { question: "What is the capital of Trinidad and Tobago?", allAnswers: ["San Fernando", "Arima", "Chaguanas", "Port of Spain"], correctAnswer: "Port of Spain", category: "geography" },
    { question: "In which country is Uluru (Ayers Rock)?", allAnswers: ["New Zealand", "South Africa", "Namibia", "Australia"], correctAnswer: "Australia", category: "geography" },
    { question: "What is the capital of Bulgaria?", allAnswers: ["Plovdiv", "Varna", "Burgas", "Sofia"], correctAnswer: "Sofia", category: "geography" },
    { question: "Which country is home to the city of Timbuktu?", allAnswers: ["Niger", "Mauritania", "Senegal", "Mali"], correctAnswer: "Mali", category: "geography" },
    { question: "What is the capital of Kuwait?", allAnswers: ["Hawalli", "Salmiya", "Farwaniya", "Kuwait City"], correctAnswer: "Kuwait City", category: "geography" },
    { question: "Which desert covers much of Mongolia and northern China?", allAnswers: ["Taklamakan", "Arabian", "Patagonian", "Gobi"], correctAnswer: "Gobi", category: "geography" },
    { question: "What is the capital of Bolivia's government seat?", allAnswers: ["Santa Cruz", "Sucre", "Cochabamba", "La Paz"], correctAnswer: "La Paz", category: "geography" },
    { question: "Which African country is home to Victoria Falls?", allAnswers: ["Tanzania", "Mozambique", "Zambia and Zimbabwe", "Malawi"], correctAnswer: "Zambia and Zimbabwe", category: "geography" },
    { question: "What is the capital of Myanmar?", allAnswers: ["Rangoon", "Mandalay", "Bago", "Naypyidaw"], correctAnswer: "Naypyidaw", category: "geography" },
    { question: "Which lake is the deepest in the world?", allAnswers: ["Lake Superior", "Lake Tanganyika", "Caspian Sea", "Lake Baikal"], correctAnswer: "Lake Baikal", category: "geography" },
    { question: "What is the capital of Cameroon?", allAnswers: ["Douala", "Garoua", "Bamenda", "Yaoundé"], correctAnswer: "Yaoundé", category: "geography" },
    { question: "Which country is home to Angkor Wat?", allAnswers: ["Vietnam", "Thailand", "Laos", "Cambodia"], correctAnswer: "Cambodia", category: "geography" },
    { question: "What is the capital of the Dominican Republic?", allAnswers: ["Santiago", "La Romana", "San Pedro", "Santo Domingo"], correctAnswer: "Santo Domingo", category: "geography" },
    { question: "In which country is the Atacama Desert?", allAnswers: ["Peru", "Argentina", "Bolivia", "Chile"], correctAnswer: "Chile", category: "geography" },
    { question: "What is the capital of Ivory Coast (Côte d'Ivoire)?", allAnswers: ["Bouaké", "Yamoussoukro", "Abidjan", "Daloa"], correctAnswer: "Yamoussoukro", category: "geography" },
    { question: "Which U.S. state is home to the Grand Canyon?", allAnswers: ["Utah", "Nevada", "New Mexico", "Arizona"], correctAnswer: "Arizona", category: "geography" },
    { question: "What is the capital of Honduras?", allAnswers: ["San Pedro Sula", "La Ceiba", "Choloma", "Tegucigalpa"], correctAnswer: "Tegucigalpa", category: "geography" },
    { question: "Which country is home to the Serengeti National Park?", allAnswers: ["Kenya", "Zimbabwe", "Botswana", "Tanzania"], correctAnswer: "Tanzania", category: "geography" },
    { question: "What is the capital of Sri Lanka?", allAnswers: ["Colombo", "Galle", "Kandy", "Sri Jayawardenepura Kotte"], correctAnswer: "Sri Jayawardenepura Kotte", category: "geography" },
    { question: "Which is the largest lake in Africa?", allAnswers: ["Lake Tanganyika", "Lake Malawi", "Lake Chad", "Lake Victoria"], correctAnswer: "Lake Victoria", category: "geography" },
    { question: "What is the capital of Tanzania?", allAnswers: ["Dar es Salaam", "Mwanza", "Arusha", "Dodoma"], correctAnswer: "Dodoma", category: "geography" },
    { question: "Which country is home to the Fiords of Milford Sound?", allAnswers: ["Norway", "Canada", "Chile", "New Zealand"], correctAnswer: "New Zealand", category: "geography" },
    { question: "What is the capital of Malta?", allAnswers: ["Mdina", "Sliema", "Birkirkara", "Valletta"], correctAnswer: "Valletta", category: "geography" },
    { question: "Which mountain range runs along the western coast of the United States?", allAnswers: ["Appalachians", "Ozarks", "Rockies", "Sierra Nevada"], correctAnswer: "Sierra Nevada", category: "geography" },
    { question: "What is the capital of Georgia (the U.S. state)?", allAnswers: ["Savannah", "Macon", "Augusta", "Atlanta"], correctAnswer: "Atlanta", category: "geography" },
    { question: "Which country is home to the fjords?", allAnswers: ["Sweden", "Iceland", "Denmark", "Norway"], correctAnswer: "Norway", category: "geography" },
    { question: "What is the capital of Bahrain?", allAnswers: ["Riffa", "Muharraq", "Hamad Town", "Manama"], correctAnswer: "Manama", category: "geography" },
    { question: "In which continent is the Patagonia region?", allAnswers: ["North America", "Africa", "Antarctica", "South America"], correctAnswer: "South America", category: "geography" },
    { question: "What is the capital of Rwanda?", allAnswers: ["Butare", "Gitarama", "Gisenyi", "Kigali"], correctAnswer: "Kigali", category: "geography" },
    { question: "Which U.S. state contains the most coastline on the Gulf of Mexico?", allAnswers: ["Alabama", "Mississippi", "Louisiana", "Texas"], correctAnswer: "Texas", category: "geography" }
  ],
  science: [
    { question: "Which planet is known as the Red Planet?", allAnswers: ["Venus", "Mars", "Jupiter", "Saturn"], correctAnswer: "Mars", category: "science" },
    { question: "What is the chemical symbol for gold?", allAnswers: ["Go", "Gd", "Au", "Ag"], correctAnswer: "Au", category: "science" },
    { question: "What is the speed of light in vacuum?", allAnswers: ["300,000 km/s", "150,000 km/s", "450,000 km/s", "600,000 km/s"], correctAnswer: "300,000 km/s", category: "science" },
    { question: "How many bones are in the human body?", allAnswers: ["196", "206", "216", "226"], correctAnswer: "206", category: "science" },
    { question: "What is the hardest natural substance on Earth?", allAnswers: ["Gold", "Iron", "Diamond", "Platinum"], correctAnswer: "Diamond", category: "science" },
    { question: "What gas do plants absorb from the atmosphere?", allAnswers: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], correctAnswer: "Carbon Dioxide", category: "science" },
    { question: "What is the smallest unit of matter?", allAnswers: ["Molecule", "Atom", "Electron", "Proton"], correctAnswer: "Atom", category: "science" },
    { question: "How many planets are in our solar system?", allAnswers: ["7", "8", "9", "10"], correctAnswer: "8", category: "science" },
    { question: "What is the most abundant gas in Earth's atmosphere?", allAnswers: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Argon"], correctAnswer: "Nitrogen", category: "science" },
    { question: "What is the freezing point of water in Celsius?", allAnswers: ["-32", "0", "32", "100"], correctAnswer: "0", category: "science" },
    { question: "What is the largest organ in the human body?", allAnswers: ["Liver", "Lungs", "Skin", "Intestines"], correctAnswer: "Skin", category: "science" },
    { question: "How many chromosomes do humans have?", allAnswers: ["42", "44", "46", "48"], correctAnswer: "46", category: "science" },
    { question: "What is the chemical formula for water?", allAnswers: ["H2O", "CO2", "O2", "NaCl"], correctAnswer: "H2O", category: "science" },
    { question: "What is the closest star to Earth?", allAnswers: ["Alpha Centauri", "The Sun", "Sirius", "Proxima Centauri"], correctAnswer: "The Sun", category: "science" },
    { question: "What is the pH of pure water?", allAnswers: ["6", "7", "8", "9"], correctAnswer: "7", category: "science" },
    { question: "Which element has the atomic number 1?", allAnswers: ["Helium", "Oxygen", "Hydrogen", "Carbon"], correctAnswer: "Hydrogen", category: "science" },
    { question: "What force keeps planets in orbit around the Sun?", allAnswers: ["Magnetism", "Friction", "Gravity", "Electricity"], correctAnswer: "Gravity", category: "science" },
    { question: "How long does light from the Sun take to reach Earth?", allAnswers: ["2 minutes", "8 minutes", "20 minutes", "1 hour"], correctAnswer: "8 minutes", category: "science" },
    { question: "What is the powerhouse of the cell?", allAnswers: ["Nucleus", "Ribosome", "Mitochondria", "Chloroplast"], correctAnswer: "Mitochondria", category: "science" },
    { question: "Which gas makes up roughly 21% of Earth's atmosphere?", allAnswers: ["Nitrogen", "Carbon Dioxide", "Oxygen", "Argon"], correctAnswer: "Oxygen", category: "science" },
    { question: "What is the boiling point of water at sea level in Celsius?", allAnswers: ["90", "95", "100", "105"], correctAnswer: "100", category: "science" },
    { question: "What type of energy does a moving object have?", allAnswers: ["Potential", "Thermal", "Kinetic", "Chemical"], correctAnswer: "Kinetic", category: "science" },
    { question: "How many chambers does the human heart have?", allAnswers: ["2", "3", "4", "5"], correctAnswer: "4", category: "science" },
    { question: "Which planet is the largest in our solar system?", allAnswers: ["Saturn", "Neptune", "Uranus", "Jupiter"], correctAnswer: "Jupiter", category: "science" },
    { question: "What is the chemical symbol for sodium?", allAnswers: ["So", "Sd", "Na", "Ni"], correctAnswer: "Na", category: "science" },
    { question: "What part of the plant conducts photosynthesis?", allAnswers: ["Root", "Stem", "Leaf", "Flower"], correctAnswer: "Leaf", category: "science" },
    { question: "What is the unit of electrical resistance?", allAnswers: ["Volt", "Ampere", "Watt", "Ohm"], correctAnswer: "Ohm", category: "science" },
    { question: "Which blood type is the universal donor?", allAnswers: ["A+", "B-", "O-", "AB+"], correctAnswer: "O-", category: "science" },
    { question: "What is the outermost layer of the Earth called?", allAnswers: ["Mantle", "Core", "Crust", "Lithosphere"], correctAnswer: "Crust", category: "science" },
    { question: "How many teeth does an adult human normally have?", allAnswers: ["28", "30", "32", "34"], correctAnswer: "32", category: "science" },
    { question: "Which planet has the most moons?", allAnswers: ["Jupiter", "Saturn", "Uranus", "Neptune"], correctAnswer: "Saturn", category: "science" },
    { question: "What is the study of earthquakes called?", allAnswers: ["Volcanology", "Meteorology", "Seismology", "Geology"], correctAnswer: "Seismology", category: "science" },
    { question: "What is absolute zero in Celsius?", allAnswers: ["-100°C", "-173°C", "-273°C", "-373°C"], correctAnswer: "-273°C", category: "science" },
    { question: "Which vitamin does sunlight provide?", allAnswers: ["Vitamin A", "Vitamin B12", "Vitamin C", "Vitamin D"], correctAnswer: "Vitamin D", category: "science" },
    { question: "How many pairs of ribs does a human have?", allAnswers: ["10", "11", "12", "13"], correctAnswer: "12", category: "science" },
    { question: "What is the name of the force that opposes motion?", allAnswers: ["Gravity", "Inertia", "Friction", "Tension"], correctAnswer: "Friction", category: "science" },
    { question: "Which organ produces insulin?", allAnswers: ["Liver", "Kidney", "Pancreas", "Spleen"], correctAnswer: "Pancreas", category: "science" },
    { question: "What is the most common element in the universe?", allAnswers: ["Helium", "Oxygen", "Carbon", "Hydrogen"], correctAnswer: "Hydrogen", category: "science" },
    { question: "Which scientist formulated the theory of relativity?", allAnswers: ["Isaac Newton", "Nikola Tesla", "Albert Einstein", "Stephen Hawking"], correctAnswer: "Albert Einstein", category: "science" },
    { question: "What is the chemical symbol for iron?", allAnswers: ["Ir", "In", "Fe", "Fo"], correctAnswer: "Fe", category: "science" },
    { question: "What is DNA an abbreviation for?", allAnswers: ["Dynamic Nucleic Acid", "Deoxyribonucleic Acid", "Dual Nitrogen Atom", "Double Nucleotide Array"], correctAnswer: "Deoxyribonucleic Acid", category: "science" },
    { question: "Which planet is closest to the Sun?", allAnswers: ["Venus", "Earth", "Mars", "Mercury"], correctAnswer: "Mercury", category: "science" },
    { question: "What is the chemical symbol for silver?", allAnswers: ["Si", "Sr", "Sv", "Ag"], correctAnswer: "Ag", category: "science" },
    { question: "What is the study of weather called?", allAnswers: ["Geology", "Ecology", "Astronomy", "Meteorology"], correctAnswer: "Meteorology", category: "science" },
    { question: "Which part of the brain controls balance?", allAnswers: ["Cerebrum", "Hypothalamus", "Brainstem", "Cerebellum"], correctAnswer: "Cerebellum", category: "science" },
    { question: "What is the chemical symbol for potassium?", allAnswers: ["Po", "Pt", "Pm", "K"], correctAnswer: "K", category: "science" },
    { question: "Which blood vessel carries blood away from the heart?", allAnswers: ["Vein", "Capillary", "Venule", "Artery"], correctAnswer: "Artery", category: "science" },
    { question: "What is the chemical formula for table salt?", allAnswers: ["KCl", "MgCl2", "CaCl2", "NaCl"], correctAnswer: "NaCl", category: "science" },
    { question: "Which planet rotates on its side?", allAnswers: ["Saturn", "Neptune", "Venus", "Uranus"], correctAnswer: "Uranus", category: "science" },
    { question: "What is the largest mammal on Earth?", allAnswers: ["African Elephant", "Sperm Whale", "Giant Squid", "Blue Whale"], correctAnswer: "Blue Whale", category: "science" },
    { question: "What is the study of animals called?", allAnswers: ["Botany", "Mycology", "Entomology", "Zoology"], correctAnswer: "Zoology", category: "science" },
    { question: "How many bits are in a byte?", allAnswers: ["4", "6", "8", "16"], correctAnswer: "8", category: "science" },
    { question: "What is the chemical symbol for copper?", allAnswers: ["Co", "Cp", "Cr", "Cu"], correctAnswer: "Cu", category: "science" },
    { question: "Which organ stores bile in the human body?", allAnswers: ["Liver", "Pancreas", "Spleen", "Gallbladder"], correctAnswer: "Gallbladder", category: "science" },
    { question: "What is the name for a young frog?", allAnswers: ["Larva", "Nymph", "Caterpillar", "Tadpole"], correctAnswer: "Tadpole", category: "science" },
    { question: "Which gas makes up most of the Sun?", allAnswers: ["Helium", "Oxygen", "Carbon", "Hydrogen"], correctAnswer: "Hydrogen", category: "science" },
    { question: "What is the unit of force?", allAnswers: ["Joule", "Pascal", "Watt", "Newton"], correctAnswer: "Newton", category: "science" },
    { question: "What is the process by which a solid turns directly into a gas?", allAnswers: ["Evaporation", "Condensation", "Melting", "Sublimation"], correctAnswer: "Sublimation", category: "science" },
    { question: "What is the chemical formula for carbon dioxide?", allAnswers: ["CO", "C2O", "CO3", "CO2"], correctAnswer: "CO2", category: "science" },
    { question: "Which planet is known as the Morning Star?", allAnswers: ["Mercury", "Mars", "Jupiter", "Venus"], correctAnswer: "Venus", category: "science" },
    { question: "What is the largest internal organ in the human body?", allAnswers: ["Kidney", "Lung", "Heart", "Liver"], correctAnswer: "Liver", category: "science" },
    { question: "What is the chemical symbol for lead?", allAnswers: ["Le", "Ld", "Li", "Pb"], correctAnswer: "Pb", category: "science" },
    { question: "Which element has the symbol 'W' on the periodic table?", allAnswers: ["Wolfram", "Tungsten", "Yttrium", "Xenon"], correctAnswer: "Tungsten", category: "science" },
    { question: "What is the name for a group of stars forming a pattern?", allAnswers: ["Galaxy", "Nebula", "Cluster", "Constellation"], correctAnswer: "Constellation", category: "science" },
    { question: "Which gland in the body regulates metabolism?", allAnswers: ["Pituitary", "Adrenal", "Pineal", "Thyroid"], correctAnswer: "Thyroid", category: "science" },
    { question: "What is the name for the study of heredity?", allAnswers: ["Microbiology", "Ecology", "Anatomy", "Genetics"], correctAnswer: "Genetics", category: "science" },
    { question: "Which planet has the shortest day?", allAnswers: ["Saturn", "Uranus", "Mars", "Jupiter"], correctAnswer: "Jupiter", category: "science" },
    { question: "What is the chemical formula for ammonia?", allAnswers: ["NO3", "H2S", "CH4", "NH3"], correctAnswer: "NH3", category: "science" },
    { question: "Which vitamin is essential for blood clotting?", allAnswers: ["Vitamin A", "Vitamin C", "Vitamin D", "Vitamin K"], correctAnswer: "Vitamin K", category: "science" },
    { question: "What is the outermost layer of the Sun called?", allAnswers: ["Chromosphere", "Photosphere", "Convection zone", "Corona"], correctAnswer: "Corona", category: "science" },
    { question: "What is the name of the process by which cells divide?", allAnswers: ["Meiosis", "Osmosis", "Respiration", "Mitosis"], correctAnswer: "Mitosis", category: "science" },
    { question: "What is the name for an atom that has gained or lost electrons?", allAnswers: ["Isotope", "Molecule", "Neutron", "Ion"], correctAnswer: "Ion", category: "science" },
    { question: "Which part of the eye controls the amount of light entering?", allAnswers: ["Cornea", "Retina", "Pupil", "Iris"], correctAnswer: "Iris", category: "science" },
    { question: "How far is the Earth from the Sun (approximately)?", allAnswers: ["50 million km", "100 million km", "150 million km", "200 million km"], correctAnswer: "150 million km", category: "science" },
    { question: "Which organ produces red blood cells in adults?", allAnswers: ["Liver", "Spleen", "Kidney", "Bone marrow"], correctAnswer: "Bone marrow", category: "science" },
    { question: "What is the name of the first layer of the atmosphere?", allAnswers: ["Stratosphere", "Mesosphere", "Thermosphere", "Troposphere"], correctAnswer: "Troposphere", category: "science" },
    { question: "Which planet has a day longer than its year?", allAnswers: ["Mercury", "Mars", "Jupiter", "Venus"], correctAnswer: "Venus", category: "science" },
    { question: "Which vitamin deficiency causes scurvy?", allAnswers: ["Vitamin A", "Vitamin B12", "Vitamin D", "Vitamin C"], correctAnswer: "Vitamin C", category: "science" },
    { question: "What is the chemical symbol for mercury?", allAnswers: ["Me", "Mr", "Hm", "Hg"], correctAnswer: "Hg", category: "science" },
    { question: "Which type of electromagnetic radiation has the longest wavelength?", allAnswers: ["X-rays", "Ultraviolet", "Visible light", "Radio waves"], correctAnswer: "Radio waves", category: "science" },
    { question: "Which element is used in nuclear reactors as fuel?", allAnswers: ["Plutonium", "Thorium", "Radium", "Uranium"], correctAnswer: "Uranium", category: "science" },
    { question: "What is the chemical formula for methane?", allAnswers: ["C2H6", "C3H8", "CO2", "CH4"], correctAnswer: "CH4", category: "science" },
    { question: "Which part of the cell contains the genetic material?", allAnswers: ["Mitochondria", "Ribosome", "Cell membrane", "Nucleus"], correctAnswer: "Nucleus", category: "science" },
    { question: "What is the name for animals that eat both plants and meat?", allAnswers: ["Carnivores", "Herbivores", "Decomposers", "Omnivores"], correctAnswer: "Omnivores", category: "science" },
    { question: "Which gas causes acid rain?", allAnswers: ["Carbon Dioxide", "Nitrogen", "Ozone", "Sulfur Dioxide"], correctAnswer: "Sulfur Dioxide", category: "science" },
    { question: "How many colors are in a rainbow?", allAnswers: ["5", "6", "7", "8"], correctAnswer: "7", category: "science" },
    { question: "What is the chemical symbol for zinc?", allAnswers: ["Zi", "Zn", "Ze", "Za"], correctAnswer: "Zn", category: "science" },
    { question: "Which type of blood cell fights infections?", allAnswers: ["Platelets", "Red blood cells", "Plasma cells", "White blood cells"], correctAnswer: "White blood cells", category: "science" },
    { question: "Which planet is known for its Giant Red Spot?", allAnswers: ["Saturn", "Uranus", "Neptune", "Jupiter"], correctAnswer: "Jupiter", category: "science" },
    { question: "How many vertebrae are in the human spine?", allAnswers: ["26", "30", "33", "36"], correctAnswer: "33", category: "science" },
    { question: "Which is the densest planet in our solar system?", allAnswers: ["Jupiter", "Mars", "Venus", "Earth"], correctAnswer: "Earth", category: "science" },
    { question: "Which element is denoted by the symbol 'Ne'?", allAnswers: ["Nickel", "Nitrogen", "Neptunium", "Neon"], correctAnswer: "Neon", category: "science" },
    { question: "What is the name for the phase change from gas to liquid?", allAnswers: ["Freezing", "Melting", "Evaporation", "Condensation"], correctAnswer: "Condensation", category: "science" },
    { question: "Which gland produces adrenaline?", allAnswers: ["Thyroid", "Pituitary", "Pineal", "Adrenal gland"], correctAnswer: "Adrenal gland", category: "science" },
    { question: "Which element is a gas at room temperature?", allAnswers: ["Iron", "Mercury", "Bromine", "Nitrogen"], correctAnswer: "Nitrogen", category: "science" },
    { question: "How many moons does Mars have?", allAnswers: ["0", "1", "2", "4"], correctAnswer: "2", category: "science" },
    { question: "What is the chemical symbol for tin?", allAnswers: ["Ti", "Tn", "Sn", "Si"], correctAnswer: "Sn", category: "science" },
    { question: "Which process converts glucose into energy in cells?", allAnswers: ["Photosynthesis", "Fermentation", "Transpiration", "Cellular respiration"], correctAnswer: "Cellular respiration", category: "science" },
    { question: "Which planet has the highest surface temperature?", allAnswers: ["Mercury", "Mars", "Jupiter", "Venus"], correctAnswer: "Venus", category: "science" },
    { question: "What is the name for a material that cannot conduct electricity?", allAnswers: ["Conductor", "Semiconductor", "Resistor", "Insulator"], correctAnswer: "Insulator", category: "science" },
    { question: "What is the chemical formula for hydrogen peroxide?", allAnswers: ["H2O", "HO2", "H3O2", "H2O2"], correctAnswer: "H2O2", category: "science" },
    { question: "Which part of a flower produces pollen?", allAnswers: ["Pistil", "Petal", "Sepal", "Stamen"], correctAnswer: "Stamen", category: "science" },
    { question: "Which element has the highest melting point?", allAnswers: ["Platinum", "Iron", "Osmium", "Tungsten"], correctAnswer: "Tungsten", category: "science" },
    { question: "What is Newton's first law of motion about?", allAnswers: ["Acceleration", "Action-Reaction", "Momentum", "Inertia"], correctAnswer: "Inertia", category: "science" },
    { question: "Which gas turns limewater milky?", allAnswers: ["Oxygen", "Nitrogen", "Hydrogen", "Carbon Dioxide"], correctAnswer: "Carbon Dioxide", category: "science" },
    { question: "What is the name for a baby kangaroo?", allAnswers: ["Cub", "Foal", "Kitten", "Joey"], correctAnswer: "Joey", category: "science" },
    { question: "Which element is the basis of organic chemistry?", allAnswers: ["Nitrogen", "Oxygen", "Silicon", "Carbon"], correctAnswer: "Carbon", category: "science" },
    { question: "What is the chemical symbol for calcium?", allAnswers: ["Cm", "Cl", "Cs", "Ca"], correctAnswer: "Ca", category: "science" },
    { question: "What is the name for a substance that speeds up a chemical reaction without being consumed?", allAnswers: ["Solvent", "Reactant", "Inhibitor", "Catalyst"], correctAnswer: "Catalyst", category: "science" },
    { question: "Which planet is furthest from the Sun?", allAnswers: ["Saturn", "Uranus", "Jupiter", "Neptune"], correctAnswer: "Neptune", category: "science" },
    { question: "How many bones are in the human ear?", allAnswers: ["1", "2", "3", "4"], correctAnswer: "3", category: "science" },
    { question: "What is the chemical formula for hydrochloric acid?", allAnswers: ["H2SO4", "HNO3", "H3PO4", "HCl"], correctAnswer: "HCl", category: "science" },
    { question: "Which type of rock is formed by heat and pressure?", allAnswers: ["Sedimentary", "Igneous", "Volcanic", "Metamorphic"], correctAnswer: "Metamorphic", category: "science" },
    { question: "What is the name for an animal that only eats plants?", allAnswers: ["Omnivore", "Carnivore", "Scavenger", "Herbivore"], correctAnswer: "Herbivore", category: "science" },
    { question: "What is the name for the distance light travels in one year?", allAnswers: ["Parsec", "Astronomical unit", "Megaparsec", "Light-year"], correctAnswer: "Light-year", category: "science" },
    { question: "How many atoms are in a molecule of water?", allAnswers: ["1", "2", "3", "4"], correctAnswer: "3", category: "science" },
    { question: "What is the study of the classification of living things called?", allAnswers: ["Morphology", "Physiology", "Ecology", "Taxonomy"], correctAnswer: "Taxonomy", category: "science" },
    { question: "How long does it take the Earth to orbit the Sun?", allAnswers: ["300 days", "330 days", "365 days", "400 days"], correctAnswer: "365 days", category: "science" },
    { question: "What is the chemical formula for sulfuric acid?", allAnswers: ["H2SO3", "HNO3", "HCl", "H2SO4"], correctAnswer: "H2SO4", category: "science" },
    { question: "Which planet is described as an ice giant?", allAnswers: ["Saturn", "Jupiter", "Mars", "Uranus"], correctAnswer: "Uranus", category: "science" },
    { question: "What is the name for an organism that makes its own food?", allAnswers: ["Decomposer", "Consumer", "Heterotroph", "Autotroph"], correctAnswer: "Autotroph", category: "science" },
    { question: "Which scientist discovered penicillin?", allAnswers: ["Louis Pasteur", "Marie Curie", "Joseph Lister", "Alexander Fleming"], correctAnswer: "Alexander Fleming", category: "science" },
    { question: "Which layer of the atmosphere contains the ozone layer?", allAnswers: ["Troposphere", "Mesosphere", "Thermosphere", "Stratosphere"], correctAnswer: "Stratosphere", category: "science" },
    { question: "What is the study of plants called?", allAnswers: ["Zoology", "Mycology", "Geology", "Botany"], correctAnswer: "Botany", category: "science" },
    { question: "Which element is used in thermometers?", allAnswers: ["Bromine", "Gallium", "Caesium", "Mercury"], correctAnswer: "Mercury", category: "science" },
    { question: "What is the largest cell in the human body?", allAnswers: ["Neuron", "Red blood cell", "Muscle cell", "Female egg cell"], correctAnswer: "Female egg cell", category: "science" },
    { question: "How many bones does an adult shark have?", allAnswers: ["100", "50", "12", "0"], correctAnswer: "0", category: "science" },
    { question: "What is the chemical formula for ethanol?", allAnswers: ["C3H7OH", "CH3OH", "C4H9OH", "C2H5OH"], correctAnswer: "C2H5OH", category: "science" },
    { question: "Which planet takes the longest to orbit the Sun?", allAnswers: ["Saturn", "Uranus", "Jupiter", "Neptune"], correctAnswer: "Neptune", category: "science" },
    { question: "What is the name for a positively charged subatomic particle?", allAnswers: ["Electron", "Neutron", "Quark", "Proton"], correctAnswer: "Proton", category: "science" },
    { question: "Which organ in the human body produces bile?", allAnswers: ["Pancreas", "Spleen", "Kidney", "Liver"], correctAnswer: "Liver", category: "science" },
    { question: "What is the chemical symbol for uranium?", allAnswers: ["Ur", "Un", "Um", "U"], correctAnswer: "U", category: "science" },
    { question: "How many pairs of chromosomes do humans have?", allAnswers: ["21", "22", "23", "24"], correctAnswer: "23", category: "science" },
    { question: "What is the name for a material that conducts electricity?", allAnswers: ["Insulator", "Resistor", "Dielectric", "Conductor"], correctAnswer: "Conductor", category: "science" },
    { question: "What is the study of the ocean called?", allAnswers: ["Hydrology", "Limnology", "Marine biology", "Oceanography"], correctAnswer: "Oceanography", category: "science" },
    { question: "Which element has the symbol 'Si'?", allAnswers: ["Silver", "Sulfur", "Sodium", "Silicon"], correctAnswer: "Silicon", category: "science" },
    { question: "What is the name for the bending of light as it passes through a medium?", allAnswers: ["Reflection", "Diffraction", "Dispersion", "Refraction"], category: "science", correctAnswer: "Refraction" },
    { question: "How many legs does a spider have?", allAnswers: ["6", "8", "10", "12"], correctAnswer: "8", category: "science" },
    { question: "What is the chemical symbol for barium?", allAnswers: ["Bi", "Be", "B", "Ba"], correctAnswer: "Ba", category: "science" },
    { question: "What is the name for a group of lions?", allAnswers: ["Pack", "Herd", "Flock", "Pride"], correctAnswer: "Pride", category: "science" },
    { question: "Which element is commonly used in computer chips?", allAnswers: ["Carbon", "Germanium", "Gallium", "Silicon"], correctAnswer: "Silicon", category: "science" },
    { question: "What type of star is our Sun?", allAnswers: ["Red dwarf", "White dwarf", "Neutron star", "Yellow dwarf"], correctAnswer: "Yellow dwarf", category: "science" },
    { question: "How many eyes does a bee have?", allAnswers: ["2", "3", "4", "5"], correctAnswer: "5", category: "science" },
    { question: "What is the name for an animal that is active at night?", allAnswers: ["Diurnal", "Crepuscular", "Seasonal", "Nocturnal"], correctAnswer: "Nocturnal", category: "science" },
    { question: "Which planet orbits the Sun in the shortest time?", allAnswers: ["Venus", "Earth", "Mars", "Mercury"], correctAnswer: "Mercury", category: "science" },
    { question: "What is the chemical symbol for magnesium?", allAnswers: ["Mn", "Mo", "Ma", "Mg"], correctAnswer: "Mg", category: "science" },
    { question: "What is a half of the Earth called?", allAnswers: ["Quadrant", "Meridian", "Equinox", "Hemisphere"], correctAnswer: "Hemisphere", category: "science" },
    { question: "What is the name for type of rock formed from cooled lava?", allAnswers: ["Sedimentary", "Metamorphic", "Sandstone", "Igneous"], correctAnswer: "Igneous", category: "science" },
    { question: "How many legs does an insect have?", allAnswers: ["4", "6", "8", "10"], correctAnswer: "6", category: "science" },
    { question: "What is the process by which a liquid turns into a gas?", allAnswers: ["Condensation", "Freezing", "Sublimation", "Evaporation"], correctAnswer: "Evaporation", category: "science" },
    { question: "Which gas is released by plants during photosynthesis?", allAnswers: ["Carbon Dioxide", "Nitrogen", "Hydrogen", "Oxygen"], correctAnswer: "Oxygen", category: "science" },
    { question: "What is the atomic number of carbon?", allAnswers: ["4", "5", "6", "7"], correctAnswer: "6", category: "science" },
    { question: "Which organ filters waste from the blood?", allAnswers: ["Liver", "Spleen", "Pancreas", "Kidney"], correctAnswer: "Kidney", category: "science" },
    { question: "What is the unit of electric current?", allAnswers: ["Volt", "Watt", "Ohm", "Ampere"], correctAnswer: "Ampere", category: "science" },
    { question: "What is the chemical formula for glucose?", allAnswers: ["C5H10O5", "C6H12O5", "C12H22O11", "C6H12O6"], correctAnswer: "C6H12O6", category: "science" },
    { question: "How many chambers does a fish heart have?", allAnswers: ["1", "2", "3", "4"], correctAnswer: "2", category: "science" },
    { question: "What is the name of Newton's first law about?", allAnswers: ["Force equals mass times acceleration", "Objects in motion stay in motion", "Every action has an equal reaction", "Energy cannot be created or destroyed"], correctAnswer: "Objects in motion stay in motion", category: "science" },
    { question: "Which chemical element has the symbol 'Au'?", allAnswers: ["Silver", "Platinum", "Copper", "Gold"], correctAnswer: "Gold", category: "science" },
    { question: "What is the name for a negatively charged subatomic particle?", allAnswers: ["Proton", "Neutron", "Quark", "Electron"], correctAnswer: "Electron", category: "science" },
    { question: "Which planet is known for having rings made mostly of ice?", allAnswers: ["Jupiter", "Uranus", "Neptune", "Saturn"], correctAnswer: "Saturn", category: "science" },
    { question: "What is the chemical symbol for chlorine?", allAnswers: ["Ch", "Cr", "Co", "Cl"], correctAnswer: "Cl", category: "science" },
    { question: "Which part of the plant absorbs water and nutrients from the soil?", allAnswers: ["Stem", "Leaf", "Flower", "Root"], correctAnswer: "Root", category: "science" },
    { question: "What is the name for the study of the Earth's physical structure?", allAnswers: ["Meteorology", "Astronomy", "Ecology", "Geology"], correctAnswer: "Geology", category: "science" },
    { question: "How many bones are in a human hand?", allAnswers: ["19", "23", "27", "31"], correctAnswer: "27", category: "science" },
    { question: "What is the chemical formula for ozone?", allAnswers: ["O", "O2", "O3", "O4"], correctAnswer: "O3", category: "science" },
    { question: "Which is the fastest land animal?", allAnswers: ["Lion", "Springbok", "Greyhound", "Cheetah"], correctAnswer: "Cheetah", category: "science" },
    { question: "What is the name for the transfer of heat through direct contact?", allAnswers: ["Radiation", "Convection", "Reflection", "Conduction"], correctAnswer: "Conduction", category: "science" },
    { question: "What is the chemical symbol for phosphorus?", allAnswers: ["Ph", "Ps", "Pu", "P"], correctAnswer: "P", category: "science" },
    { question: "How many hearts does an octopus have?", allAnswers: ["1", "2", "3", "4"], correctAnswer: "3", category: "science" },
    { question: "What is the name for the center of an atom?", allAnswers: ["Electron shell", "Orbital", "Quark", "Nucleus"], correctAnswer: "Nucleus", category: "science" },
    { question: "Which planet has the most extreme axial tilt?", allAnswers: ["Saturn", "Neptune", "Jupiter", "Uranus"], correctAnswer: "Uranus", category: "science" },
    { question: "What is the name for a group of fish swimming together?", allAnswers: ["Pod", "Flock", "Herd", "School"], correctAnswer: "School", category: "science" },
    { question: "How many seconds are in one hour?", allAnswers: ["1,800", "3,000", "3,600", "4,200"], correctAnswer: "3,600", category: "science" },
    { question: "What is the chemical symbol for helium?", allAnswers: ["Hl", "Hm", "H", "He"], correctAnswer: "He", category: "science" },
    { question: "How many chambers does a reptile's heart typically have?", allAnswers: ["2", "3", "4", "5"], correctAnswer: "3", category: "science" },
    { question: "Which element has the symbol 'Kr'?", allAnswers: ["Krypton", "Krytanium", "Kerbium", "Kalmium"], correctAnswer: "Krypton", category: "science" },
    { question: "What process do plants use to release water vapor?", allAnswers: ["Photosynthesis", "Respiration", "Osmosis", "Transpiration"], correctAnswer: "Transpiration", category: "science" },
    { question: "Which bone protects the heart and lungs?", allAnswers: ["Skull", "Pelvis", "Spine", "Ribcage"], correctAnswer: "Ribcage", category: "science" },
    { question: "What is the chemical symbol for fluorine?", allAnswers: ["Fl", "Fu", "Fn", "F"], correctAnswer: "F", category: "science" },
    { question: "Which layer of the Earth is made of liquid iron and nickel?", allAnswers: ["Crust", "Upper mantle", "Lower mantle", "Outer core"], correctAnswer: "Outer core", category: "science" },
    { question: "What is the approximate surface temperature of the Sun?", allAnswers: ["3,000°C", "5,500°C", "10,000°C", "50,000°C"], correctAnswer: "5,500°C", category: "science" },
    { question: "Which animal has the longest lifespan?", allAnswers: ["Galapagos tortoise", "Greenland shark", "Ocean quahog clam", "Bowhead whale"], correctAnswer: "Greenland shark", category: "science" },
    { question: "What is the name for the thin layer around the Earth that supports life?", allAnswers: ["Atmosphere", "Lithosphere", "Hydrosphere", "Biosphere"], correctAnswer: "Biosphere", category: "science" },
    { question: "Which element is used to make matches?", allAnswers: ["Sulfur", "Carbon", "Sodium", "Phosphorus"], correctAnswer: "Phosphorus", category: "science" }
  ],
  history: [
    { question: "What year did World War II end?", allAnswers: ["1943", "1944", "1945", "1946"], correctAnswer: "1945", category: "history" },
    { question: "Who was the first President of the United States?", allAnswers: ["Thomas Jefferson", "John Adams", "George Washington", "Benjamin Franklin"], correctAnswer: "George Washington", category: "history" },
    { question: "In which year did the Berlin Wall fall?", allAnswers: ["1987", "1988", "1989", "1990"], correctAnswer: "1989", category: "history" },
    { question: "Which ancient civilization built the pyramids?", allAnswers: ["Greeks", "Romans", "Egyptians", "Mayans"], correctAnswer: "Egyptians", category: "history" },
    { question: "What year did the Titanic sink?", allAnswers: ["1910", "1911", "1912", "1913"], correctAnswer: "1912", category: "history" },
    { question: "Who painted the Mona Lisa?", allAnswers: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Michelangelo"], correctAnswer: "Leonardo da Vinci", category: "history" },
    { question: "In which year did the American Civil War end?", allAnswers: ["1863", "1864", "1865", "1866"], correctAnswer: "1865", category: "history" },
    { question: "Who was known as the Iron Lady?", allAnswers: ["Angela Merkel", "Margaret Thatcher", "Indira Gandhi", "Golda Meir"], correctAnswer: "Margaret Thatcher", category: "history" },
    { question: "What year did the first moon landing occur?", allAnswers: ["1967", "1968", "1969", "1970"], correctAnswer: "1969", category: "history" },
    { question: "Which empire was ruled by Julius Caesar?", allAnswers: ["Greek", "Roman", "Byzantine", "Ottoman"], correctAnswer: "Roman", category: "history" },
    { question: "What year did the French Revolution begin?", allAnswers: ["1787", "1788", "1789", "1790"], correctAnswer: "1789", category: "history" },
    { question: "Who wrote the Declaration of Independence?", allAnswers: ["George Washington", "Benjamin Franklin", "Thomas Jefferson", "John Adams"], correctAnswer: "Thomas Jefferson", category: "history" },
    { question: "In which year did World War I begin?", allAnswers: ["1912", "1913", "1914", "1915"], correctAnswer: "1914", category: "history" },
    { question: "Which pharaoh's tomb was discovered in 1922?", allAnswers: ["Cleopatra", "Ramesses II", "Tutankhamun", "Nefertiti"], correctAnswer: "Tutankhamun", category: "history" },
    { question: "What year did the Cold War end?", allAnswers: ["1989", "1990", "1991", "1992"], correctAnswer: "1991", category: "history" },
    { question: "Who was the first man to walk on the Moon?", allAnswers: ["Buzz Aldrin", "Yuri Gagarin", "Neil Armstrong", "Alan Shepard"], correctAnswer: "Neil Armstrong", category: "history" },
    { question: "Which ancient wonder was located in Alexandria?", allAnswers: ["Hanging Gardens", "Colossus of Rhodes", "Lighthouse", "Statue of Zeus"], correctAnswer: "Lighthouse", category: "history" },
    { question: "In what year did the Western Roman Empire fall?", allAnswers: ["376", "410", "455", "476"], correctAnswer: "476", category: "history" },
    { question: "Who was the first woman to win a Nobel Prize?", allAnswers: ["Rosalind Franklin", "Marie Curie", "Florence Nightingale", "Ada Lovelace"], correctAnswer: "Marie Curie", category: "history" },
    { question: "Which country was the first to give women the right to vote?", allAnswers: ["United Kingdom", "United States", "New Zealand", "Australia"], correctAnswer: "New Zealand", category: "history" },
    { question: "When did construction on the Great Wall of China begin?", allAnswers: ["221 BC", "400 BC", "100 AD", "600 AD"], correctAnswer: "221 BC", category: "history" },
    { question: "Who was the last Tsar of Russia?", allAnswers: ["Alexander III", "Nicholas I", "Alexander II", "Nicholas II"], correctAnswer: "Nicholas II", category: "history" },
    { question: "In which city was Martin Luther King Jr. assassinated?", allAnswers: ["Atlanta", "Birmingham", "Memphis", "Washington D.C."], correctAnswer: "Memphis", category: "history" },
    { question: "Which ship was sunk by a German U-boat in 1915?", allAnswers: ["Titanic", "Olympic", "Lusitania", "Britannic"], correctAnswer: "Lusitania", category: "history" },
    { question: "What was the name of the first artificial satellite launched into space?", allAnswers: ["Vostok", "Sputnik", "Explorer", "Luna"], correctAnswer: "Sputnik", category: "history" },
    { question: "Who was the Egyptian queen who allied with Julius Caesar?", allAnswers: ["Nefertiti", "Hatshepsut", "Cleopatra", "Isis"], correctAnswer: "Cleopatra", category: "history" },
    { question: "In what year did the United States enter World War II?", allAnswers: ["1939", "1940", "1941", "1942"], correctAnswer: "1941", category: "history" },
    { question: "Which battle ended Napoleon's rule?", allAnswers: ["Battle of Trafalgar", "Battle of Austerlitz", "Battle of Waterloo", "Battle of Borodino"], correctAnswer: "Battle of Waterloo", category: "history" },
    { question: "Who invented the telephone?", allAnswers: ["Thomas Edison", "Nikola Tesla", "Alexander Graham Bell", "Guglielmo Marconi"], correctAnswer: "Alexander Graham Bell", category: "history" },
    { question: "What event triggered the start of World War I?", allAnswers: ["Sinking of the Lusitania", "Invasion of Poland", "Assassination of Archduke Franz Ferdinand", "The Russian Revolution"], correctAnswer: "Assassination of Archduke Franz Ferdinand", category: "history" },
    { question: "In which year did India gain independence from Britain?", allAnswers: ["1945", "1946", "1947", "1948"], correctAnswer: "1947", category: "history" },
    { question: "Who was the longest-reigning British monarch?", allAnswers: ["Victoria", "George III", "Elizabeth II", "Henry VIII"], correctAnswer: "Elizabeth II", category: "history" },
    { question: "Which explorer is credited with discovering America in 1492?", allAnswers: ["Vasco da Gama", "Ferdinand Magellan", "Amerigo Vespucci", "Christopher Columbus"], correctAnswer: "Christopher Columbus", category: "history" },
    { question: "In what year was the Magna Carta signed?", allAnswers: ["1115", "1215", "1315", "1415"], correctAnswer: "1215", category: "history" },
    { question: "Which U.S. president issued the Emancipation Proclamation?", allAnswers: ["Ulysses S. Grant", "James Buchanan", "Abraham Lincoln", "Andrew Johnson"], correctAnswer: "Abraham Lincoln", category: "history" },
    { question: "In what year did the Soviet Union dissolve?", allAnswers: ["1989", "1990", "1991", "1992"], correctAnswer: "1991", category: "history" },
    { question: "Who was the first female Prime Minister of the United Kingdom?", allAnswers: ["Theresa May", "Margaret Thatcher", "Angela Merkel", "Liz Truss"], correctAnswer: "Margaret Thatcher", category: "history" },
    { question: "Which country did Adolf Hitler originally come from?", allAnswers: ["Germany", "Switzerland", "Austria", "Poland"], correctAnswer: "Austria", category: "history" },
    { question: "Who was the first person to circumnavigate the globe?", allAnswers: ["Christopher Columbus", "Vasco da Gama", "Ferdinand Magellan", "Francis Drake"], correctAnswer: "Ferdinand Magellan", category: "history" },
    { question: "In which year did the American Revolution begin?", allAnswers: ["1773", "1774", "1775", "1776"], correctAnswer: "1775", category: "history" },
    { question: "Who was the first Roman Emperor?", allAnswers: ["Julius Caesar", "Mark Antony", "Nero", "Augustus"], correctAnswer: "Augustus", category: "history" },
    { question: "What year was the United Nations founded?", allAnswers: ["1942", "1943", "1944", "1945"], correctAnswer: "1945", category: "history" },
    { question: "Which ancient city was home to the Hanging Gardens?", allAnswers: ["Nineveh", "Ur", "Babylon", "Persepolis"], correctAnswer: "Babylon", category: "history" },
    { question: "Who was the first man to fly in space?", allAnswers: ["Neil Armstrong", "Alan Shepard", "John Glenn", "Yuri Gagarin"], correctAnswer: "Yuri Gagarin", category: "history" },
    { question: "Which empire was ruled by Genghis Khan?", allAnswers: ["Ottoman", "Persian", "Mongol", "Chinese"], correctAnswer: "Mongol", category: "history" },
    { question: "In which year did World War II begin?", allAnswers: ["1937", "1938", "1939", "1940"], correctAnswer: "1939", category: "history" },
    { question: "Who was the first U.S. president to be assassinated?", allAnswers: ["Andrew Jackson", "Abraham Lincoln", "James Garfield", "William McKinley"], correctAnswer: "Abraham Lincoln", category: "history" },
    { question: "What year was the Eiffel Tower completed?", allAnswers: ["1885", "1887", "1889", "1891"], correctAnswer: "1889", category: "history" },
    { question: "Which civilization invented writing (cuneiform)?", allAnswers: ["Egyptians", "Chinese", "Indus Valley", "Sumerians"], correctAnswer: "Sumerians", category: "history" },
    { question: "Who was the British monarch during World War II?", allAnswers: ["George V", "George VI", "Edward VIII", "Elizabeth II"], correctAnswer: "George VI", category: "history" },
    { question: "What year did the Boston Tea Party occur?", allAnswers: ["1770", "1771", "1772", "1773"], correctAnswer: "1773", category: "history" },
    { question: "Which empire built the Colosseum in Rome?", allAnswers: ["Greek", "Byzantine", "Ottoman", "Roman"], correctAnswer: "Roman", category: "history" },
    { question: "In which year did the Russian Revolution occur?", allAnswers: ["1914", "1915", "1916", "1917"], correctAnswer: "1917", category: "history" },
    { question: "Who wrote the Communist Manifesto?", allAnswers: ["Vladimir Lenin", "Joseph Stalin", "Friedrich Engels and Karl Marx", "Leon Trotsky"], correctAnswer: "Friedrich Engels and Karl Marx", category: "history" },
    { question: "Which war was fought between the North and South of the United States?", allAnswers: ["War of 1812", "Mexican-American War", "Spanish-American War", "Civil War"], correctAnswer: "Civil War", category: "history" },
    { question: "Who was the first President of France's Fifth Republic?", allAnswers: ["Georges Pompidou", "François Mitterrand", "Charles de Gaulle", "Valéry Giscard d'Estaing"], correctAnswer: "Charles de Gaulle", category: "history" },
    { question: "In which year was the atomic bomb dropped on Hiroshima?", allAnswers: ["1943", "1944", "1945", "1946"], correctAnswer: "1945", category: "history" },
    { question: "What ancient wonder stood in the harbor of Rhodes?", allAnswers: ["Lighthouse of Alexandria", "Statue of Zeus", "Colossus of Rhodes", "Temple of Artemis"], correctAnswer: "Colossus of Rhodes", category: "history" },
    { question: "Who commanded the Allied forces in Europe during World War II?", allAnswers: ["George Patton", "Omar Bradley", "Douglas MacArthur", "Dwight D. Eisenhower"], correctAnswer: "Dwight D. Eisenhower", category: "history" },
    { question: "Which ancient Greek philosopher taught Alexander the Great?", allAnswers: ["Plato", "Socrates", "Aristotle", "Pythagoras"], correctAnswer: "Aristotle", category: "history" },
    { question: "What year did Nelson Mandela become president of South Africa?", allAnswers: ["1990", "1992", "1994", "1996"], correctAnswer: "1994", category: "history" },
    { question: "Who was the leader of Nazi Germany?", allAnswers: ["Heinrich Himmler", "Hermann Göring", "Joseph Goebbels", "Adolf Hitler"], correctAnswer: "Adolf Hitler", category: "history" },
    { question: "In which year did the Black Death reach Europe?", allAnswers: ["1245", "1297", "1347", "1381"], correctAnswer: "1347", category: "history" },
    { question: "Who was the first emperor of China?", allAnswers: ["Han Wudi", "Tang Taizong", "Qin Shi Huang", "Kublai Khan"], correctAnswer: "Qin Shi Huang", category: "history" },
    { question: "What year was the Declaration of Independence signed?", allAnswers: ["1774", "1775", "1776", "1777"], correctAnswer: "1776", category: "history" },
    { question: "Which country did Napoleon invade in 1812 with disastrous results?", allAnswers: ["Austria", "Prussia", "Spain", "Russia"], correctAnswer: "Russia", category: "history" },
    { question: "What was the name of the ship Charles Darwin sailed on?", allAnswers: ["HMS Victory", "HMS Endeavour", "HMS Beagle", "HMS Bounty"], correctAnswer: "HMS Beagle", category: "history" },
    { question: "In which year did the Korean War end?", allAnswers: ["1950", "1951", "1952", "1953"], correctAnswer: "1953", category: "history" },
    { question: "Who built the first successful steam engine?", allAnswers: ["James Watt", "George Stephenson", "Thomas Newcomen", "Richard Trevithick"], correctAnswer: "James Watt", category: "history" },
    { question: "Which European country colonized most of Latin America?", allAnswers: ["Portugal and France", "England and France", "Spain and Portugal", "Spain and England"], correctAnswer: "Spain and Portugal", category: "history" },
    { question: "In what year did the Vietnam War end?", allAnswers: ["1971", "1973", "1975", "1977"], correctAnswer: "1975", category: "history" },
    { question: "Who was the last emperor of the Aztec Empire?", allAnswers: ["Moctezuma I", "Itzcoatl", "Tlacaelel", "Cuauhtémoc"], correctAnswer: "Cuauhtémoc", category: "history" },
    { question: "What year did the first iPhone launch?", allAnswers: ["2005", "2006", "2007", "2008"], correctAnswer: "2007", category: "history" },
    { question: "Which country launched the first space station, Salyut 1?", allAnswers: ["United States", "China", "Soviet Union", "Germany"], correctAnswer: "Soviet Union", category: "history" },
    { question: "Who was the first Chancellor of Germany?", allAnswers: ["Konrad Adenauer", "Helmut Kohl", "Otto von Bismarck", "Willy Brandt"], correctAnswer: "Otto von Bismarck", category: "history" },
    { question: "In which year did South Africa abolish apartheid?", allAnswers: ["1988", "1990", "1992", "1994"], correctAnswer: "1990", category: "history" },
    { question: "What was the name of the first nuclear reactor?", allAnswers: ["Trinity", "Manhattan", "Chicago Pile-1", "Fermi-1"], correctAnswer: "Chicago Pile-1", category: "history" },
    { question: "Who was the commander of Confederate forces in the U.S. Civil War?", allAnswers: ["Ulysses S. Grant", "Stonewall Jackson", "Robert E. Lee", "J.E.B. Stuart"], correctAnswer: "Robert E. Lee", category: "history" },
    { question: "Which treaty ended World War I?", allAnswers: ["Treaty of Paris", "Treaty of Versailles", "Treaty of Ghent", "Treaty of Vienna"], correctAnswer: "Treaty of Versailles", category: "history" },
    { question: "In which year was the printing press invented by Gutenberg?", allAnswers: ["1420", "1440", "1450", "1470"], correctAnswer: "1450", category: "history" },
    { question: "What was the name of the first U.S. space program to land on the Moon?", allAnswers: ["Mercury", "Gemini", "Skylab", "Apollo"], correctAnswer: "Apollo", category: "history" },
    { question: "Who was Britain's Prime Minister at the start of World War II?", allAnswers: ["Anthony Eden", "Clement Attlee", "Winston Churchill", "Neville Chamberlain"], correctAnswer: "Neville Chamberlain", category: "history" },
    { question: "In which year was the Great Fire of London?", allAnswers: ["1606", "1626", "1646", "1666"], correctAnswer: "1666", category: "history" },
    { question: "Which ancient Greek city-state was known for its military prowess?", allAnswers: ["Athens", "Corinth", "Thebes", "Sparta"], correctAnswer: "Sparta", category: "history" },
    { question: "Who was the first President of South Africa after apartheid?", allAnswers: ["Desmond Tutu", "Oliver Tambo", "Walter Sisulu", "Nelson Mandela"], correctAnswer: "Nelson Mandela", category: "history" },
    { question: "In which year was the Berlin Wall built?", allAnswers: ["1958", "1959", "1960", "1961"], correctAnswer: "1961", category: "history" },
    { question: "Who invented the light bulb?", allAnswers: ["Nikola Tesla", "Alexander Graham Bell", "Benjamin Franklin", "Thomas Edison"], correctAnswer: "Thomas Edison", category: "history" },
    { question: "Which Chinese dynasty built most of the Great Wall?", allAnswers: ["Han Dynasty", "Tang Dynasty", "Ming Dynasty", "Qing Dynasty"], correctAnswer: "Ming Dynasty", category: "history" },
    { question: "In which year did D-Day (the Normandy landings) take place?", allAnswers: ["1942", "1943", "1944", "1945"], correctAnswer: "1944", category: "history" },
    { question: "Who led the Cuban Revolution?", allAnswers: ["Che Guevara", "Fulgencio Batista", "Raúl Castro", "Fidel Castro"], correctAnswer: "Fidel Castro", category: "history" },
    { question: "What year was the World Wide Web invented?", allAnswers: ["1985", "1987", "1989", "1991"], correctAnswer: "1989", category: "history" },
    { question: "Which president signed the Civil Rights Act of 1964?", allAnswers: ["John F. Kennedy", "Robert F. Kennedy", "Lyndon B. Johnson", "Hubert Humphrey"], correctAnswer: "Lyndon B. Johnson", category: "history" },
    { question: "In which year did the Spanish Armada attempt to invade England?", allAnswers: ["1582", "1585", "1588", "1591"], correctAnswer: "1588", category: "history" },
    { question: "Who was the Roman general who crossed the Rubicon?", allAnswers: ["Pompey", "Mark Antony", "Augustus", "Julius Caesar"], correctAnswer: "Julius Caesar", category: "history" },
    { question: "What year was the Suez Canal opened?", allAnswers: ["1859", "1864", "1869", "1874"], correctAnswer: "1869", category: "history" },
    { question: "Which treaty ended the American Revolution?", allAnswers: ["Treaty of Versailles", "Treaty of Ghent", "Treaty of Paris", "Treaty of London"], correctAnswer: "Treaty of Paris", category: "history" },
    { question: "Who was the U.S. president during the Cuban Missile Crisis?", allAnswers: ["Dwight D. Eisenhower", "Lyndon B. Johnson", "Richard Nixon", "John F. Kennedy"], correctAnswer: "John F. Kennedy", category: "history" },
    { question: "In which year was Rome founded (traditionally)?", allAnswers: ["553 BC", "653 BC", "753 BC", "853 BC"], correctAnswer: "753 BC", category: "history" },
    { question: "Who was the first leader of the Soviet Union?", allAnswers: ["Joseph Stalin", "Leon Trotsky", "Vladimir Lenin", "Nikita Khrushchev"], correctAnswer: "Vladimir Lenin", category: "history" },
    { question: "What year did apartheid officially end in South Africa?", allAnswers: ["1990", "1992", "1994", "1996"], correctAnswer: "1994", category: "history" },
    { question: "Which country was the first to use paper money?", allAnswers: ["India", "Egypt", "Rome", "China"], correctAnswer: "China", category: "history" },
    { question: "Who was the first person to reach the South Pole?", allAnswers: ["Ernest Shackleton", "Robert Falcon Scott", "Edmund Hillary", "Roald Amundsen"], correctAnswer: "Roald Amundsen", category: "history" },
    { question: "In which year did the Chernobyl nuclear disaster occur?", allAnswers: ["1984", "1985", "1986", "1987"], correctAnswer: "1986", category: "history" },
    { question: "Who was the first Prime Minister of Australia?", allAnswers: ["Alfred Deakin", "George Reid", "Edmund Barton", "John Watson"], correctAnswer: "Edmund Barton", category: "history" },
    { question: "What year did Hawaii become a U.S. state?", allAnswers: ["1955", "1957", "1959", "1961"], correctAnswer: "1959", category: "history" },
    { question: "Which ancient wonder was in Olympia, Greece?", allAnswers: ["Temple of Artemis", "Mausoleum at Halicarnassus", "Colossus of Rhodes", "Statue of Zeus"], correctAnswer: "Statue of Zeus", category: "history" },
    { question: "Who was the first female president of a country?", allAnswers: ["Golda Meir (Israel)", "Indira Gandhi (India)", "Vigdís Finnbogadóttir (Iceland)", "Margaret Thatcher (UK)"], correctAnswer: "Vigdís Finnbogadóttir (Iceland)", category: "history" },
    { question: "In which year did the Thirty Years' War begin?", allAnswers: ["1608", "1613", "1618", "1623"], correctAnswer: "1618", category: "history" },
    { question: "Who founded the Mughal Empire in India?", allAnswers: ["Akbar", "Aurangzeb", "Shah Jahan", "Babur"], correctAnswer: "Babur", category: "history" },
    { question: "What year was the Panama Canal completed?", allAnswers: ["1910", "1912", "1914", "1916"], correctAnswer: "1914", category: "history" },
    { question: "Which country won the most battles in the Crusades?", allAnswers: ["France", "England", "Neither side decisively", "The Papacy"], correctAnswer: "Neither side decisively", category: "history" },
    { question: "Who was the first person to break the sound barrier?", allAnswers: ["Neil Armstrong", "John Glenn", "Chuck Yeager", "Buzz Aldrin"], correctAnswer: "Chuck Yeager", category: "history" },
    { question: "In which year was Israel founded as a state?", allAnswers: ["1946", "1947", "1948", "1949"], correctAnswer: "1948", category: "history" },
    { question: "Which ancient structure is located on the Giza Plateau?", allAnswers: ["Parthenon", "Colosseum", "Pyramids of Giza", "Acropolis"], correctAnswer: "Pyramids of Giza", category: "history" },
    { question: "Who was the Roman Emperor during the height of the Roman Empire?", allAnswers: ["Nero", "Caligula", "Trajan", "Augustus"], correctAnswer: "Trajan", category: "history" },
    { question: "What year did the first Gulf War begin?", allAnswers: ["1988", "1989", "1990", "1991"], correctAnswer: "1990", category: "history" },
    { question: "Who was the architect of the Indian independence movement?", allAnswers: ["Jawaharlal Nehru", "Bal Gangadhar Tilak", "Subhas Chandra Bose", "Mahatma Gandhi"], correctAnswer: "Mahatma Gandhi", category: "history" },
    { question: "In which year did Prohibition begin in the United States?", allAnswers: ["1917", "1918", "1919", "1920"], correctAnswer: "1920", category: "history" },
    { question: "What was the name of the first U.S. space shuttle?", allAnswers: ["Discovery", "Challenger", "Endeavour", "Columbia"], correctAnswer: "Columbia", category: "history" },
    { question: "Which German city was divided by a wall from 1961 to 1989?", allAnswers: ["Munich", "Hamburg", "Frankfurt", "Berlin"], correctAnswer: "Berlin", category: "history" },
    { question: "Who was the last ruler of the Byzantine Empire?", allAnswers: ["John VIII Palaiologos", "Manuel II Palaiologos", "Constantine XI Palaiologos", "Andronikos IV Palaiologos"], correctAnswer: "Constantine XI Palaiologos", category: "history" },
    { question: "In which year did the March on Washington take place?", allAnswers: ["1960", "1961", "1962", "1963"], correctAnswer: "1963", category: "history" },
    { question: "What was the capital of the Aztec Empire?", allAnswers: ["Tenochtitlan", "Chichen Itza", "Tikal", "Tula"], correctAnswer: "Tenochtitlan", category: "history" },
    { question: "Who was the first man to climb Mount Everest?", allAnswers: ["Reinhold Messner", "George Mallory", "Edmund Hillary", "Tenzing Norgay"], correctAnswer: "Edmund Hillary", category: "history" },
    { question: "In which year did the first iPhone launch?", allAnswers: ["2005", "2006", "2007", "2008"], correctAnswer: "2007", category: "history" },
    { question: "Which medieval plague killed roughly a third of Europe's population?", allAnswers: ["Typhoid", "Smallpox", "Cholera", "Black Death"], correctAnswer: "Black Death", category: "history" },
    { question: "Who was the last Ottoman Sultan?", allAnswers: ["Abdul Hamid II", "Mehmed V", "Mehmed VI", "Mustafa Kemal"], correctAnswer: "Mehmed VI", category: "history" },
    { question: "In what year did the Great Depression begin?", allAnswers: ["1927", "1928", "1929", "1930"], correctAnswer: "1929", category: "history" },
    { question: "Who built Machu Picchu?", allAnswers: ["Aztec", "Maya", "Inca", "Toltec"], correctAnswer: "Inca", category: "history" },
    { question: "In which year was NATO founded?", allAnswers: ["1947", "1948", "1949", "1950"], correctAnswer: "1949", category: "history" },
    { question: "Who was the U.S. Secretary of State during the Cuban Missile Crisis?", allAnswers: ["Robert McNamara", "McGeorge Bundy", "Dean Rusk", "Henry Kissinger"], correctAnswer: "Dean Rusk", category: "history" },
    { question: "Which country was the first to land a rover on Mars?", allAnswers: ["Soviet Union", "European Union", "China", "United States"], correctAnswer: "United States", category: "history" },
    { question: "In what year was the Eiffel Tower built?", allAnswers: ["1885", "1887", "1889", "1891"], correctAnswer: "1889", category: "history" },
    { question: "Which battle marked the end of the Napoleonic Wars?", allAnswers: ["Battle of Leipzig", "Battle of Austerlitz", "Battle of Trafalgar", "Battle of Waterloo"], correctAnswer: "Battle of Waterloo", category: "history" },
    { question: "Who was the last pharaoh of ancient Egypt?", allAnswers: ["Nefertiti", "Hatshepsut", "Cleopatra VII", "Ramesses III"], correctAnswer: "Cleopatra VII", category: "history" },
    { question: "In which year did the United States drop the atomic bomb on Nagasaki?", allAnswers: ["1944", "1945", "1946", "1947"], correctAnswer: "1945", category: "history" },
    { question: "What year was the first Super Bowl played?", allAnswers: ["1965", "1966", "1967", "1968"], correctAnswer: "1967", category: "history" },
    { question: "Which empire did Saladin lead during the Crusades?", allAnswers: ["Ottoman", "Mamluk", "Abbasid", "Ayyubid"], correctAnswer: "Ayyubid", category: "history" },
    { question: "In which year was the Internet made available to the public?", allAnswers: ["1989", "1990", "1991", "1993"], correctAnswer: "1991", category: "history" },
    { question: "Who was the first Prime Minister of Canada?", allAnswers: ["Wilfrid Laurier", "Alexander Mackenzie", "John A. Macdonald", "Robert Borden"], correctAnswer: "John A. Macdonald", category: "history" },
    { question: "What year did the Korean War start?", allAnswers: ["1948", "1949", "1950", "1951"], correctAnswer: "1950", category: "history" },
    { question: "Which explorer was the first European to see the Pacific Ocean?", allAnswers: ["Ferdinand Magellan", "Christopher Columbus", "Amerigo Vespucci", "Vasco Núñez de Balboa"], correctAnswer: "Vasco Núñez de Balboa", category: "history" },
    { question: "In which year did the Apollo 13 mission take place?", allAnswers: ["1968", "1969", "1970", "1971"], correctAnswer: "1970", category: "history" },
    { question: "Who was the first Chancellor of the unified Germany after reunification?", allAnswers: ["Gerhard Schröder", "Willy Brandt", "Helmut Kohl", "Konrad Adenauer"], correctAnswer: "Helmut Kohl", category: "history" },
    { question: "What was the name of the first manned spacecraft to orbit the Earth?", allAnswers: ["Mercury", "Sputnik 2", "Freedom 7", "Vostok 1"], correctAnswer: "Vostok 1", category: "history" },
    { question: "In which year did the Hungarian Revolution take place?", allAnswers: ["1953", "1954", "1955", "1956"], correctAnswer: "1956", category: "history" },
    { question: "Which president of the United States served four terms?", allAnswers: ["Harry S. Truman", "Woodrow Wilson", "Theodore Roosevelt", "Franklin D. Roosevelt"], correctAnswer: "Franklin D. Roosevelt", category: "history" },
    { question: "In what century did the Renaissance begin?", allAnswers: ["12th century", "13th century", "14th century", "15th century"], correctAnswer: "14th century", category: "history" },
    { question: "Who defeated the Persians at the Battle of Marathon?", allAnswers: ["Spartans", "Macedonians", "Athenians", "Corinthians"], correctAnswer: "Athenians", category: "history" },
    { question: "What year did the first world war end on November 11th?", allAnswers: ["1916", "1917", "1918", "1919"], correctAnswer: "1918", category: "history" },
    { question: "Which pharaoh built the Great Pyramid of Giza?", allAnswers: ["Ramesses II", "Tutankhamun", "Khafre", "Khufu"], correctAnswer: "Khufu", category: "history" },
    { question: "In which year did the Rwandan genocide occur?", allAnswers: ["1992", "1993", "1994", "1995"], correctAnswer: "1994", category: "history" },
    { question: "Who was the first female Secretary of State of the United States?", allAnswers: ["Hillary Clinton", "Condoleezza Rice", "Madeleine Albright", "Janet Reno"], correctAnswer: "Madeleine Albright", category: "history" },
    { question: "What year was the Statue of Liberty dedicated?", allAnswers: ["1882", "1884", "1886", "1888"], correctAnswer: "1886", category: "history" },
    { question: "Which country did the United States fight in the War of 1812?", allAnswers: ["France", "Spain", "Mexico", "Britain"], correctAnswer: "Britain", category: "history" },
    { question: "Who was the first European to reach India by sea?", allAnswers: ["Christopher Columbus", "Ferdinand Magellan", "Vasco da Gama", "Bartolomeu Dias"], correctAnswer: "Vasco da Gama", category: "history" },
    { question: "In which year did Hurricane Katrina strike New Orleans?", allAnswers: ["2003", "2004", "2005", "2006"], correctAnswer: "2005", category: "history" },
    { question: "Who was the commander of the British forces at the Battle of Waterloo?", allAnswers: ["Arthur Wellesley (Duke of Wellington)", "William Pitt", "Horatio Nelson", "John Churchill"], correctAnswer: "Arthur Wellesley (Duke of Wellington)", category: "history" },
    { question: "In which year did WWII's Pacific War begin with Japan's attack on Pearl Harbor?", allAnswers: ["1940", "1941", "1942", "1943"], correctAnswer: "1941", category: "history" },
    { question: "Which Roman road was the main road connecting Rome to southern Italy?", allAnswers: ["Via Sacra", "Via Flaminia", "Via Appia", "Via Aurelia"], correctAnswer: "Via Appia", category: "history" }
  ],
  sports: [
    { question: "How many players are on a basketball team on the court?", allAnswers: ["4", "5", "6", "7"], correctAnswer: "5", category: "sports" },
    { question: "Which sport is played at Wimbledon?", allAnswers: ["Golf", "Tennis", "Cricket", "Rugby"], correctAnswer: "Tennis", category: "sports" },
    { question: "How many innings are in a standard baseball game?", allAnswers: ["7", "8", "9", "10"], correctAnswer: "9", category: "sports" },
    { question: "Which country won the 2018 FIFA World Cup?", allAnswers: ["Brazil", "Germany", "France", "Argentina"], correctAnswer: "France", category: "sports" },
    { question: "What is the maximum score in a single frame of bowling?", allAnswers: ["20", "25", "30", "10"], correctAnswer: "30", category: "sports" },
    { question: "How many holes are in a standard golf course?", allAnswers: ["16", "17", "18", "19"], correctAnswer: "18", category: "sports" },
    { question: "Which sport uses a shuttlecock?", allAnswers: ["Tennis", "Badminton", "Volleyball", "Squash"], correctAnswer: "Badminton", category: "sports" },
    { question: "How many players are on a soccer team on the field?", allAnswers: ["10", "11", "12", "13"], correctAnswer: "11", category: "sports" },
    { question: "What is the distance of a marathon in miles?", allAnswers: ["24.2", "25.2", "26.2", "27.2"], correctAnswer: "26.2", category: "sports" },
    { question: "Which sport is known as 'the beautiful game'?", allAnswers: ["Basketball", "Soccer", "Tennis", "Golf"], correctAnswer: "Soccer", category: "sports" },
    { question: "How many rings are in the Olympic symbol?", allAnswers: ["4", "5", "6", "7"], correctAnswer: "5", category: "sports" },
    { question: "Which country hosted the 2016 Summer Olympics?", allAnswers: ["China", "Brazil", "Russia", "Japan"], correctAnswer: "Brazil", category: "sports" },
    { question: "What is the highest score possible in a single dart throw?", allAnswers: ["50", "60", "100", "180"], correctAnswer: "180", category: "sports" },
    { question: "How many players are on an ice hockey team on the ice?", allAnswers: ["5", "6", "7", "8"], correctAnswer: "6", category: "sports" },
    { question: "Which sport uses a net and a ball but no racket?", allAnswers: ["Tennis", "Volleyball", "Badminton", "Squash"], correctAnswer: "Volleyball", category: "sports" },
    { question: "In which country did the sport of sumo wrestling originate?", allAnswers: ["China", "Korea", "Japan", "Mongolia"], correctAnswer: "Japan", category: "sports" },
    { question: "How long is an NFL football field in yards (including both end zones)?", allAnswers: ["100", "110", "120", "130"], correctAnswer: "120", category: "sports" },
    { question: "Which tennis player has won the most Grand Slam singles titles overall?", allAnswers: ["Roger Federer", "Rafael Nadal", "Novak Djokovic", "Pete Sampras"], correctAnswer: "Novak Djokovic", category: "sports" },
    { question: "How many points is a touchdown worth in American football?", allAnswers: ["3", "5", "6", "7"], correctAnswer: "6", category: "sports" },
    { question: "Which country has won the most FIFA World Cups?", allAnswers: ["Germany", "Argentina", "Italy", "Brazil"], correctAnswer: "Brazil", category: "sports" },
    { question: "In swimming, how many strokes are used in a medley relay?", allAnswers: ["2", "3", "4", "5"], correctAnswer: "4", category: "sports" },
    { question: "What is the diameter of a basketball hoop in inches?", allAnswers: ["16", "18", "20", "22"], correctAnswer: "18", category: "sports" },
    { question: "Which boxer was nicknamed 'The Greatest'?", allAnswers: ["Joe Frazier", "George Foreman", "Muhammad Ali", "Mike Tyson"], correctAnswer: "Muhammad Ali", category: "sports" },
    { question: "What is the highest governing body of world soccer?", allAnswers: ["UEFA", "FIFA", "AFC", "CONMEBOL"], correctAnswer: "FIFA", category: "sports" },
    { question: "How many players are on a rugby union team?", allAnswers: ["11", "13", "15", "17"], correctAnswer: "15", category: "sports" },
    { question: "What is the term for three consecutive strikes in bowling?", allAnswers: ["Hat-trick", "Turkey", "Eagle", "Birdie"], correctAnswer: "Turkey", category: "sports" },
    { question: "Which country invented the sport of cricket?", allAnswers: ["Australia", "India", "South Africa", "England"], correctAnswer: "England", category: "sports" },
    { question: "How many players are on a baseball team's field at one time?", allAnswers: ["7", "8", "9", "10"], correctAnswer: "9", category: "sports" },
    { question: "What color is the center of an archery target?", allAnswers: ["Red", "Blue", "Black", "Yellow"], correctAnswer: "Yellow", category: "sports" },
    { question: "In which sport is the 'Ryder Cup' contested?", allAnswers: ["Tennis", "Cricket", "Golf", "Rugby"], correctAnswer: "Golf", category: "sports" },
    { question: "How many gold medals did Michael Phelps win in the 2008 Olympics?", allAnswers: ["6", "7", "8", "9"], correctAnswer: "8", category: "sports" },
    { question: "What is the standard height of a basketball hoop in feet?", allAnswers: ["8", "9", "10", "11"], correctAnswer: "10", category: "sports" },
    { question: "Which country won the Rugby World Cup in 2019?", allAnswers: ["New Zealand", "England", "South Africa", "Australia"], correctAnswer: "South Africa", category: "sports" },
    { question: "In tennis, what is a score of 40-40 called?", allAnswers: ["Tie", "Match point", "Deuce", "Advantage"], correctAnswer: "Deuce", category: "sports" },
    { question: "Which team has won the most Super Bowls?", allAnswers: ["Dallas Cowboys", "San Francisco 49ers", "New England Patriots", "Pittsburgh Steelers"], correctAnswer: "New England Patriots", category: "sports" },
    { question: "How many meters is an Olympic swimming pool?", allAnswers: ["25", "33", "50", "100"], correctAnswer: "50", category: "sports" },
    { question: "How many players are on each side in a polo match?", allAnswers: ["2", "3", "4", "5"], correctAnswer: "4", category: "sports" },
    { question: "In which city are the LA Lakers based?", allAnswers: ["Las Vegas", "San Francisco", "Los Angeles", "Sacramento"], correctAnswer: "Los Angeles", category: "sports" },
    { question: "How many points does a team need to win a set in volleyball?", allAnswers: ["15", "21", "25", "30"], correctAnswer: "25", category: "sports" },
    { question: "In which sport would you perform a 'slam dunk'?", allAnswers: ["Volleyball", "Water Polo", "Basketball", "Handball"], correctAnswer: "Basketball", category: "sports" },
    { question: "What is the name for a score of one under par in golf?", allAnswers: ["Eagle", "Albatross", "Par", "Birdie"], correctAnswer: "Birdie", category: "sports" },
    { question: "Which country has won the most Olympic gold medals overall?", allAnswers: ["China", "Great Britain", "Soviet Union", "United States"], correctAnswer: "United States", category: "sports" },
    { question: "How many sets are played in a standard men's Grand Slam tennis match?", allAnswers: ["3", "4", "5", "6"], correctAnswer: "5", category: "sports" },
    { question: "What is the highest score in a single hand in darts (3 darts)?", allAnswers: ["100", "140", "161", "180"], correctAnswer: "180", category: "sports" },
    { question: "What is the name of the championship series in Major League Baseball?", allAnswers: ["Super Bowl", "World Series", "Stanley Cup", "NBA Finals"], correctAnswer: "World Series", category: "sports" },
    { question: "In which city is the home of the New York Yankees?", allAnswers: ["Newark", "Brooklyn", "Queens", "The Bronx"], correctAnswer: "The Bronx", category: "sports" },
    { question: "How many players are in a water polo team in the water?", allAnswers: ["5", "6", "7", "8"], correctAnswer: "7", category: "sports" },
    { question: "What is the maximum number of clubs a golfer can carry?", allAnswers: ["12", "14", "16", "18"], correctAnswer: "14", category: "sports" },
    { question: "Which sport awards the Stanley Cup?", allAnswers: ["American Football", "Basketball", "Baseball", "Ice Hockey"], correctAnswer: "Ice Hockey", category: "sports" },
    { question: "How long is a standard swimming lane in meters for long-course competitions?", allAnswers: ["25 m", "50 m", "75 m", "100 m"], correctAnswer: "50 m", category: "sports" },
    { question: "What is the minimum number of points needed to win a game in table tennis?", allAnswers: ["9", "11", "15", "21"], correctAnswer: "11", category: "sports" },
    { question: "In which country was basketball invented?", allAnswers: ["United States", "Canada", "United Kingdom", "France"], correctAnswer: "Canada", category: "sports" },
    { question: "How many points is a field goal worth in American football?", allAnswers: ["1", "2", "3", "6"], correctAnswer: "3", category: "sports" },
    { question: "Which country is considered the birthplace of the Olympics?", allAnswers: ["Italy", "Turkey", "Egypt", "Greece"], correctAnswer: "Greece", category: "sports" },
    { question: "How many players per team compete in a volleyball match?", allAnswers: ["5", "6", "7", "8"], correctAnswer: "6", category: "sports" },
    { question: "What is the name of the trophy awarded to the Super Bowl champion?", allAnswers: ["The Vince Lombardi Trophy", "The Commissioner's Trophy", "The Stanley Cup", "The Heisman Trophy"], correctAnswer: "The Vince Lombardi Trophy", category: "sports" },
    { question: "In which sport do players use a puck?", allAnswers: ["Field Hockey", "Lacrosse", "Polo", "Ice Hockey"], correctAnswer: "Ice Hockey", category: "sports" },
    { question: "How many feet are in one yard in American football?", allAnswers: ["2", "3", "4", "5"], correctAnswer: "3", category: "sports" },
    { question: "Which country won the most medals at the 2020 Tokyo Olympics?", allAnswers: ["China", "Great Britain", "Japan", "United States"], correctAnswer: "United States", category: "sports" },
    { question: "What is the official weight of a soccer ball in grams?", allAnswers: ["310–350g", "410–450g", "510–550g", "610–650g"], correctAnswer: "410–450g", category: "sports" },
    { question: "In which sport is the Ashes contested?", allAnswers: ["Rugby", "Tennis", "Golf", "Cricket"], correctAnswer: "Cricket", category: "sports" },
    { question: "Which country won the 2014 FIFA World Cup?", allAnswers: ["Brazil", "Argentina", "France", "Germany"], correctAnswer: "Germany", category: "sports" },
    { question: "What is the length of an Olympic swimming race called a 'mile'?", allAnswers: ["800m", "1000m", "1500m", "2000m"], correctAnswer: "1500m", category: "sports" },
    { question: "How many players are on a netball team?", allAnswers: ["5", "6", "7", "9"], correctAnswer: "7", category: "sports" },
    { question: "In which sport is the 'Heisman Trophy' awarded?", allAnswers: ["Baseball", "Basketball", "College Football", "Ice Hockey"], correctAnswer: "College Football", category: "sports" },
    { question: "What is the name of the championship trophy in the NHL?", allAnswers: ["Presidents' Trophy", "Conn Smythe Trophy", "Art Ross Trophy", "Stanley Cup"], correctAnswer: "Stanley Cup", category: "sports" },
    { question: "How many points is a safety worth in American football?", allAnswers: ["1", "2", "3", "6"], correctAnswer: "2", category: "sports" },
    { question: "Which team won the first ever Super Bowl?", allAnswers: ["New England Patriots", "Kansas City Chiefs", "Green Bay Packers", "Dallas Cowboys"], correctAnswer: "Green Bay Packers", category: "sports" },
    { question: "In golf, what is two strokes under par called?", allAnswers: ["Birdie", "Bogey", "Albatross", "Eagle"], correctAnswer: "Eagle", category: "sports" },
    { question: "What is the diameter of a soccer ball in centimeters?", allAnswers: ["18–20 cm", "21–22 cm", "22–23 cm", "24–26 cm"], correctAnswer: "21–22 cm", category: "sports" },
    { question: "Which country won the 2022 FIFA World Cup?", allAnswers: ["Brazil", "France", "Croatia", "Argentina"], correctAnswer: "Argentina", category: "sports" },
    { question: "How many events are in a decathlon?", allAnswers: ["8", "9", "10", "12"], correctAnswer: "10", category: "sports" },
    { question: "In which sport would you use a 'pommel horse'?", allAnswers: ["Equestrian", "Hurdles", "Gymnastics", "Pole Vault"], correctAnswer: "Gymnastics", category: "sports" },
    { question: "What is the longest distance race in Olympic track and field?", allAnswers: ["5,000m", "8,000m", "10,000m", "15,000m"], correctAnswer: "10,000m", category: "sports" },
    { question: "Which team has won the most NBA championships?", allAnswers: ["Los Angeles Lakers", "Chicago Bulls", "Boston Celtics", "Golden State Warriors"], correctAnswer: "Boston Celtics", category: "sports" },
    { question: "How long is a rugby union match?", allAnswers: ["60 minutes", "70 minutes", "80 minutes", "90 minutes"], correctAnswer: "80 minutes", category: "sports" },
    { question: "What is the name of the trophy awarded in French Open tennis?", allAnswers: ["Wimbledon Plate", "Norman Brookes Cup", "Coupe des Mousquetaires", "Coupe Suzanne Lenglen"], correctAnswer: "Coupe Suzanne Lenglen", category: "sports" },
    { question: "Which city hosted the 2008 Summer Olympics?", allAnswers: ["Seoul", "Tokyo", "Sydney", "Beijing"], correctAnswer: "Beijing", category: "sports" },
    { question: "How many laps make up an Olympic sprint in track and field at 400m?", allAnswers: ["1", "2", "4", "8"], correctAnswer: "1", category: "sports" },
    { question: "What is the weight of an official NFL football in ounces?", allAnswers: ["10–12 oz", "14–15 oz", "16–17 oz", "18–20 oz"], correctAnswer: "14–15 oz", category: "sports" },
    { question: "In which sport would you use a 'parallel bars' apparatus?", allAnswers: ["Wrestling", "Fencing", "Pole Vault", "Gymnastics"], correctAnswer: "Gymnastics", category: "sports" },
    { question: "How many players are on a field lacrosse team?", allAnswers: ["8", "9", "10", "12"], correctAnswer: "10", category: "sports" },
    { question: "Which Formula 1 driver has won the most world championships?", allAnswers: ["Ayrton Senna", "Alain Prost", "Sebastian Vettel", "Lewis Hamilton"], correctAnswer: "Lewis Hamilton", category: "sports" },
    { question: "In which sport do competitors throw a heavy metal ball as far as possible?", allAnswers: ["Hammer throw", "Javelin", "Discus", "Shot put"], correctAnswer: "Shot put", category: "sports" },
    { question: "What is the name of the award for the NHL's most valuable player?", allAnswers: ["Hart Trophy", "Calder Trophy", "Norris Trophy", "Vezina Trophy"], correctAnswer: "Hart Trophy", category: "sports" },
    { question: "How long is a standard soccer match?", allAnswers: ["80 minutes", "85 minutes", "90 minutes", "95 minutes"], correctAnswer: "90 minutes", category: "sports" },
    { question: "How many players are on each side during an Australian rules football match?", allAnswers: ["15", "16", "17", "18"], correctAnswer: "18", category: "sports" },
    { question: "Which swimmer has won the most Olympic medals ever?", allAnswers: ["Ian Thorpe", "Mark Spitz", "Ryan Lochte", "Michael Phelps"], correctAnswer: "Michael Phelps", category: "sports" },
    { question: "What is the name of the championship game in college basketball?", allAnswers: ["Bowl Championship", "Final Four", "March Madness Final", "NCAA Championship Game"], correctAnswer: "NCAA Championship Game", category: "sports" },
    { question: "In which sport do players aim to hit a 'birdie' into a hole?", allAnswers: ["Badminton", "Frisbee golf", "Golf", "Tennis"], correctAnswer: "Golf", category: "sports" },
    { question: "How many points is a converted try worth in rugby union?", allAnswers: ["5", "6", "7", "8"], correctAnswer: "7", category: "sports" },
    { question: "Which country won the 2010 FIFA World Cup?", allAnswers: ["Brazil", "Netherlands", "Germany", "Spain"], correctAnswer: "Spain", category: "sports" },
    { question: "What is the name of the ball used in American football?", allAnswers: ["Pigskin", "Oblong", "Gridiron ball", "Spheroid"], correctAnswer: "Pigskin", category: "sports" },
    { question: "In which sport is the Cheltenham Festival held?", allAnswers: ["Tennis", "Cricket", "Golf", "Horse racing"], correctAnswer: "Horse racing", category: "sports" },
    { question: "How many fouls disqualify a player in an NBA game?", allAnswers: ["4", "5", "6", "7"], correctAnswer: "6", category: "sports" },
    { question: "What is the maximum break (score) in a game of snooker?", allAnswers: ["100", "127", "147", "155"], correctAnswer: "147", category: "sports" },
    { question: "In which city is the Stade de France located?", allAnswers: ["Lyon", "Marseille", "Paris", "Bordeaux"], correctAnswer: "Paris", category: "sports" },
    { question: "Which NBA team did LeBron James first play for?", allAnswers: ["Los Angeles Lakers", "Miami Heat", "Chicago Bulls", "Cleveland Cavaliers"], correctAnswer: "Cleveland Cavaliers", category: "sports" },
    { question: "What is the name for a score of three goals by one player in soccer?", allAnswers: ["Hat-trick", "Triple", "Treble", "Brace"], correctAnswer: "Hat-trick", category: "sports" },
    { question: "In boxing, how many rounds are in a standard professional world title fight?", allAnswers: ["10", "12", "14", "15"], correctAnswer: "12", category: "sports" },
    { question: "Which country won the most gold medals at the 2022 Beijing Winter Olympics?", allAnswers: ["United States", "Canada", "Russia", "Norway"], correctAnswer: "Norway", category: "sports" },
    { question: "How many points is a successful penalty kick worth in rugby union?", allAnswers: ["1", "2", "3", "5"], correctAnswer: "3", category: "sports" },
    { question: "What is the name for a tennis score of zero?", allAnswers: ["Nil", "Nothing", "Love", "Zero"], correctAnswer: "Love", category: "sports" },
    { question: "Which country has won the Cricket World Cup the most times?", allAnswers: ["India", "Pakistan", "West Indies", "Australia"], correctAnswer: "Australia", category: "sports" },
    { question: "How many points is a three-pointer worth in basketball?", allAnswers: ["2", "3", "4", "5"], correctAnswer: "3", category: "sports" },
    { question: "In which sport do competitors complete a biathlon?", allAnswers: ["Skiing and swimming", "Swimming and running", "Cross-country skiing and rifle shooting", "Cycling and swimming"], correctAnswer: "Cross-country skiing and rifle shooting", category: "sports" },
    { question: "What is the name of the governing body of world tennis?", allAnswers: ["WTA", "ATP", "ITF", "ITTF"], correctAnswer: "ITF", category: "sports" },
    { question: "How many players are on a handball team on the court?", allAnswers: ["5", "6", "7", "9"], correctAnswer: "7", category: "sports" },
    { question: "In which country was the first modern Olympic Games held?", allAnswers: ["France", "Italy", "Greece", "United Kingdom"], correctAnswer: "Greece", category: "sports" },
    { question: "What is the official weight of a cricket ball in grams?", allAnswers: ["115–130g", "145–163g", "175–195g", "205–215g"], correctAnswer: "155.9–163g", category: "sports" },
    { question: "Which sprinter broke the 100m world record at the 2009 World Championships?", allAnswers: ["Tyson Gay", "Yohan Blake", "Justin Gatlin", "Usain Bolt"], correctAnswer: "Usain Bolt", category: "sports" },
    { question: "How many events are in the Olympic heptathlon?", allAnswers: ["5", "6", "7", "8"], correctAnswer: "7", category: "sports" },
    { question: "Which country hosted the 2012 Summer Olympics?", allAnswers: ["France", "Germany", "Australia", "United Kingdom"], correctAnswer: "United Kingdom", category: "sports" },
    { question: "What does 'NBA' stand for?", allAnswers: ["National Basketball Athletics", "North Basketball Alliance", "National Basketball Association", "National Basketball Academy"], correctAnswer: "National Basketball Association", category: "sports" },
    { question: "In baseball, how many balls result in a walk?", allAnswers: ["3", "4", "5", "6"], correctAnswer: "4", category: "sports" },
    { question: "Which golfer is nicknamed 'The Golden Bear'?", allAnswers: ["Gary Player", "Arnold Palmer", "Tiger Woods", "Jack Nicklaus"], correctAnswer: "Jack Nicklaus", category: "sports" },
    { question: "How many players are in a volleyball team including substitutes?", allAnswers: ["8", "10", "12", "14"], correctAnswer: "12", category: "sports" },
    { question: "What is the name for a score two over par in golf?", allAnswers: ["Eagle", "Bogey", "Albatross", "Double bogey"], correctAnswer: "Double bogey", category: "sports" },
    { question: "Which American city hosts the Indy 500?", allAnswers: ["Detroit", "Chicago", "Indianapolis", "Columbus"], correctAnswer: "Indianapolis", category: "sports" },
    { question: "How many players compete in a singles tennis match?", allAnswers: ["1", "2", "3", "4"], correctAnswer: "2", category: "sports" },
    { question: "In which sport do competitors score by shooting a ball into a net hanging from a ring?", allAnswers: ["Volleyball", "Water Polo", "Netball", "Basketball"], correctAnswer: "Basketball", category: "sports" },
    { question: "Which country won the 2019 Rugby World Cup?", allAnswers: ["New Zealand", "England", "Australia", "South Africa"], correctAnswer: "South Africa", category: "sports" },
    { question: "What is the name for an American football play where the ball is thrown forward to a receiver?", allAnswers: ["Lateral pass", "Screen pass", "Forward pass", "Pitch"], correctAnswer: "Forward pass", category: "sports" },
    { question: "How many seconds does an NBA team have to shoot once they have possession?", allAnswers: ["20", "24", "28", "30"], correctAnswer: "24", category: "sports" },
    { question: "Which tennis tournament is played on clay courts?", allAnswers: ["Wimbledon", "US Open", "Australian Open", "French Open"], correctAnswer: "French Open", category: "sports" },
    { question: "How many points is a try worth in rugby union?", allAnswers: ["3", "4", "5", "6"], correctAnswer: "5", category: "sports" },
    { question: "In which sport would you find a 'clean and jerk' movement?", allAnswers: ["Wrestling", "Gymnastics", "Powerlifting", "Weightlifting"], correctAnswer: "Weightlifting", category: "sports" },
    { question: "What is the name of the annual boat race between Oxford and Cambridge?", allAnswers: ["The Henley Regatta", "The Boat Race", "The Thames Challenge", "The River Derby"], correctAnswer: "The Boat Race", category: "sports" },
    { question: "Which country has won the Tour de France the most times?", allAnswers: ["Spain", "Belgium", "Italy", "France"], correctAnswer: "France", category: "sports" },
    { question: "How long is a standard NBA game in minutes?", allAnswers: ["40", "44", "48", "52"], correctAnswer: "48", category: "sports" },
    { question: "What is the cricket score called when a batsman is dismissed without scoring?", allAnswers: ["Love", "Nil", "Zero", "Duck"], correctAnswer: "Duck", category: "sports" }
  ],
  entertainment: [
    { question: "Who wrote 'Romeo and Juliet'?", allAnswers: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"], correctAnswer: "William Shakespeare", category: "entertainment" },
    { question: "Which movie won the Academy Award for Best Picture in 2020?", allAnswers: ["1917", "Joker", "Parasite", "Once Upon a Time in Hollywood"], correctAnswer: "Parasite", category: "entertainment" },
    { question: "What is the highest-grossing film of all time?", allAnswers: ["Avatar", "Avengers: Endgame", "Titanic", "Star Wars: The Force Awakens"], correctAnswer: "Avatar", category: "entertainment" },
    { question: "Which band sang 'Bohemian Rhapsody'?", allAnswers: ["The Beatles", "Queen", "Led Zeppelin", "Pink Floyd"], correctAnswer: "Queen", category: "entertainment" },
    { question: "How many Harry Potter books are there?", allAnswers: ["6", "7", "8", "9"], correctAnswer: "7", category: "entertainment" },
    { question: "Which TV show features the character Walter White?", allAnswers: ["The Sopranos", "Breaking Bad", "Game of Thrones", "The Wire"], correctAnswer: "Breaking Bad", category: "entertainment" },
    { question: "Who directed the movie 'Inception'?", allAnswers: ["Steven Spielberg", "Christopher Nolan", "Martin Scorsese", "Quentin Tarantino"], correctAnswer: "Christopher Nolan", category: "entertainment" },
    { question: "Which musical instrument has 88 keys?", allAnswers: ["Organ", "Piano", "Harpsichord", "Accordion"], correctAnswer: "Piano", category: "entertainment" },
    { question: "What is the name of the fictional country in 'The Princess Bride'?", allAnswers: ["Florin", "Guilder", "Genovia", "Aldovia"], correctAnswer: "Florin", category: "entertainment" },
    { question: "Which actor played Jack in 'Titanic'?", allAnswers: ["Brad Pitt", "Leonardo DiCaprio", "Matt Damon", "Tom Cruise"], correctAnswer: "Leonardo DiCaprio", category: "entertainment" },
    { question: "How many seasons does 'Friends' have?", allAnswers: ["8", "9", "10", "11"], correctAnswer: "10", category: "entertainment" },
    { question: "Who painted 'Starry Night'?", allAnswers: ["Pablo Picasso", "Vincent van Gogh", "Claude Monet", "Salvador Dalí"], correctAnswer: "Vincent van Gogh", category: "entertainment" },
    { question: "Which movie features the quote 'May the Force be with you'?", allAnswers: ["Star Trek", "Star Wars", "Guardians of the Galaxy", "The Matrix"], correctAnswer: "Star Wars", category: "entertainment" },
    { question: "What is the name of the coffee shop in 'Friends'?", allAnswers: ["Central Perk", "Central Park", "Coffee Bean", "Starbucks"], correctAnswer: "Central Perk", category: "entertainment" },
    { question: "Which actor plays Iron Man in the Marvel Cinematic Universe?", allAnswers: ["Chris Evans", "Mark Ruffalo", "Robert Downey Jr.", "Chris Hemsworth"], correctAnswer: "Robert Downey Jr.", category: "entertainment" },
    { question: "What is the name of the lion in 'The Lion, the Witch and the Wardrobe'?", allAnswers: ["Mufasa", "Simba", "Aslan", "Leo"], correctAnswer: "Aslan", category: "entertainment" },
    { question: "Which musician is known as the 'King of Pop'?", allAnswers: ["Elvis Presley", "Prince", "Michael Jackson", "David Bowie"], correctAnswer: "Michael Jackson", category: "entertainment" },
    { question: "What is the name of Batman's butler?", allAnswers: ["Watson", "Alfred", "Jarvis", "Edwin"], correctAnswer: "Alfred", category: "entertainment" },
    { question: "In 'The Simpsons', what is the name of the town?", allAnswers: ["Shelbyville", "Springfield", "Capital City", "Ogdenville"], correctAnswer: "Springfield", category: "entertainment" },
    { question: "Which author wrote the 'A Song of Ice and Fire' book series?", allAnswers: ["J.R.R. Tolkien", "George R.R. Martin", "Robert Jordan", "Brandon Sanderson"], correctAnswer: "George R.R. Martin", category: "entertainment" },
    { question: "What instrument does Sherlock Holmes famously play?", allAnswers: ["Cello", "Guitar", "Violin", "Piano"], correctAnswer: "Violin", category: "entertainment" },
    { question: "What is the name of the fictional African country in 'Black Panther'?", allAnswers: ["Zamunda", "Genovia", "Wakanda", "Latveria"], correctAnswer: "Wakanda", category: "entertainment" },
    { question: "Who sang 'Purple Rain'?", allAnswers: ["David Bowie", "Prince", "Jimi Hendrix", "Stevie Wonder"], correctAnswer: "Prince", category: "entertainment" },
    { question: "Which show features the phrase 'Winter is Coming'?", allAnswers: ["The Witcher", "Vikings", "Game of Thrones", "Outlander"], correctAnswer: "Game of Thrones", category: "entertainment" },
    { question: "What is the name of the spaceship in 'Star Wars' that Han Solo pilots?", allAnswers: ["X-Wing", "TIE Fighter", "Millennium Falcon", "Death Star"], correctAnswer: "Millennium Falcon", category: "entertainment" },
    { question: "Which animated film features a fish named Nemo?", allAnswers: ["Shark Tale", "Finding Dory", "Finding Nemo", "The Little Mermaid"], correctAnswer: "Finding Nemo", category: "entertainment" },
    { question: "What is the highest-selling video game console of all time?", allAnswers: ["Nintendo DS", "Game Boy", "PlayStation 2", "Xbox 360"], correctAnswer: "PlayStation 2", category: "entertainment" },
    { question: "Who wrote the novel '1984'?", allAnswers: ["Aldous Huxley", "Ray Bradbury", "George Orwell", "H.G. Wells"], correctAnswer: "George Orwell", category: "entertainment" },
    { question: "Which singer is known as 'Queen of Pop'?", allAnswers: ["Beyoncé", "Lady Gaga", "Rihanna", "Madonna"], correctAnswer: "Madonna", category: "entertainment" },
    { question: "Which actor played Forrest Gump?", allAnswers: ["John Travolta", "Tom Hanks", "Robin Williams", "Kevin Costner"], correctAnswer: "Tom Hanks", category: "entertainment" },
    { question: "In which decade did The Beatles break up?", allAnswers: ["1960s", "1970s", "1980s", "1990s"], correctAnswer: "1970s", category: "entertainment" },
    { question: "What is the name of the toy cowboy in 'Toy Story'?", allAnswers: ["Buzz", "Rex", "Woody", "Hamm"], correctAnswer: "Woody", category: "entertainment" },
    { question: "Which Netflix show is set in Hawkins, Indiana?", allAnswers: ["Dark", "Mindhunter", "Stranger Things", "The OA"], correctAnswer: "Stranger Things", category: "entertainment" },
    { question: "Which video game franchise features Master Chief?", allAnswers: ["Gears of War", "Doom", "Halo", "Call of Duty"], correctAnswer: "Halo", category: "entertainment" },
    { question: "Who wrote 'The Great Gatsby'?", allAnswers: ["Ernest Hemingway", "F. Scott Fitzgerald", "John Steinbeck", "William Faulkner"], correctAnswer: "F. Scott Fitzgerald", category: "entertainment" },
    { question: "What is the name of the virtual reality game world in 'Ready Player One'?", allAnswers: ["The Matrix", "The Grid", "The OASIS", "The Metaverse"], correctAnswer: "The OASIS", category: "entertainment" },
    { question: "Which country produces the most films per year?", allAnswers: ["United States", "China", "Japan", "India"], correctAnswer: "India", category: "entertainment" },
    { question: "What language is the opera 'Carmen' written in?", allAnswers: ["Italian", "German", "Spanish", "French"], correctAnswer: "French", category: "entertainment" },
    { question: "Which 2009 film was the first to gross over $2 billion worldwide?", allAnswers: ["The Dark Knight", "Transformers", "Avatar", "2012"], correctAnswer: "Avatar", category: "entertainment" },
    { question: "Which video game features the character Mario?", allAnswers: ["Sonic the Hedgehog", "Super Mario Bros", "Donkey Kong", "Zelda"], correctAnswer: "Super Mario Bros", category: "entertainment" },
    { question: "Who played James Bond in 'Casino Royale' (2006)?", allAnswers: ["Roger Moore", "Pierce Brosnan", "Timothy Dalton", "Daniel Craig"], correctAnswer: "Daniel Craig", category: "entertainment" },
    { question: "Which TV show featured the fictional paper company Dunder Mifflin?", allAnswers: ["Parks and Recreation", "30 Rock", "The Office", "Arrested Development"], correctAnswer: "The Office", category: "entertainment" },
    { question: "What is the name of the hobbit protagonist in 'The Lord of the Rings'?", allAnswers: ["Bilbo Baggins", "Pippin Took", "Samwise Gamgee", "Frodo Baggins"], correctAnswer: "Frodo Baggins", category: "entertainment" },
    { question: "Which rapper released the album 'To Pimp a Butterfly'?", allAnswers: ["Jay-Z", "Kanye West", "Drake", "Kendrick Lamar"], correctAnswer: "Kendrick Lamar", category: "entertainment" },
    { question: "In 'Jurassic Park', what dinosaur attacks the children in the kitchen?", allAnswers: ["T-Rex", "Velociraptor", "Dilophosaurus", "Triceratops"], correctAnswer: "Velociraptor", category: "entertainment" },
    { question: "Who wrote the 'Harry Potter' series?", allAnswers: ["Stephenie Meyer", "Suzanne Collins", "Philip Pullman", "J.K. Rowling"], correctAnswer: "J.K. Rowling", category: "entertainment" },
    { question: "Which rock band has the best-selling album of all time ('The Dark Side of the Moon')?", allAnswers: ["Led Zeppelin", "The Eagles", "The Beatles", "Pink Floyd"], correctAnswer: "Pink Floyd", category: "entertainment" },
    { question: "What is the name of the AI computer in '2001: A Space Odyssey'?", allAnswers: ["JARVIS", "GLaDOS", "HAL 9000", "TARS"], correctAnswer: "HAL 9000", category: "entertainment" },
    { question: "Which animated Disney film features the song 'Let It Go'?", allAnswers: ["Moana", "Tangled", "Brave", "Frozen"], correctAnswer: "Frozen", category: "entertainment" },
    { question: "In which decade was the first 'Star Wars' film released?", allAnswers: ["1960s", "1970s", "1980s", "1990s"], correctAnswer: "1970s", category: "entertainment" },
    { question: "Who plays the Joker in 'The Dark Knight' (2008)?", allAnswers: ["Jared Leto", "Joaquin Phoenix", "Jack Nicholson", "Heath Ledger"], correctAnswer: "Heath Ledger", category: "entertainment" },
    { question: "Which band performed 'Smells Like Teen Spirit'?", allAnswers: ["Pearl Jam", "Alice in Chains", "Soundgarden", "Nirvana"], correctAnswer: "Nirvana", category: "entertainment" },
    { question: "What is the name of the lead character in the TV show 'Dexter'?", allAnswers: ["Walter White", "Frank Underwood", "Dexter Morgan", "Tony Soprano"], correctAnswer: "Dexter Morgan", category: "entertainment" },
    { question: "Which book series features the character Percy Jackson?", allAnswers: ["The Maze Runner", "Divergent", "The Hunger Games", "Percy Jackson & the Olympians"], correctAnswer: "Percy Jackson & the Olympians", category: "entertainment" },
    { question: "In 'The Wizard of Oz', what does the Tin Man want?", allAnswers: ["A brain", "Courage", "A heart", "A home"], correctAnswer: "A heart", category: "entertainment" },
    { question: "Which artist painted the Sistine Chapel ceiling?", allAnswers: ["Leonardo da Vinci", "Raphael", "Donatello", "Michelangelo"], correctAnswer: "Michelangelo", category: "entertainment" },
    { question: "What is the name of the main character in 'The Hunger Games'?", allAnswers: ["Tris Prior", "Katniss Everdeen", "Bella Swan", "Hermione Granger"], correctAnswer: "Katniss Everdeen", category: "entertainment" },
    { question: "Which band sang 'Hotel California'?", allAnswers: ["Fleetwood Mac", "The Doobie Brothers", "Eagles", "Steely Dan"], correctAnswer: "Eagles", category: "entertainment" },
    { question: "What is the name of the bar in 'Cheers'?", allAnswers: ["Paddy's Pub", "McLaren's Bar", "The Drunken Clam", "Cheers"], correctAnswer: "Cheers", category: "entertainment" },
    { question: "In which video game franchise do you play as Kratos?", allAnswers: ["Devil May Cry", "Bayonetta", "God of War", "Darksiders"], correctAnswer: "God of War", category: "entertainment" },
    { question: "Who wrote 'Pride and Prejudice'?", allAnswers: ["Charlotte Brontë", "Emily Brontë", "George Eliot", "Jane Austen"], correctAnswer: "Jane Austen", category: "entertainment" },
    { question: "Which cartoon features the character SpongeBob SquarePants?", allAnswers: ["Rugrats", "Fairly OddParents", "SpongeBob SquarePants", "Dexter's Laboratory"], correctAnswer: "SpongeBob SquarePants", category: "entertainment" },
    { question: "What is the highest-grossing animated film of all time?", allAnswers: ["The Lion King", "Finding Nemo", "Incredibles 2", "Frozen II"], correctAnswer: "The Lion King", category: "entertainment" },
    { question: "Which singer is known as 'The Boss'?", allAnswers: ["Tom Petty", "Bob Dylan", "Bruce Springsteen", "Billy Joel"], correctAnswer: "Bruce Springsteen", category: "entertainment" },
    { question: "What is the name of the character played by Johnny Depp in 'Pirates of the Caribbean'?", allAnswers: ["Davy Jones", "Will Turner", "Jack Sparrow", "Captain Barbossa"], correctAnswer: "Jack Sparrow", category: "entertainment" },
    { question: "Which TV show features dragons and the Iron Throne?", allAnswers: ["Vikings", "The Last Kingdom", "Outlander", "Game of Thrones"], correctAnswer: "Game of Thrones", category: "entertainment" },
    { question: "Who sang 'Thriller'?", allAnswers: ["Prince", "Janet Jackson", "Whitney Houston", "Michael Jackson"], correctAnswer: "Michael Jackson", category: "entertainment" },
    { question: "In which video game do you battle as a fighter on 'Battlefield'?", allAnswers: ["Call of Duty", "Medal of Honor", "Halo", "Battlefield"], correctAnswer: "Battlefield", category: "entertainment" },
    { question: "Which director made 'Schindler's List'?", allAnswers: ["Stanley Kubrick", "Francis Ford Coppola", "Martin Scorsese", "Steven Spielberg"], correctAnswer: "Steven Spielberg", category: "entertainment" },
    { question: "What is the name of Sherlock Holmes's address?", allAnswers: ["10 Downing Street", "221B Baker Street", "4 Privet Drive", "12 Grimmauld Place"], correctAnswer: "221B Baker Street", category: "entertainment" },
    { question: "Which band was Elvis Presley the lead singer of?", allAnswers: ["The Crickets", "Bill Haley & His Comets", "The Blue Moon Boys", "He was a solo artist"], correctAnswer: "He was a solo artist", category: "entertainment" },
    { question: "What is the name of the clown in Stephen King's 'IT'?", allAnswers: ["Bozo", "Krusty", "Chuckles", "Pennywise"], correctAnswer: "Pennywise", category: "entertainment" },
    { question: "Which movie won Best Picture at the 2023 Academy Awards?", allAnswers: ["Tár", "The Fabelmans", "Banshees of Inisherin", "Everything Everywhere All at Once"], correctAnswer: "Everything Everywhere All at Once", category: "entertainment" },
    { question: "Who sang 'Rolling in the Deep'?", allAnswers: ["Beyoncé", "Rihanna", "Lady Gaga", "Adele"], correctAnswer: "Adele", category: "entertainment" },
    { question: "In 'The Lion King', what is Simba's father's name?", allAnswers: ["Scar", "Pumba", "Rafiki", "Mufasa"], correctAnswer: "Mufasa", category: "entertainment" },
    { question: "Which actor starred in 'Gladiator' as Maximus?", allAnswers: ["Brad Pitt", "Mel Gibson", "Russell Crowe", "Gerard Butler"], correctAnswer: "Russell Crowe", category: "entertainment" },
    { question: "Which band sang 'Sweet Home Alabama'?", allAnswers: ["The Allman Brothers Band", "ZZ Top", "Lynyrd Skynyrd", "38 Special"], correctAnswer: "Lynyrd Skynyrd", category: "entertainment" },
    { question: "What is the name of the school in 'Harry Potter'?", allAnswers: ["Beauxbatons", "Durmstrang", "Ilvermorny", "Hogwarts"], correctAnswer: "Hogwarts", category: "entertainment" },
    { question: "Which Marvel superhero is also known as 'The Merc with a Mouth'?", allAnswers: ["Punisher", "Wolverine", "Deadpool", "Spider-Man"], correctAnswer: "Deadpool", category: "entertainment" },
    { question: "In which city is 'How I Met Your Mother' set?", allAnswers: ["Los Angeles", "Chicago", "Boston", "New York City"], correctAnswer: "New York City", category: "entertainment" },
    { question: "Who wrote 'To Kill a Mockingbird'?", allAnswers: ["Toni Morrison", "William Faulkner", "Harper Lee", "John Steinbeck"], correctAnswer: "Harper Lee", category: "entertainment" },
    { question: "What is the name of the main antagonist in 'The Silence of the Lambs'?", allAnswers: ["Buffalo Bill", "John Doe", "Norman Bates", "Hannibal Lecter"], correctAnswer: "Hannibal Lecter", category: "entertainment" },
    { question: "Which streaming service produced 'House of Cards'?", allAnswers: ["HBO", "Amazon Prime", "Disney+", "Netflix"], correctAnswer: "Netflix", category: "entertainment" },
    { question: "Who sang 'Imagine'?", allAnswers: ["Paul McCartney", "George Harrison", "Ringo Starr", "John Lennon"], correctAnswer: "John Lennon", category: "entertainment" },
    { question: "In 'Toy Story', what is the name of the boy who owns the toys?", allAnswers: ["Jack", "Tim", "Andy", "Sam"], correctAnswer: "Andy", category: "entertainment" },
    { question: "What is the name of the dragon in 'How to Train Your Dragon'?", allAnswers: ["Stormfly", "Hookfang", "Barf", "Toothless"], correctAnswer: "Toothless", category: "entertainment" },
    { question: "Which band performed 'Paint It Black'?", allAnswers: ["The Who", "Led Zeppelin", "The Doors", "The Rolling Stones"], correctAnswer: "The Rolling Stones", category: "entertainment" },
    { question: "Who played Tony Montana in 'Scarface'?", allAnswers: ["Robert De Niro", "Al Pacino", "Harvey Keitel", "Joe Pesci"], correctAnswer: "Al Pacino", category: "entertainment" },
    { question: "What is the name of the island in 'Lost'?", allAnswers: ["Catatumbo Island", "Mystery Island", "The Island", "Hydra Island"], correctAnswer: "The Island", category: "entertainment" },
    { question: "Which Nintendo game features Link as the main character?", allAnswers: ["Metroid", "Kirby", "Star Fox", "The Legend of Zelda"], correctAnswer: "The Legend of Zelda", category: "entertainment" },
    { question: "Who wrote 'Of Mice and Men'?", allAnswers: ["Ernest Hemingway", "F. Scott Fitzgerald", "William Faulkner", "John Steinbeck"], correctAnswer: "John Steinbeck", category: "entertainment" },
    { question: "Which movie features the line 'You can't handle the truth!'?", allAnswers: ["The Shining", "Goodfellas", "A Few Good Men", "Philadelphia"], correctAnswer: "A Few Good Men", category: "entertainment" },
    { question: "Who plays the main character in the TV show 'House M.D.'?", allAnswers: ["Patrick Dempsey", "George Clooney", "Hugh Laurie", "Matthew Fox"], correctAnswer: "Hugh Laurie", category: "entertainment" },
    { question: "Which rapper is known as 'Slim Shady'?", allAnswers: ["Snoop Dogg", "50 Cent", "Dr. Dre", "Eminem"], correctAnswer: "Eminem", category: "entertainment" },
    { question: "What is the name of the fictional town in 'Twin Peaks'?", allAnswers: ["Twin Peaks", "Sunnydale", "Riverdale", "Hawkins"], correctAnswer: "Twin Peaks", category: "entertainment" },
    { question: "Which musical is set during the French Revolution?", allAnswers: ["Chicago", "Phantom of the Opera", "Les Misérables", "Hamilton"], correctAnswer: "Les Misérables", category: "entertainment" },
    { question: "In 'Breaking Bad', what subject does Walter White teach?", allAnswers: ["Biology", "Physics", "Chemistry", "Mathematics"], correctAnswer: "Chemistry", category: "entertainment" },
    { question: "Who directed 'Pulp Fiction'?", allAnswers: ["Martin Scorsese", "Oliver Stone", "Spike Lee", "Quentin Tarantino"], correctAnswer: "Quentin Tarantino", category: "entertainment" },
    { question: "What is the name of the Pixar film about a rat who wants to be a chef?", allAnswers: ["Chef", "Ratatouille", "Bon Appétit", "Gourmet"], correctAnswer: "Ratatouille", category: "entertainment" },
    { question: "Who sang 'Born to Run'?", allAnswers: ["Tom Petty", "Bob Seger", "John Mellencamp", "Bruce Springsteen"], correctAnswer: "Bruce Springsteen", category: "entertainment" },
    { question: "What is the name of the artificial intelligence in the TV show 'Person of Interest'?", allAnswers: ["JARVIS", "ARIA", "ALICE", "The Machine"], correctAnswer: "The Machine", category: "entertainment" },
    { question: "Which video game franchise features the character Nathan Drake?", allAnswers: ["Tomb Raider", "Assassin's Creed", "Uncharted", "The Last of Us"], correctAnswer: "Uncharted", category: "entertainment" },
    { question: "What is the name of the alien in 'E.T. the Extra-Terrestrial'?", allAnswers: ["Alf", "Stitch", "E.T.", "Mork"], correctAnswer: "E.T.", category: "entertainment" },
    { question: "Which book by J.R.R. Tolkien precedes 'The Lord of the Rings'?", allAnswers: ["The Silmarillion", "Unfinished Tales", "The Children of Húrin", "The Hobbit"], correctAnswer: "The Hobbit", category: "entertainment" },
    { question: "Who sang 'Hello' (2015)?", allAnswers: ["Beyoncé", "Taylor Swift", "Rihanna", "Adele"], correctAnswer: "Adele", category: "entertainment" },
    { question: "In 'Avengers: Endgame', who says 'I am Iron Man' before snapping?", allAnswers: ["Thor", "Captain America", "The Hulk", "Tony Stark"], correctAnswer: "Tony Stark", category: "entertainment" },
    { question: "Which TV series features meth production in Albuquerque, New Mexico?", allAnswers: ["Ozark", "Narcos", "Weeds", "Breaking Bad"], correctAnswer: "Breaking Bad", category: "entertainment" },
    { question: "What is the name of the main character in 'Schitt's Creek'?", allAnswers: ["Johnny Rose", "David Rose", "Moira Rose", "Alexis Rose"], correctAnswer: "David Rose", category: "entertainment" },
    { question: "Which band sang 'Eye of the Tiger'?", allAnswers: ["Journey", "Foreigner", "Survivor", "REO Speedwagon"], correctAnswer: "Survivor", category: "entertainment" },
    { question: "In which movie does Leonardo DiCaprio play a stockbroker named Jordan Belfort?", allAnswers: ["The Aviator", "Catch Me If You Can", "J. Edgar", "The Wolf of Wall Street"], correctAnswer: "The Wolf of Wall Street", category: "entertainment" },
    { question: "Which artist is known for songs 'Lose Yourself' and 'Rap God'?", allAnswers: ["Jay-Z", "50 Cent", "Nas", "Eminem"], correctAnswer: "Eminem", category: "entertainment" },
    { question: "What is the name of the character played by Bryan Cranston in 'Breaking Bad'?", allAnswers: ["Jesse Pinkman", "Hank Schrader", "Walter White", "Saul Goodman"], correctAnswer: "Walter White", category: "entertainment" },
    { question: "Which animated Pixar movie features a superhero family?", allAnswers: ["Big Hero 6", "Monsters, Inc.", "Cars", "The Incredibles"], correctAnswer: "The Incredibles", category: "entertainment" },
    { question: "Who wrote 'Moby-Dick'?", allAnswers: ["Nathaniel Hawthorne", "Walt Whitman", "Edgar Allan Poe", "Herman Melville"], correctAnswer: "Herman Melville", category: "entertainment" },
    { question: "Which band sang 'Don't Stop Believin''?", allAnswers: ["Boston", "Foreigner", "Heart", "Journey"], correctAnswer: "Journey", category: "entertainment" },
    { question: "What is the name of the fictional kingdom in 'Frozen'?", allAnswers: ["Dunbroch", "Arendelle", "Corona", "Agrabah"], correctAnswer: "Arendelle", category: "entertainment" },
    { question: "In which city is 'The Wire' set?", allAnswers: ["Chicago", "New York", "Philadelphia", "Baltimore"], correctAnswer: "Baltimore", category: "entertainment" },
    { question: "Who directed 'The Godfather'?", allAnswers: ["Martin Scorsese", "Brian De Palma", "Francis Ford Coppola", "Sidney Lumet"], correctAnswer: "Francis Ford Coppola", category: "entertainment" },
    { question: "Which pop star's real name is Stefani Joanne Angelina Germanotta?", allAnswers: ["Katy Perry", "Ariana Grande", "Rihanna", "Lady Gaga"], correctAnswer: "Lady Gaga", category: "entertainment" },
    { question: "What is the name of Thor's hammer?", allAnswers: ["Gungnir", "Stormbreaker", "Jarnbjorn", "Mjolnir"], correctAnswer: "Mjolnir", category: "entertainment" },
    { question: "Which movie won the first Academy Award for Best Animated Feature?", allAnswers: ["Toy Story", "Shrek", "Spirited Away", "Monsters, Inc."], correctAnswer: "Shrek", category: "entertainment" },
    { question: "Who plays Walter White's wife in 'Breaking Bad'?", allAnswers: ["Jennifer Aniston", "Kyra Sedgwick", "Anna Gunn", "Claire Danes"], correctAnswer: "Anna Gunn", category: "entertainment" },
    { question: "Which 1994 film featured a team including Forrest Gump?", allAnswers: ["Philadelphia", "The Shawshank Redemption", "Pulp Fiction", "Forrest Gump"], correctAnswer: "Forrest Gump", category: "entertainment" },
    { question: "What is the name of the primary song in 'The Lion King' (1994)?", allAnswers: ["Under the Sea", "A Whole New World", "Be Prepared", "Circle of Life"], correctAnswer: "Circle of Life", category: "entertainment" },
    { question: "Which author created the character Atticus Finch?", allAnswers: ["John Steinbeck", "William Faulkner", "Flannery O'Connor", "Harper Lee"], correctAnswer: "Harper Lee", category: "entertainment" },
    { question: "What year was the first 'Minecraft' public alpha released?", allAnswers: ["2007", "2008", "2009", "2010"], correctAnswer: "2009", category: "entertainment" },
    { question: "Which pop singer was born Robyn Rihanna Fenty?", allAnswers: ["Beyoncé", "Nicki Minaj", "Cardi B", "Rihanna"], correctAnswer: "Rihanna", category: "entertainment" },
    { question: "In which TV show would you find the character Don Draper?", allAnswers: ["Suits", "Billions", "Mad Men", "Succession"], correctAnswer: "Mad Men", category: "entertainment" },
    { question: "What is the name of the fictional newspaper in 'Superman'?", allAnswers: ["The Metropolis Times", "The Daily Planet", "The Daily Bugle", "The Gotham Gazette"], correctAnswer: "The Daily Planet", category: "entertainment" },
    { question: "Which band released the album 'Abbey Road'?", allAnswers: ["The Rolling Stones", "The Kinks", "The Who", "The Beatles"], correctAnswer: "The Beatles", category: "entertainment" },
    { question: "In the 'Fast & Furious' franchise, who plays Dominic Toretto?", allAnswers: ["Jason Statham", "Dwayne Johnson", "Vin Diesel", "Paul Walker"], correctAnswer: "Vin Diesel", category: "entertainment" },
    { question: "What is the name of the talking horse in 'Mr. Ed'?", allAnswers: ["Ed", "Mister", "Wilbur", "Mr. Ed"], correctAnswer: "Mr. Ed", category: "entertainment" },
    { question: "Which animated series features Stewie Griffin?", allAnswers: ["American Dad", "Bob's Burgers", "Futurama", "Family Guy"], correctAnswer: "Family Guy", category: "entertainment" },
    { question: "Who plays Daenerys Targaryen in 'Game of Thrones'?", allAnswers: ["Sophie Turner", "Maisie Williams", "Natalie Dormer", "Emilia Clarke"], correctAnswer: "Emilia Clarke", category: "entertainment" },
    { question: "Which book is 'The Handmaid's Tale' based on, authored by whom?", allAnswers: ["Ursula K. Le Guin", "Toni Morrison", "Octavia Butler", "Margaret Atwood"], correctAnswer: "Margaret Atwood", category: "entertainment" },
    { question: "What is the name of the spaceship in 'Firefly'?", allAnswers: ["Tardis", "Serenity", "Enterprise", "Battlestar"], correctAnswer: "Serenity", category: "entertainment" },
    { question: "Who sang 'Baby One More Time'?", allAnswers: ["Christina Aguilera", "Avril Lavigne", "Britney Spears", "Jessica Simpson"], correctAnswer: "Britney Spears", category: "entertainment" },
    { question: "In which video game do you fight as a Spartan soldier against the Covenant?", allAnswers: ["Destiny", "Call of Duty", "Gears of War", "Halo"], correctAnswer: "Halo", category: "entertainment" },
    { question: "Which actor voiced Buzz Lightyear in the original 'Toy Story'?", allAnswers: ["Tom Hanks", "Tim Allen", "Jim Carrey", "Robin Williams"], correctAnswer: "Tim Allen", category: "entertainment" },
    { question: "What is the name of the villain in 'The Silence of the Lambs' who skins his victims?", allAnswers: ["Leatherface", "Jason Voorhees", "Hannibal Lecter", "Buffalo Bill"], correctAnswer: "Buffalo Bill", category: "entertainment" },
    { question: "Which TV series features a high school chemistry teacher who becomes a drug lord?", allAnswers: ["Narcos", "Ozark", "Weeds", "Breaking Bad"], correctAnswer: "Breaking Bad", category: "entertainment" },
    { question: "What is the name of Dumbledore's phoenix in Harry Potter?", allAnswers: ["Hedwig", "Fawkes", "Buckbeak", "Crookshanks"], correctAnswer: "Fawkes", category: "entertainment" },
    { question: "Who created Mickey Mouse?", allAnswers: ["Jim Henson", "Chuck Jones", "Walter Lantz", "Walt Disney"], correctAnswer: "Walt Disney", category: "entertainment" },
    { question: "What year did the TV show 'Seinfeld' end?", allAnswers: ["1996", "1997", "1998", "1999"], correctAnswer: "1998", category: "entertainment" },
    { question: "In which movie does Will Smith play a character trying to find a cure for a zombie virus?", allAnswers: ["Hitch", "Concussion", "Ali", "I Am Legend"], correctAnswer: "I Am Legend", category: "entertainment" },
    { question: "Who sings 'Shake It Off'?", allAnswers: ["Katy Perry", "Selena Gomez", "Demi Lovato", "Taylor Swift"], correctAnswer: "Taylor Swift", category: "entertainment" },
    { question: "What is the name of the fictional city where Batman operates?", allAnswers: ["Metropolis", "Central City", "Star City", "Gotham City"], correctAnswer: "Gotham City", category: "entertainment" },
    { question: "Which TV show is set at Sacred Heart Hospital and stars Zach Braff?", allAnswers: ["ER", "Grey's Anatomy", "House M.D.", "Scrubs"], correctAnswer: "Scrubs", category: "entertainment" },
    { question: "Who sang 'Shape of You'?", allAnswers: ["Sam Smith", "Justin Timberlake", "Bruno Mars", "Ed Sheeran"], correctAnswer: "Ed Sheeran", category: "entertainment" },
    { question: "What is the name of the pub in 'It's Always Sunny in Philadelphia'?", allAnswers: ["The Rusty Nail", "Paddy's Pub", "The Dead Poets", "MacLaren's"], correctAnswer: "Paddy's Pub", category: "entertainment" },
    { question: "Which movie features the character Ellen Ripley fighting aliens?", allAnswers: ["Predator", "The Thing", "Species", "Alien"], correctAnswer: "Alien", category: "entertainment" },
    { question: "In 'The Office', who is the regional manager of Dunder Mifflin Scranton?", allAnswers: ["Dwight Schrute", "Jim Halpert", "Ryan Howard", "Michael Scott"], correctAnswer: "Michael Scott", category: "entertainment" },
    { question: "Who directed 'Jurassic Park'?", allAnswers: ["George Lucas", "James Cameron", "Ridley Scott", "Steven Spielberg"], correctAnswer: "Steven Spielberg", category: "entertainment" },
    { question: "What is the name of the city in 'Batman'?", allAnswers: ["Metropolis", "Star City", "Central City", "Gotham City"], correctAnswer: "Gotham City", category: "entertainment" },
    { question: "Which pop group included members Sporty, Scary, Baby, Ginger, and Posh?", allAnswers: ["TLC", "Destiny's Child", "En Vogue", "Spice Girls"], correctAnswer: "Spice Girls", category: "entertainment" },
    { question: "In 'Parks and Recreation', what city is the show set in?", allAnswers: ["Eagleton", "Pawnee", "Wamapoke County", "Springfield"], correctAnswer: "Pawnee", category: "entertainment" },
    { question: "Who plays Iron Man's AI assistant JARVIS?", allAnswers: ["Paul Bettany", "Mark Ruffalo", "Jeremy Renner", "Clark Gregg"], correctAnswer: "Paul Bettany", category: "entertainment" },
    { question: "What is the name of the TV show about a chemistry teacher turned meth producer?", allAnswers: ["Ozark", "Narcos", "Better Call Saul", "Breaking Bad"], correctAnswer: "Breaking Bad", category: "entertainment" }
  ]
};

const DEFAULT_CONFIG: TriviaConfig = {
  totalQuestions: 10,
  timePerQuestion: 10, // Changed from 30 to 10 seconds
  pointsPerQuestion: {
    correct: 10, // Base points
    speedBonus: 10 // Max speed bonus (so max total is 20 per question)
  }
};

@Injectable()
export class TriviaService {
  private gameStates = new Map<string, TriviaState>();
  private themeSelections = new Map<string, Map<string, string>>(); // gameId -> Map<userId, theme>

  /**
   * Initialize trivia game state with theme selection phase
   */
  initializeState(
    playerIds: string[],
    config?: Partial<TriviaConfig>
  ): TriviaState {
    const finalConfig: TriviaConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      pointsPerQuestion: {
        ...DEFAULT_CONFIG.pointsPerQuestion,
        ...config?.pointsPerQuestion,
      },
    };

    // Initialize players
    const players: TriviaPlayer[] = playerIds.map((id, index) => ({
      odUserId: id,
      displayName: `Player ${index + 1}`, // Will be updated with actual display names
      score: 0
    }));

    const state: TriviaState = {
      phase: "themeSelection",
      currentQuestionIndex: 0,
      questions: [], // Will be populated after theme selection
      players,
      currentAnswers: [],
      playerCount: players.length,
      themeSelections: new Map()
    };

    return state;
  }

  /**
   * Select theme for a player
   */
  selectTheme(gameId: string, userId: string, theme: TriviaTheme): {
    state: TriviaState;
    allPlayersSelected: boolean;
    selectedTheme?: string;
  } {
    const state = this.gameStates.get(gameId);
    if (!state) {
      throw new Error("Game state not found");
    }

    if (state.phase !== "themeSelection") {
      throw new Error("Not in theme selection phase");
    }

    // Store theme selection
    if (!this.themeSelections.has(gameId)) {
      this.themeSelections.set(gameId, new Map());
    }
    this.themeSelections.get(gameId)!.set(userId, theme);

    // Check if all players have selected
    const selections = this.themeSelections.get(gameId)!;
    const allSelected = selections.size >= state.playerCount;

    let finalTheme: string | undefined;
    if (allSelected) {
      // Determine final theme
      const themes = Array.from(selections.values());
      if (themes[0] === themes[1]) {
        // Both selected the same theme
        finalTheme = themes[0];
      } else {
        // Different themes - randomly select one
        finalTheme = themes[Math.floor(Math.random() * themes.length)];
      }

      // Load questions for selected theme
      let questions: TriviaQuestion[] = [];
      if (finalTheme === "mixed") {
        // Mix questions from all themes
        const allQuestions = Object.values(QUESTIONS_BY_THEME).flat();
        questions = this.shuffleArray(allQuestions);
      } else {
        questions = [...(QUESTIONS_BY_THEME[finalTheme] || [])];
      }

      // Shuffle question order and take the required number
      questions = this.shuffleArray(questions).slice(0, DEFAULT_CONFIG.totalQuestions);

      // Shuffle answer order per-game so the correct answer is never in a predictable slot
      questions = questions.map(q => {
        const shuffledAnswers = this.shuffleArray(q.allAnswers);
        return { ...q, allAnswers: shuffledAnswers };
      });

      // Update state with questions and move to countdown
      const updatedState: TriviaState = {
        ...state,
        phase: "countdown",
        questions,
        selectedTheme: finalTheme
      };

      this.gameStates.set(gameId, updatedState);
      return { state: updatedState, allPlayersSelected: true, selectedTheme: finalTheme };
    }

    // Not all players selected yet
    const updatedState: TriviaState = {
      ...state,
      themeSelections: selections
    };
    this.gameStates.set(gameId, updatedState);
    return { state: updatedState, allPlayersSelected: false };
  }

  /**
   * Get theme selections for a game
   */
  getThemeSelections(gameId: string): Map<string, string> | undefined {
    return this.themeSelections.get(gameId);
  }

  /**
   * Start the game (move from countdown to question phase)
   */
  startGame(gameId: string, state?: TriviaState): TriviaState {
    const gameState = state || this.gameStates.get(gameId);
    if (!gameState) {
      throw new Error("Game state not found");
    }

    const startedState: TriviaState = {
      ...gameState,
      phase: "question",
      currentQuestionIndex: 0,
      currentAnswers: []
    };

    this.gameStates.set(gameId, startedState);
    return startedState;
  }

  /**
   * Get current question
   */
  getCurrentQuestion(state: TriviaState): TriviaQuestion | null {
    if (state.currentQuestionIndex >= state.questions.length) {
      return null;
    }
    return state.questions[state.currentQuestionIndex];
  }

  /**
   * Submit an answer
   */
  submitAnswer(
    gameId: string,
    odUserId: string,
    odUserDisplayName: string,
    questionIndex: number,
    answerIndex: number,
    timeToAnswer: number
  ): { state: TriviaState; isNewAnswer: boolean } {
    const state = this.gameStates.get(gameId);
    if (!state) {
      throw new Error("Game state not found");
    }

    // Check if we're in question phase
    if (state.phase !== "question") {
      throw new Error(`Cannot submit answer - game is in ${state.phase} phase`);
    }

    // Allow slight mismatch in question index (in case of race condition)
    // But ensure we're answering the current question
    if (questionIndex !== state.currentQuestionIndex) {
      // If the submitted index is close to current, use current index
      if (Math.abs(questionIndex - state.currentQuestionIndex) <= 1) {
        questionIndex = state.currentQuestionIndex;
      } else {
        throw new Error(`Question index mismatch: submitted ${questionIndex}, current is ${state.currentQuestionIndex}`);
      }
    }

    const question = this.getCurrentQuestion(state);
    if (!question) {
      throw new Error("No current question");
    }

    // Check if user already answered - do this check AFTER getting fresh state
    const existingAnswer = state.currentAnswers.find(a => a.odUserId === odUserId);
    if (existingAnswer) {
      // Return the current state (not the old one)
      return { state, isNewAnswer: false };
    }

    const selectedAnswer = question.allAnswers[answerIndex];
    const isCorrect = selectedAnswer === question.correctAnswer;
    
    // Calculate points: 10 base + speed bonus (max 10) = max 20 per question
    // Wrong answer = 0 points automatically
    let pointsEarned = 0;
    if (isCorrect) {
      const maxTime = 10; // 10 seconds
      const speedMultiplier = Math.max(0, 1 - (timeToAnswer / maxTime));
      const basePoints = 10;
      const speedBonus = Math.floor(10 * speedMultiplier); // Max 10 bonus points
      pointsEarned = basePoints + speedBonus; // Max 20 total
    }

    const answer: TriviaAnswer = {
      odUserId,
      odUserDisplayName,
      selectedAnswer,
      selectedAnswerIndex: answerIndex,
      isCorrect,
      pointsEarned,
      timeToAnswer
    };

    // Update player score
    const updatedPlayers = state.players.map(p => 
      p.odUserId === odUserId
        ? { ...p, score: p.score + pointsEarned }
        : p
    );

    const updatedState: TriviaState = {
      ...state,
      currentAnswers: [...state.currentAnswers, answer],
      players: updatedPlayers
    };

    this.gameStates.set(gameId, updatedState);
    return { state: updatedState, isNewAnswer: true };
  }

  /**
   * Check if all players have answered
   */
  allPlayersAnswered(state: TriviaState): boolean {
    return state.currentAnswers.length >= state.playerCount;
  }

  /**
   * End current question (move to result phase)
   */
  endQuestion(state: TriviaState): TriviaState {
    return {
      ...state,
      phase: "result"
    };
  }

  /**
   * Advance to next question
   */
  advanceToNextQuestion(state: TriviaState): TriviaState {
    const nextIndex = state.currentQuestionIndex + 1;
    
    if (nextIndex >= state.questions.length) {
      // Game over
      return this.endGame(state);
    }

    return {
      ...state,
      phase: "question",
      currentQuestionIndex: nextIndex,
      currentAnswers: []
    };
  }

  /**
   * End the game
   */
  endGame(state: TriviaState): TriviaState {
    return {
      ...state,
      phase: "gameEnd"
    };
  }

  /**
   * Get game end result
   */
  getGameEndResult(state: TriviaState): {
    winnerId: string | null;
    winnerIds: string[];
    isDraw: boolean;
    finalScores: Array<{ odUserId: string; displayName: string; score: number }>;
  } {
    const scores = state.players.map(p => p.score);
    const maxScore = Math.max(...scores);
    const winners = state.players.filter(p => p.score === maxScore);
    const isDraw = winners.length > 1;

    return {
      winnerId: isDraw ? null : winners[0]?.odUserId || null,
      winnerIds: winners.map(w => w.odUserId),
      isDraw,
      finalScores: state.players.map(p => ({
        odUserId: p.odUserId,
        displayName: p.displayName,
        score: p.score
      }))
    };
  }

  /**
   * Get state by game ID
   */
  getState(gameId: string): TriviaState | undefined {
    return this.gameStates.get(gameId);
  }

  /**
   * Set state by game ID
   */
  setState(gameId: string, state: TriviaState): void {
    this.gameStates.set(gameId, state);
  }

  /**
   * Delete state by game ID
   */
  deleteState(gameId: string): void {
    this.gameStates.delete(gameId);
    this.themeSelections.delete(gameId);
  }

  /**
   * Helper: Shuffle array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
