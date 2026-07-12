// Catálogo de productos — Lista de precios Mayo 2026
// Catálogo semilla (se carga a Supabase la primera vez). La fuente de verdad pasa a ser la tabla "productos".
const PRODUCTOS_SEED = [
  // ADOQUÍN
  {codigo:'PBCADCRV8G',  nombre:'Adoquín Cruz Vehicular Gris',               medidas:'a=23 b=25 h=8 cm',   unidad:'UD', peso:8.1,  iva:'NO', lista:5510,    minimo:4724,    grupo:'Adoquín'},
  {codigo:'PBBCARPG04',  nombre:'Adoquín Peatonal h=4cm Gris',               medidas:'a=20 b=10 h=4 cm',   unidad:'UD', peso:1.66, iva:'NO', lista:950,     minimo:860,     grupo:'Adoquín'},
  {codigo:'PBBCARPN04',  nombre:'Adoquín Peatonal h=4cm Negro',              medidas:'a=20 b=10 h=4 cm',   unidad:'UD', peso:1.66, iva:'NO', lista:1220,    minimo:1100,    grupo:'Adoquín'},
  {codigo:'PBBCARPO04',  nombre:'Adoquín Peatonal h=4cm Ocre',               medidas:'a=20 b=10 h=4 cm',   unidad:'UD', peso:1.66, iva:'NO', lista:1130,    minimo:1020,    grupo:'Adoquín'},
  {codigo:'PBBCARPR04',  nombre:'Adoquín Peatonal h=4cm Rojo',               medidas:'a=20 b=10 h=4 cm',   unidad:'UD', peso:1.66, iva:'NO', lista:1220,    minimo:1100,    grupo:'Adoquín'},
  {codigo:'PBCADREP6G',  nombre:'Adoquín Peatonal h=6cm Gris',               medidas:'a=20 b=10 h=6 cm',   unidad:'UD', peso:2.70, iva:'NO', lista:1170,    minimo:1060,    grupo:'Adoquín'},
  {codigo:'PBBCARPN06',  nombre:'Adoquín Peatonal h=6cm Negro',              medidas:'a=20 b=10 h=6 cm',   unidad:'UD', peso:2.70, iva:'NO', lista:1570,    minimo:1420,    grupo:'Adoquín'},
  {codigo:'PBCADREP6O',  nombre:'Adoquín Peatonal h=6cm Ocre',               medidas:'a=20 b=10 h=6 cm',   unidad:'UD', peso:2.70, iva:'NO', lista:1440,    minimo:1300,    grupo:'Adoquín'},
  {codigo:'PBBCARPR06',  nombre:'Adoquín Peatonal h=6cm Rojo',               medidas:'a=20 b=10 h=6 cm',   unidad:'UD', peso:2.70, iva:'NO', lista:1570,    minimo:1420,    grupo:'Adoquín'},
  {codigo:'PBCADREP6S',  nombre:'Adoquín Peatonal h=6cm Salmón',             medidas:'a=20 b=10 h=6 cm',   unidad:'UD', peso:2.70, iva:'NO', lista:1570,    minimo:1420,    grupo:'Adoquín'},
  {codigo:'PBCADRP6GO',  nombre:'Adoquín Peatonal h=6cm Gris Oscuro',        medidas:'a=20 b=10 h=6 cm',   unidad:'UD', peso:2.70, iva:'NO', lista:1570,    minimo:1420,    grupo:'Adoquín'},
  {codigo:'PBCADREV8G',  nombre:'Adoquín Vehicular h=8cm Gris',              medidas:'a=20 b=10 h=8 cm',   unidad:'UD', peso:3.31, iva:'NO', lista:1410,    minimo:1270,    grupo:'Adoquín'},
  {codigo:'PBBCARVN08',  nombre:'Adoquín Vehicular h=8cm Negro',             medidas:'a=20 b=10 h=8 cm',   unidad:'UD', peso:3.31, iva:'NO', lista:1960,    minimo:1770,    grupo:'Adoquín'},
  {codigo:'PBCADREV8O',  nombre:'Adoquín Vehicular h=8cm Ocre',              medidas:'a=20 b=10 h=8 cm',   unidad:'UD', peso:3.31, iva:'NO', lista:1790,    minimo:1610,    grupo:'Adoquín'},
  {codigo:'PBCADREV8R',  nombre:'Adoquín Vehicular h=8cm Rojo',              medidas:'a=20 b=10 h=8 cm',   unidad:'UD', peso:3.31, iva:'NO', lista:1960,    minimo:1770,    grupo:'Adoquín'},
  {codigo:'PBBCARVG10',  nombre:'Adoquín Vehicular h=10cm Gris',             medidas:'a=20 b=10 h=10 cm',  unidad:'UD', peso:4.2,  iva:'NO', lista:1560,    minimo:1410,    grupo:'Adoquín'},
  {codigo:'PBBCARVN10',  nombre:'Adoquín Vehicular h=10cm Negro',            medidas:'a=20 b=10 h=10 cm',  unidad:'UD', peso:4.2,  iva:'NO', lista:2100,    minimo:1950,    grupo:'Adoquín'},
  {codigo:'PBBCARVO10',  nombre:'Adoquín Vehicular h=10cm Ocre',             medidas:'a=20 b=10 h=10 cm',  unidad:'UD', peso:4.2,  iva:'NO', lista:2100,    minimo:1950,    grupo:'Adoquín'},
  {codigo:'PBBCARVR10',  nombre:'Adoquín Vehicular h=10cm Rojo',             medidas:'a=20 b=10 h=10 cm',  unidad:'UD', peso:4.2,  iva:'NO', lista:2100,    minimo:1950,    grupo:'Adoquín'},
  // ALFAJÍA
  {codigo:'PALFM12A19',  nombre:'Alfajía M12 cm',                            medidas:'a=19 b=100 h=6.5 cm',unidad:'UD', peso:17.3, iva:'SI', lista:40590,   minimo:34790,   grupo:'Alfajía'},
  {codigo:'PALFM14A21',  nombre:'Alfajía M14 cm',                            medidas:'a=21 b=100 h=6.8 cm',unidad:'UD', peso:19.7, iva:'SI', lista:41250,   minimo:35360,   grupo:'Alfajía'},
  {codigo:'PALFM20A27',  nombre:'Alfajía M20 cm',                            medidas:'a=27 b=100 h=8.1 cm',unidad:'UD', peso:27.1, iva:'SI', lista:43410,   minimo:37207,   grupo:'Alfajía'},
  {codigo:'PALF12AGU1',  nombre:'Alfajía M12 Un Agua',                       medidas:'a=23 b=100 cm',      unidad:'UD', peso:27.5, iva:'SI', lista:41490,   minimo:38301,   grupo:'Alfajía'},
  {codigo:'PALF1AG18',   nombre:'Alfajía M12 Un Agua (18cm)',                medidas:'a=18 b=100 cm',      unidad:'UD', peso:25.2, iva:'SI', lista:40370,   minimo:37264,   grupo:'Alfajía'},
  // BANCA
  {codigo:'PBAINTD30G',  nombre:'Banca Individual Tipo Dado Gris',           medidas:'a=40 b=40 h=30 cm',  unidad:'UD', peso:155,  iva:'SI', lista:210280,  minimo:180241,  grupo:'Banca'},
  {codigo:'PBANCCP3PM',  nombre:'Banca Concreto Pulido Tres Piezas Maciza',  medidas:'a=42 L=150 H=69.5 cm',unidad:'UD',peso:286.6,iva:'SI', lista:496250,  minimo:425361,  grupo:'Banca'},
  {codigo:'PBANCCP3PP',  nombre:'Banca Concreto Pulido Tres Piezas Perf.',   medidas:'a=50 L=150 H=85 cm', unidad:'UD', peso:243.8,iva:'SI', lista:457070,  minimo:391777,  grupo:'Banca'},
  {codigo:'PBASEBA150',  nombre:'Base para Banca 150',                       medidas:'a=30 b=150 h=35 cm', unidad:'UD', peso:270,  iva:'SI', lista:572140,  minimo:490404,  grupo:'Banca'},
  {codigo:'PBANEBA150',  nombre:'Banca para Base 150',                       medidas:'a=45 b=150 e=8 cm',  unidad:'UD', peso:150,  iva:'SI', lista:424310,  minimo:363697,  grupo:'Banca'},
  {codigo:'PBANCINDTC',  nombre:'Banca Individual Tipo C',                   medidas:'a=42 b=45 h=50 cm',  unidad:'UD', peso:132.5,iva:'SI', lista:227590,  minimo:195078,  grupo:'Banca'},
  {codigo:'PBAINTDM6G',  nombre:'Banca Individual Dado Malla 6mm Gris',      medidas:'a=40 b=40 h=30 cm',  unidad:'UD', peso:155,  iva:'SI', lista:198920,  minimo:184708,  grupo:'Banca'},
  // BARRERA
  {codigo:'PJERBIDH80',  nombre:'Barrera Jersey Bidireccional H80',          medidas:'a1=15 a2=60 h=80 L=200 cm',unidad:'UD',peso:1260,iva:'SI',lista:826590, minimo:708509, grupo:'Barrera'},
  {codigo:'PNEWJERH80',  nombre:'Barrera New Jersey A-60 B80 H-80',          medidas:'h=80 cm',            unidad:'UD', peso:432,  iva:'SI', lista:478310,  minimo:409980,  grupo:'Barrera'},
  // BLOQUE MAMPOSTERÍA
  {codigo:'PBBE0908MP',  nombre:'Bloque Estructural 9cm (8 MPa)',            medidas:'a=9 b=40 h=20 cm',   unidad:'UD', peso:9,    iva:'NO', lista:2510,    minimo:2200,    grupo:'Bloque'},
  {codigo:'PBBE0910MP',  nombre:'Bloque Estructural 9cm (10 MPa)',           medidas:'a=9 b=40 h=20 cm',   unidad:'UD', peso:9,    iva:'NO', lista:2620,    minimo:2290,    grupo:'Bloque'},
  {codigo:'PBBCEG0913',  nombre:'Bloque Estructural 9cm (13 MPa)',           medidas:'a=9 b=40 h=20 cm',   unidad:'UD', peso:9,    iva:'NO', lista:2720,    minimo:2380,    grupo:'Bloque'},
  {codigo:'PBBE1208MP',  nombre:'Bloque Estructural 12cm (8 MPa)',           medidas:'a=12 b=40 h=20 cm',  unidad:'UD', peso:12,   iva:'NO', lista:3280,    minimo:2870,    grupo:'Bloque'},
  {codigo:'PBBE1210MP',  nombre:'Bloque Estructural 12cm (10 MPa)',          medidas:'a=12 b=40 h=20 cm',  unidad:'UD', peso:12,   iva:'NO', lista:3420,    minimo:2990,    grupo:'Bloque'},
  {codigo:'PBBE1213MP',  nombre:'Bloque Estructural 12cm (13 MPa)',          medidas:'a=12 b=40 h=20 cm',  unidad:'UD', peso:12,   iva:'NO', lista:3560,    minimo:3120,    grupo:'Bloque'},
  {codigo:'PBBECATM20',  nombre:'Bloque Estructural Catalán 12cm',           medidas:'a=12 b=40 h=10 cm',  unidad:'UD', peso:12,   iva:'NO', lista:5950,    minimo:5099,    grupo:'Bloque'},
  {codigo:'PBBE1408MP',  nombre:'Bloque Estructural 14cm (8 MPa)',           medidas:'a=14 b=40 h=20 cm',  unidad:'UD', peso:14,   iva:'NO', lista:3910,    minimo:3420,    grupo:'Bloque'},
  {codigo:'PBBCEG1410',  nombre:'Bloque Estructural 14cm (10 MPa)',          medidas:'a=14 b=40 h=20 cm',  unidad:'UD', peso:14,   iva:'NO', lista:4080,    minimo:3570,    grupo:'Bloque'},
  {codigo:'PBBCEG1413',  nombre:'Bloque Estructural 14cm (13 MPa)',          medidas:'a=14 b=40 h=20 cm',  unidad:'UD', peso:14,   iva:'NO', lista:4240,    minimo:3710,    grupo:'Bloque'},
  {codigo:'PBBE1908MP',  nombre:'Bloque Estructural 19cm (8 MPa)',           medidas:'a=19 b=40 h=20 cm',  unidad:'UD', peso:18,   iva:'NO', lista:5170,    minimo:4520,    grupo:'Bloque'},
  {codigo:'PBBE19M08M',  nombre:'Bloque Estructural Medio 19cm (8 MPa)',     medidas:'a=19 b=20 h=20 cm',  unidad:'UD', peso:9.5,  iva:'NO', lista:3640,    minimo:3120,    grupo:'Bloque'},
  {codigo:'PBBE1910MP',  nombre:'Bloque Estructural 19cm (10 MPa)',          medidas:'a=19 b=40 h=20 cm',  unidad:'UD', peso:18,   iva:'NO', lista:5380,    minimo:4710,    grupo:'Bloque'},
  {codigo:'PBBE1913MP',  nombre:'Bloque Estructural 19cm (13 MPa)',          medidas:'a=19 b=40 h=20 cm',  unidad:'UD', peso:18,   iva:'NO', lista:5600,    minimo:4900,    grupo:'Bloque'},
  {codigo:'PBEF193908',  nombre:'Bloque Estructural Contra Fuego 19cm (8 MPa)',medidas:'a=19 b=39 h=19 cm',unidad:'UD', peso:18,   iva:'NO', lista:6540,    minimo:5603,    grupo:'Bloque'},
  {codigo:'PBBE12M08M',  nombre:'Bloque Estructural Medio 12cm (8 MPa)',     medidas:'a=12 b=20 h=20 cm',  unidad:'UD', peso:6,    iva:'NO', lista:2150,    minimo:1847,    grupo:'Bloque'},
  {codigo:'PBBSPLI14G',  nombre:'Bloque Split Gris (8 MPa)',                 medidas:'a=14 b=40 h=20 cm',  unidad:'UD', peso:14,   iva:'NO', lista:4850,    minimo:4240,    grupo:'Bloque'},
  {codigo:'PTBBCS1410',  nombre:'Bloque Split Gris (10 MPa)',                medidas:'a=14 b=40 h=20 cm',  unidad:'UD', peso:14,   iva:'NO', lista:5030,    minimo:4410,    grupo:'Bloque'},
  {codigo:'PBBSP1413G',  nombre:'Bloque Split Gris (13 MPa)',                medidas:'a=14 b=40 h=20 cm',  unidad:'UD', peso:14,   iva:'NO', lista:5220,    minimo:4570,    grupo:'Bloque'},
  {codigo:'PBBVIG098MP', nombre:'Bloque Viga 9cm (8 MPa)',                   medidas:'a=9 b=40 h=20 cm',   unidad:'UD', peso:9,    iva:'NO', lista:4990,    minimo:4276,    grupo:'Bloque'},
  {codigo:'PBBVIG128MP', nombre:'Bloque Viga 12cm (8 MPa)',                  medidas:'a=12 b=40 h=20 cm',  unidad:'UD', peso:12,   iva:'NO', lista:8860,    minimo:7597,    grupo:'Bloque'},
  {codigo:'PBBCMUTA20',  nombre:'Bloque Muro Tierra Armada',                 medidas:'a=33 b=41 h=20 cm',  unidad:'UD', peso:25,   iva:'NO', lista:18580,   minimo:15929,   grupo:'Bloque'},
  {codigo:'PBBSPDC14G',  nombre:'Bloque Split Doble Cara Gris',              medidas:'a=14 b=40 h=20 cm',  unidad:'UD', peso:14,   iva:'NO', lista:6620,    minimo:5674,    grupo:'Bloque'},
  // BOLARDO
  {codigo:'PBOLABUCIL',  nombre:'Bolardo Abujardado Cilíndrico',             medidas:'d=18 h=80 cm',       unidad:'UD', peso:48.9, iva:'SI', lista:92440,   minimo:79238,   grupo:'Bolardo'},
  {codigo:'PBOLPIRAMI',  nombre:'Bolardo Tipo Piramidal',                    medidas:'a=33 b=33 h=41 cm',  unidad:'UD', peso:38.1, iva:'NO', lista:35410,   minimo:30355,   grupo:'Bolardo'},
  {codigo:'PBOLESFERA',  nombre:'Bolardo Tipo Esférico',                     medidas:'r=19 h=39 cm',       unidad:'UD', peso:70.7, iva:'SI', lista:124580,  minimo:115684,  grupo:'Bolardo'},
  {codigo:'PBOLABUTRI',  nombre:'Bolardo Abujardado Triangular',             medidas:'d=18 h=80 cm',       unidad:'UD', peso:67,   iva:'SI', lista:120390,  minimo:111794,  grupo:'Bolardo'},
  // BORDILLO
  {codigo:'PBBORCUN35',  nombre:'Bordillo Cuneta',                           medidas:'a=50 b=60 h=35 cm',  unidad:'UD', peso:133,  iva:'NO', lista:75410,   minimo:65980,   grupo:'Bordillo'},
  {codigo:'PBBORSAA10',  nombre:'Bordillo Sardinel A-10 H-50',               medidas:'a=20 b=80 h=50 cm',  unidad:'UD', peso:130,  iva:'NO', lista:70750,   minimo:61910,   grupo:'Bordillo'},
  {codigo:'PBBORSAR45',  nombre:'Bordillo Sardinel H-45',                    medidas:'a=15 b=80 h=45 cm',  unidad:'UD', peso:106,  iva:'NO', lista:54350,   minimo:47560,   grupo:'Bordillo'},
  {codigo:'PBBORCON35',  nombre:'Bordillo Confinamiento H-35',               medidas:'a=15 b=80 h=35 cm',  unidad:'UD', peso:81,   iva:'NO', lista:44690,   minimo:39100,   grupo:'Bordillo'},
  {codigo:'PBBORSAR35',  nombre:'Bordillo Sardinel H-35',                    medidas:'a=15 b=100 h=35 cm', unidad:'UD', peso:104,  iva:'NO', lista:53770,   minimo:47050,   grupo:'Bordillo'},
  {codigo:'PBBORCON20',  nombre:'Bordillo Confinamiento Andén H-20',         medidas:'a=10 b=100 h=20 cm', unidad:'UD', peso:49,   iva:'NO', lista:28590,   minimo:25010,   grupo:'Bordillo'},
  {codigo:'PBBORTAB20',  nombre:'Bordillo Tabaco',                           medidas:'a=20 b=100 h=20 cm', unidad:'UD', peso:46,   iva:'NO', lista:50060,   minimo:42910,   grupo:'Bordillo'},
  {codigo:'PBBOSAR45M',  nombre:'Bordillo Sardinel Medio H-45',              medidas:'a=15 b=40 h=45 cm',  unidad:'UD', peso:58.5, iva:'NO', lista:36900,   minimo:31626,   grupo:'Bordillo'},
  {codigo:'PBCBEC40CM',  nombre:'Bordillo Especial Canal',                   medidas:'a=35 b=49 h=40 cm',  unidad:'UD', peso:120,  iva:'SI', lista:72960,   minimo:62540,   grupo:'Bordillo'},
  {codigo:'PBBCBORSEP',  nombre:'Bordillo Separador',                        medidas:'a=23 b=100 h=60 cm', unidad:'UD', peso:164.7,iva:'NO', lista:119460,  minimo:102393,  grupo:'Bordillo'},
  // BOVEDILLA
  {codigo:'PBBOVTARCO',  nombre:'Bovedilla Tipo Arco',                       medidas:'h=10 cm',            unidad:'UD', peso:10.2, iva:'NO', lista:3050,    minimo:2616,    grupo:'Bovedilla'},
  {codigo:'PBBOVEDH10',  nombre:'Bovedilla H10',                             medidas:'h=10 cm',            unidad:'UD', peso:15.85,iva:'NO', lista:4600,    minimo:4030,    grupo:'Bovedilla'},
  // BOX CULVERT
  {codigo:'PBOXCUL700',  nombre:'Box Culvert Prefabricado 700',              medidas:'a1=200 h1=270 L=60 cm',unidad:'UD',peso:3200, iva:'SI', lista:4703750, minimo:4031784, grupo:'Box Culvert'},
  {codigo:'PBOXCULPT2',  nombre:'Box Culvert Prefabricado PT2',              medidas:'a1=170 h1=140 cm',   unidad:'UD', peso:3600, iva:'SI', lista:5222920, minimo:4476789, grupo:'Box Culvert'},
  {codigo:'PLLACOREBC',  nombre:'Llave en Concreto para Box Culvert',        medidas:'',                   unidad:'UD', peso:0,    iva:'SI', lista:857640,  minimo:735120,  grupo:'Box Culvert'},
  // CALADO
  {codigo:'PBCCALRECG',  nombre:'Calado Rectangular Gris (8 MPa)',           medidas:'a=20 b=19 h=14 cm',  unidad:'UD', peso:5.5,  iva:'NO', lista:4370,    minimo:3743,    grupo:'Calado'},
  {codigo:'PBCCALCIRG',  nombre:'Calado Circular Gris (8 MPa)',              medidas:'a=19 b=19 h=14 cm',  unidad:'UD', peso:6.2,  iva:'NO', lista:4390,    minimo:4075,    grupo:'Calado'},
  // CIMIENTO
  {codigo:'PCIMPAN8CM',  nombre:'Cimiento para Panel 8cm',                   medidas:'',                   unidad:'UD', peso:230.4,iva:'SI', lista:162920,  minimo:139646,  grupo:'Cimiento'},
  {codigo:'PCIMPAN4CM',  nombre:'Cimiento para Panel 4cm',                   medidas:'',                   unidad:'UD', peso:174.4,iva:'SI', lista:121080,  minimo:103781,  grupo:'Cimiento'},
  {codigo:'PPECPANELS',  nombre:'Base Prefabricada para Paneles Solares',    medidas:'',                   unidad:'UD', peso:78,   iva:'SI', lista:190100,  minimo:162941,  grupo:'Cimiento'},
  {codigo:'PBAC602017',  nombre:'Bloque Anclaje Concreto',                   medidas:'a=20 b=60 h=17 cm',  unidad:'UD', peso:39.2, iva:'SI', lista:89230,   minimo:76482,   grupo:'Cimiento'},
  {codigo:'PTZAPATATT',  nombre:'Zapata Tipo T',                             medidas:'A1=90 B1=90 H1=25 cm',unidad:'UD',peso:667.4,iva:'SI', lista:553600,  minimo:474512,  grupo:'Cimiento'},
  {codigo:'PBBDADOPF1',  nombre:'Dado Perforado Cimiento',                   medidas:'a=30 b=30 h=30 cm',  unidad:'UD', peso:60,   iva:'NO', lista:49280,   minimo:45758,   grupo:'Cimiento'},
  {codigo:'PPECPANSIN',  nombre:'Base Paneles Solares Sin Platina',          medidas:'',                   unidad:'UD', peso:76,   iva:'SI', lista:139730,  minimo:129746,  grupo:'Cimiento'},
  // CUNETA
  {codigo:'PBBCUNEU35',  nombre:'Cuneta en U',                               medidas:'a=35 b=80 h=15 cm',  unidad:'UD', peso:72,   iva:'NO', lista:61420,   minimo:56695,   grupo:'Cuneta'},
  // DURMIENTE
  {codigo:'PDURMTRO27',  nombre:'Durmiente Traviesa Trocha 27"',             medidas:'',                   unidad:'UD', peso:70,   iva:'SI', lista:258450,  minimo:221527,  grupo:'Durmiente'},
  {codigo:'PDURMTRO32',  nombre:'Durmiente Traviesa Trocha 32"',             medidas:'',                   unidad:'UD', peso:70,   iva:'SI', lista:258450,  minimo:221527,  grupo:'Durmiente'},
  {codigo:'PDURMTRO76',  nombre:'Durmiente Traviesa Trocha 76"',             medidas:'',                   unidad:'UD', peso:207,  iva:'SI', lista:213320,  minimo:198080,  grupo:'Durmiente'},
  // GRAMOQUIN
  {codigo:'PBCGRAMV8G',  nombre:'Gramoquín Vehicular h=8cm Gris',            medidas:'a=29 b=43 h=8 cm',   unidad:'UD', peso:17,   iva:'NO', lista:9660,    minimo:8284,    grupo:'Gramoquín'},
  {codigo:'PBCGRAM10G',  nombre:'Gramoquín Vehicular h=10cm Gris',           medidas:'a=29 b=43 h=10 cm',  unidad:'UD', peso:19.5, iva:'NO', lista:10790,   minimo:9250,    grupo:'Gramoquín'},
  {codigo:'PBCGRAMV12',  nombre:'Gramoquín Vehicular 20x20 h=12cm Gris',     medidas:'a=20 b=20 h=12 cm',  unidad:'UD', peso:null, iva:'NO', lista:3880,    minimo:3500,    grupo:'Gramoquín'},
  {codigo:'PBCGRAV12N',  nombre:'Gramoquín Vehicular 20x20 h=12cm Negro',    medidas:'a=20 b=20 h=12 cm',  unidad:'UD', peso:null, iva:'NO', lista:5030,    minimo:4550,    grupo:'Gramoquín'},
  {codigo:'PBCGRAV12O',  nombre:'Gramoquín Vehicular 20x20 h=12cm Ocre',     medidas:'a=20 b=20 h=12 cm',  unidad:'UD', peso:null, iva:'NO', lista:4660,    minimo:4210,    grupo:'Gramoquín'},
  {codigo:'PBCGRAV12R',  nombre:'Gramoquín Vehicular 20x20 h=12cm Rojo',     medidas:'a=20 b=20 h=12 cm',  unidad:'UD', peso:null, iva:'NO', lista:5030,    minimo:4550,    grupo:'Gramoquín'},
  // JARDINERA / MATERO
  {codigo:'PJARTIPOC0',  nombre:'Jardinera Tipo C',                          medidas:'',                   unidad:'UD', peso:246,  iva:'SI', lista:1913770, minimo:1640373, grupo:'Jardinera'},
  {codigo:'PJARTIPOB0',  nombre:'Jardinera Tipo B',                          medidas:'',                   unidad:'UD', peso:240,  iva:'SI', lista:2237020, minimo:1917447, grupo:'Jardinera'},
  {codigo:'PMATRECT83',  nombre:'Matero Rectangular',                        medidas:'a=30 b=49 h=83 cm',  unidad:'UD', peso:122,  iva:'SI', lista:398640,  minimo:341689,  grupo:'Jardinera'},
  {codigo:'PMATCUAD43',  nombre:'Matero Cuadrado',                           medidas:'a=45 b=49 h=43 cm',  unidad:'UD', peso:99,   iva:'SI', lista:364170,  minimo:312142,  grupo:'Jardinera'},
  // MURO CONTENCIÓN
  {codigo:'PMUROCOTPA',  nombre:'Muro Contención Pretensado A=100cm Tipo A', medidas:'a=100 h=20 L=745 cm',unidad:'UD', peso:3576, iva:'SI', lista:6387010, minimo:5474582, grupo:'Muro Contención'},
  {codigo:'PMUROCOTPB',  nombre:'Muro Contención Pretensado A=100cm Tipo B', medidas:'a=100 h=20 L=707 cm',unidad:'UD', peso:3393.6,iva:'SI',lista:6256830, minimo:5362994, grupo:'Muro Contención'},
  {codigo:'PMURO50TPA',  nombre:'Muro Contención Pretensado A=50cm Tipo A',  medidas:'a=50 h=20 L=745 cm', unidad:'UD', peso:1788, iva:'SI', lista:3002110, minimo:2787672, grupo:'Muro Contención'},
  {codigo:'PMURO50TPB',  nombre:'Muro Contención Pretensado A=50cm Tipo B',  medidas:'a=50 h=20 L=707 cm', unidad:'UD', peso:1696.8,iva:'SI',lista:2960170, minimo:2748727, grupo:'Muro Contención'},
  // PANEL PRETENSADO
  {codigo:'PPAPR3H4CM',  nombre:'Panel Pretensado Casa 4cm',                 medidas:'a=50 h=4 cm',        unidad:'M2', peso:51.6, iva:'SI', lista:36140,   minimo:33730,   grupo:'Panel Pretensado'},
  // PASO
  {codigo:'PPP294GA30',  nombre:'Paso Pretensado Abujardado 30cm',           medidas:'L=294 a=30 cm',      unidad:'UD', peso:211.7,iva:'SI', lista:1275810, minimo:1093553, grupo:'Paso'},
  {codigo:'PPP294GA50',  nombre:'Paso Pretensado Abujardado 50cm',           medidas:'L=294 a=50 cm',      unidad:'UD', peso:352.8,iva:'SI', lista:1309850, minimo:1122729, grupo:'Paso'},
  {codigo:'PPASOSP100',  nombre:'Paso Prefabricado 1.0m',                    medidas:'a=0.3 b=1.0 cm',     unidad:'UD', peso:55.4, iva:'SI', lista:168250,  minimo:156236,  grupo:'Paso'},
  {codigo:'PPASOPREFL',  nombre:'Paso Prefabricado en L',                    medidas:'a=125 b=34 h=14 cm', unidad:'UD', peso:72.9, iva:'SI', lista:127330,  minimo:118231,  grupo:'Paso'},
  // PLACA
  {codigo:'PPLAHLLA10',  nombre:'Placa Huella Prefabricada',                 medidas:'a=90 b=49 h=10 cm',  unidad:'UD', peso:105,  iva:'SI', lista:108184,  minimo:102776,  grupo:'Placa'},
  {codigo:'PPLCAPREH8',  nombre:'Placa Pretensada 5 Hilos A=50cm H=8cm',    medidas:'a=50 h=8 b=96 cm',   unidad:'UD', peso:95,   iva:'SI', lista:62770,   minimo:58291,   grupo:'Placa'},
  // PLAQUETA PEATONAL 40cm
  {codigo:'PBCPLAA40G',  nombre:'Plaqueta Peatonal 40x40 Abujardada Gris',   medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:29230,   minimo:25050,   grupo:'Plaqueta'},
  {codigo:'PBCPLAA40N',  nombre:'Plaqueta Peatonal 40x40 Abujardada Negra',  medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:32100,   minimo:27513,   grupo:'Plaqueta'},
  {codigo:'PBCPLAA40O',  nombre:'Plaqueta Peatonal 40x40 Abujardada Ocre',   medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:31180,   minimo:26728,   grupo:'Plaqueta'},
  {codigo:'PBCPLAA40R',  nombre:'Plaqueta Peatonal 40x40 Abujardada Roja',   medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:32100,   minimo:27513,   grupo:'Plaqueta'},
  {codigo:'PBCPLAE40G',  nombre:'Plaqueta Peatonal 40x40 Estriada Gris',     medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:23150,   minimo:19845,   grupo:'Plaqueta'},
  {codigo:'PBCPLAE40N',  nombre:'Plaqueta Peatonal 40x40 Estriada Negra',    medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:26030,   minimo:22308,   grupo:'Plaqueta'},
  {codigo:'PBCPLAE40O',  nombre:'Plaqueta Peatonal 40x40 Estriada Ocre',     medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:25110,   minimo:21523,   grupo:'Plaqueta'},
  {codigo:'PBCPLAE40R',  nombre:'Plaqueta Peatonal 40x40 Estriada Roja',     medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:26030,   minimo:22308,   grupo:'Plaqueta'},
  {codigo:'PBCPLAL40G',  nombre:'Plaqueta Peatonal 40x40 Lisa Gris',         medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:23150,   minimo:19845,   grupo:'Plaqueta'},
  {codigo:'PBCPLAL40N',  nombre:'Plaqueta Peatonal 40x40 Lisa Negra',        medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:26030,   minimo:22308,   grupo:'Plaqueta'},
  {codigo:'PBCPLAL40O',  nombre:'Plaqueta Peatonal 40x40 Lisa Ocre',         medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:25110,   minimo:21523,   grupo:'Plaqueta'},
  {codigo:'PBCPLAL40R',  nombre:'Plaqueta Peatonal 40x40 Lisa Roja',         medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:26030,   minimo:22308,   grupo:'Plaqueta'},
  {codigo:'PBCPLAT40G',  nombre:'Plaqueta Peatonal 40x40 Toperol Gris',      medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:23150,   minimo:19845,   grupo:'Plaqueta'},
  {codigo:'PBCPLAT40N',  nombre:'Plaqueta Peatonal 40x40 Toperol Negra',     medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:26030,   minimo:22308,   grupo:'Plaqueta'},
  {codigo:'PBCPLAT40O',  nombre:'Plaqueta Peatonal 40x40 Toperol Ocre',      medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:25110,   minimo:21523,   grupo:'Plaqueta'},
  {codigo:'PBCPLAT40R',  nombre:'Plaqueta Peatonal 40x40 Toperol Roja',      medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:26030,   minimo:22308,   grupo:'Plaqueta'},
  {codigo:'PBCPLAG40G',  nombre:'Plaqueta Peatonal 40x40 Guía Gris',         medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:23150,   minimo:19845,   grupo:'Plaqueta'},
  {codigo:'PBCPLAG40N',  nombre:'Plaqueta Peatonal 40x40 Guía Negra',        medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:26030,   minimo:22308,   grupo:'Plaqueta'},
  {codigo:'PBCPLAG40O',  nombre:'Plaqueta Peatonal 40x40 Guía Ocre',         medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:25110,   minimo:21523,   grupo:'Plaqueta'},
  {codigo:'PBCPLAG40R',  nombre:'Plaqueta Peatonal 40x40 Guía Roja',         medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'NO', lista:26030,   minimo:22308,   grupo:'Plaqueta'},
  // PLAQUETA PEATONAL 50cm
  {codigo:'PBCPLAA50G',  nombre:'Plaqueta Peatonal 50x50 Abujardada Gris',   medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:37790,   minimo:32393,   grupo:'Plaqueta'},
  {codigo:'PBCPLAA50N',  nombre:'Plaqueta Peatonal 50x50 Abujardada Negra',  medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:42280,   minimo:36240,   grupo:'Plaqueta'},
  {codigo:'PBCPLAA50O',  nombre:'Plaqueta Peatonal 50x50 Abujardada Ocre',   medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:40850,   minimo:35014,   grupo:'Plaqueta'},
  {codigo:'PBCPLAA50R',  nombre:'Plaqueta Peatonal 50x50 Abujardada Roja',   medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:42280,   minimo:36240,   grupo:'Plaqueta'},
  {codigo:'PBCPLAE50G',  nombre:'Plaqueta Peatonal 50x50 Estriada Gris',     medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:29150,   minimo:24987,   grupo:'Plaqueta'},
  {codigo:'PBCPLAE50N',  nombre:'Plaqueta Peatonal 50x50 Estriada Negra',    medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:33640,   minimo:28835,   grupo:'Plaqueta'},
  {codigo:'PBCPLAE50O',  nombre:'Plaqueta Peatonal 50x50 Estriada Ocre',     medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:32210,   minimo:27608,   grupo:'Plaqueta'},
  {codigo:'PBCPLAE50R',  nombre:'Plaqueta Peatonal 50x50 Estriada Roja',     medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:33640,   minimo:28835,   grupo:'Plaqueta'},
  {codigo:'PBCPLAT50G',  nombre:'Plaqueta Peatonal 50x50 Toperol Gris',      medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:29150,   minimo:24987,   grupo:'Plaqueta'},
  {codigo:'PBCPLAT50N',  nombre:'Plaqueta Peatonal 50x50 Toperol Negra',     medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:33640,   minimo:28835,   grupo:'Plaqueta'},
  {codigo:'PBCPLAT50O',  nombre:'Plaqueta Peatonal 50x50 Toperol Ocre',      medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:32210,   minimo:27608,   grupo:'Plaqueta'},
  {codigo:'PBCPLAT50R',  nombre:'Plaqueta Peatonal 50x50 Toperol Roja',      medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:33640,   minimo:28835,   grupo:'Plaqueta'},
  {codigo:'PBCPLAG50G',  nombre:'Plaqueta Peatonal 50x50 Guía Gris',         medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:29150,   minimo:24987,   grupo:'Plaqueta'},
  {codigo:'PBCPLAG50N',  nombre:'Plaqueta Peatonal 50x50 Guía Negra',        medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:33640,   minimo:28835,   grupo:'Plaqueta'},
  {codigo:'PBCPLAG50O',  nombre:'Plaqueta Peatonal 50x50 Guía Ocre',         medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:32210,   minimo:27608,   grupo:'Plaqueta'},
  {codigo:'PBCPLAG50R',  nombre:'Plaqueta Peatonal 50x50 Guía Roja',         medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:33640,   minimo:28835,   grupo:'Plaqueta'},
  {codigo:'PBCPLAL50G',  nombre:'Plaqueta Peatonal 50x50 Lisa Gris',         medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:29150,   minimo:24987,   grupo:'Plaqueta'},
  {codigo:'PBCPLAL50N',  nombre:'Plaqueta Peatonal 50x50 Lisa Negra',        medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:33640,   minimo:28835,   grupo:'Plaqueta'},
  {codigo:'PBCPLAL50O',  nombre:'Plaqueta Peatonal 50x50 Lisa Ocre',         medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:32210,   minimo:27608,   grupo:'Plaqueta'},
  {codigo:'PBCPLAL50R',  nombre:'Plaqueta Peatonal 50x50 Lisa Roja',         medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'NO', lista:33640,   minimo:28835,   grupo:'Plaqueta'},
  // PLAQUETA VEHICULAR 40cm
  {codigo:'PPLAVEA40G',  nombre:'Plaqueta Vehicular 40x40 Abujardada Gris',  medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'SI', lista:32780,   minimo:28094,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEA40N',  nombre:'Plaqueta Vehicular 40x40 Abujardada Negra', medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'SI', lista:35190,   minimo:30164,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEA40O',  nombre:'Plaqueta Vehicular 40x40 Abujardada Ocre',  medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'SI', lista:34420,   minimo:29504,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEA40R',  nombre:'Plaqueta Vehicular 40x40 Abujardada Roja',  medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'SI', lista:35190,   minimo:30164,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEE40G',  nombre:'Plaqueta Vehicular 40x40 Estriada Gris',    medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'SI', lista:26730,   minimo:22910,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEE40N',  nombre:'Plaqueta Vehicular 40x40 Estriada Negra',   medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'SI', lista:29140,   minimo:24980,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEE40O',  nombre:'Plaqueta Vehicular 40x40 Estriada Ocre',    medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'SI', lista:28370,   minimo:24320,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEE40R',  nombre:'Plaqueta Vehicular 40x40 Estriada Roja',    medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'SI', lista:29140,   minimo:24980,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEL40G',  nombre:'Plaqueta Vehicular 40x40 Lisa Gris',        medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'SI', lista:26730,   minimo:22910,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEL40N',  nombre:'Plaqueta Vehicular 40x40 Lisa Negra',       medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'SI', lista:29140,   minimo:24980,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEL40O',  nombre:'Plaqueta Vehicular 40x40 Lisa Ocre',        medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'SI', lista:28370,   minimo:24320,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEL40R',  nombre:'Plaqueta Vehicular 40x40 Lisa Roja',        medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'SI', lista:29140,   minimo:24980,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVET40G',  nombre:'Plaqueta Vehicular 40x40 Toperol Gris',     medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'SI', lista:26730,   minimo:22910,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEG40G',  nombre:'Plaqueta Vehicular 40x40 Guía Gris',        medidas:'a=40 b=40 h=6 cm',   unidad:'UD', peso:22.1, iva:'SI', lista:26730,   minimo:22910,   grupo:'Plaqueta Vehicular'},
  // PLAQUETA VEHICULAR 50cm
  {codigo:'PPLAVEA50G',  nombre:'Plaqueta Vehicular 50x50 Abujardada Gris',  medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'SI', lista:41540,   minimo:35609,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEA50N',  nombre:'Plaqueta Vehicular 50x50 Abujardada Negra', medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'SI', lista:45320,   minimo:38842,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEA50O',  nombre:'Plaqueta Vehicular 50x50 Abujardada Ocre',  medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'SI', lista:44110,   minimo:37811,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEA50R',  nombre:'Plaqueta Vehicular 50x50 Abujardada Roja',  medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'SI', lista:45320,   minimo:38842,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEE50G',  nombre:'Plaqueta Vehicular 50x50 Estriada Gris',    medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'SI', lista:34870,   minimo:29886,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEE50O',  nombre:'Plaqueta Vehicular 50x50 Estriada Ocre',    medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'SI', lista:37440,   minimo:32088,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEE50R',  nombre:'Plaqueta Vehicular 50x50 Estriada Roja',    medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'SI', lista:38640,   minimo:33119,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEL50G',  nombre:'Plaqueta Vehicular 50x50 Lisa Gris',        medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'SI', lista:34870,   minimo:29886,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVET50G',  nombre:'Plaqueta Vehicular 50x50 Toperol Gris',     medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'SI', lista:34870,   minimo:29886,   grupo:'Plaqueta Vehicular'},
  {codigo:'PPLAVEG50G',  nombre:'Plaqueta Vehicular 50x50 Guía Gris',        medidas:'a=50 b=50 h=7 cm',   unidad:'UD', peso:42,   iva:'SI', lista:34870,   minimo:29886,   grupo:'Plaqueta Vehicular'},
  // POSTE
  {codigo:'PPOSTCU290',  nombre:'Poste Cerco Curvo 290cm',                   medidas:'a=8 b=10 L=290 cm',  unidad:'UD', peso:56.4, iva:'SI', lista:86500,   minimo:74140,   grupo:'Poste'},
  {codigo:'PPOSTRE150',  nombre:'Poste Cerco Recto 150cm',                   medidas:'a=10 b=10 L=150 cm', unidad:'UD', peso:36,   iva:'SI', lista:66810,   minimo:57267,   grupo:'Poste'},
  {codigo:'PPOSTRE200',  nombre:'Poste Cerco Recto 200cm',                   medidas:'a=10 b=10 L=200 cm', unidad:'UD', peso:48,   iva:'SI', lista:74600,   minimo:63943,   grupo:'Poste'},
  {codigo:'PPOSTRE250',  nombre:'Poste Cerco Recto 250cm',                   medidas:'a=10 b=10 L=250 cm', unidad:'UD', peso:60,   iva:'SI', lista:81900,   minimo:70200,   grupo:'Poste'},
  {codigo:'PPOSTRE300',  nombre:'Poste Cerco Recto 300cm',                   medidas:'a=10 b=10 L=300 cm', unidad:'UD', peso:69.6, iva:'SI', lista:98070,   minimo:84062,   grupo:'Poste'},
  {codigo:'PPOSTPREML',  nombre:'Poste Pretensado 3 Hilos (ml)',             medidas:'a=10 b=8 cm ML',     unidad:'ML', peso:19.2, iva:'SI', lista:27990,   minimo:25987,   grupo:'Poste'},
  // PRELOSA
  {codigo:'PPREPRET2H-03',nombre:'Prelosa Pretensada 2 Hilos A=20cm',       medidas:'a=20 h=5 cm',        unidad:'ML', peso:25.44,iva:'SI', lista:34320,   minimo:32030,   grupo:'Prelosa'},
  {codigo:'PPREPRET3H-02',nombre:'Prelosa Pretensada 3 Hilos A=30cm',       medidas:'a=30 h=5 cm',        unidad:'ML', peso:38.16,iva:'SI', lista:38370,   minimo:35810,   grupo:'Prelosa'},
  {codigo:'PPREPRET4H-02',nombre:'Prelosa Pretensada 4 Hilos A=40cm',       medidas:'a=40 h=5 cm',        unidad:'ML', peso:50.88,iva:'SI', lista:42420,   minimo:39590,   grupo:'Prelosa'},
  {codigo:'PPREPRET3H-03',nombre:'Prelosa Pretensada 3 Hilos A=50cm',       medidas:'a=50 h=5 cm',        unidad:'ML', peso:63.6, iva:'SI', lista:44020,   minimo:41090,   grupo:'Prelosa'},
  {codigo:'PPREPRET4H-03',nombre:'Prelosa Pretensada 4 Hilos A=50cm',       medidas:'a=50 h=5 cm',        unidad:'ML', peso:63.6, iva:'SI', lista:45240,   minimo:42230,   grupo:'Prelosa'},
  {codigo:'PPREPRET5H-04',nombre:'Prelosa Pretensada 5 Hilos A=50cm',       medidas:'a=50 h=5 cm',        unidad:'ML', peso:63.6, iva:'SI', lista:46460,   minimo:43370,   grupo:'Prelosa'},
  {codigo:'PPREPRET6H-03',nombre:'Prelosa Pretensada 6 Hilos A=50cm',       medidas:'a=50 h=5 cm',        unidad:'ML', peso:63.6, iva:'SI', lista:47690,   minimo:44510,   grupo:'Prelosa'},
  {codigo:'PPRESUM100',   nombre:'Prelosa Pretensada Trincho 3 Hilos',       medidas:'a=50 h=5 cm',        unidad:'ML', peso:63.6, iva:'SI', lista:42060,   minimo:36047,   grupo:'Prelosa'},
  // PROTECTOR ÁRBOL
  {codigo:'PPTARBAB4G',  nombre:'Protector Árbol Abujardado Gris (4 piezas)',medidas:'a=50 b=50 h=8 cm',   unidad:'UD', peso:89.2, iva:'NO', lista:120380,  minimo:103183,  grupo:'Protector Árbol'},
  {codigo:'PPTARBAB4O',  nombre:'Protector Árbol Abujardado Ocre (4 piezas)',medidas:'a=50 b=50 h=8 cm',   unidad:'UD', peso:89.2, iva:'NO', lista:126310,  minimo:108267,  grupo:'Protector Árbol'},
  {codigo:'PPTARBAB4N',  nombre:'Protector Árbol Abujardado Negro (4 piezas)',medidas:'a=50 b=50 h=8 cm',  unidad:'UD', peso:89.2, iva:'NO', lista:129090,  minimo:110647,  grupo:'Protector Árbol'},
  {codigo:'PPTARBAB4R',  nombre:'Protector Árbol Abujardado Rojo (4 piezas)',medidas:'a=50 b=50 h=8 cm',   unidad:'UD', peso:89.2, iva:'NO', lista:129090,  minimo:110647,  grupo:'Protector Árbol'},
  // SUMIDERO / REJILLA
  {codigo:'PREJRECT60',  nombre:'Rejilla Rectangular 60x30 (5 perf.)',       medidas:'a=60 b=30 h=6 cm',   unidad:'UD', peso:21.5, iva:'SI', lista:52430,   minimo:44942,   grupo:'Sumidero'},
  {codigo:'PREJRECT35',  nombre:'Rejilla Rectangular 35x100',                medidas:'a=35 b=100 h=6 cm',  unidad:'UD', peso:42,   iva:'SI', lista:78270,   minimo:67092,   grupo:'Sumidero'},
  {codigo:'PREJTFPE12',  nombre:'Rejilla Tráfico Pesado',                    medidas:'a=58 b=52 h=12 cm',  unidad:'UD', peso:78.9, iva:'SI', lista:106480,  minimo:91266,   grupo:'Sumidero'},
  {codigo:'PREJRECT21',  nombre:'Rejilla Tapa Traviesa',                     medidas:'a=21.5 b=49 h=4.5 cm',unidad:'UD',peso:8.6,  iva:'SI', lista:41280,   minimo:35386,   grupo:'Sumidero'},
  {codigo:'PREJRECT50',  nombre:'Rejilla Rectangular 35x50',                 medidas:'a=35 b=50 h=6 cm',   unidad:'UD', peso:21,   iva:'SI', lista:44750,   minimo:38356,   grupo:'Sumidero'},
  {codigo:'PREJR6PT60',  nombre:'Rejilla Rectangular 60x30 (6 perf.)',       medidas:'a=60 b=30 h=6 cm',   unidad:'UD', peso:21.5, iva:'SI', lista:51060,   minimo:47409,   grupo:'Sumidero'},
  // TOPELLANTA
  {codigo:'PTPLSP0A40',  nombre:'Topellantas Pequeño A=40cm',                medidas:'a=40 b=15 h=13 cm',  unidad:'UD', peso:10.8, iva:'SI', lista:22460,   minimo:19251,   grupo:'Topellanta'},
  {codigo:'PTPLSPA200',  nombre:'Topellantas Largo A=200cm',                 medidas:'a=200 b=10 h=10 cm', unidad:'UD', peso:70.1, iva:'SI', lista:78180,   minimo:67012,   grupo:'Topellanta'},
  {codigo:'PTPLSP0A50',  nombre:'Topellantas Pequeño A=50cm',                medidas:'a=50 b=15 h=13 cm',  unidad:'UD', peso:13.5, iva:'SI', lista:23710,   minimo:20326,   grupo:'Topellanta'},
  // TRAVIESA
  {codigo:'PTRAVCPQ17',  nombre:'Traviesa Canal Pequeña',                    medidas:'a=40 b=22 h=17 cm',  unidad:'UD', peso:23.2, iva:'SI', lista:37320,   minimo:31987,   grupo:'Traviesa'},
  {codigo:'PTRAVCST30',  nombre:'Traviesa Canal Sin Tapa',                   medidas:'a=49 b=30 h=30 cm',  unidad:'UD', peso:53.2, iva:'SI', lista:79620,   minimo:68249,   grupo:'Traviesa'},
  {codigo:'PTRAVENV18',  nombre:'Traviesa Canal Trapezoidal en V',           medidas:'a=35 b=28 h=18 cm',  unidad:'UD', peso:23.2, iva:'SI', lista:65600,   minimo:56227,   grupo:'Traviesa'},
  // TUBO
  {codigo:'PTBCRC2B36',  nombre:'Tubo Carretero 36" Clase II Pared B',       medidas:'d=36"',              unidad:'UD', peso:754,  iva:'SI', lista:541040,  minimo:463746,  grupo:'Tubo'},
  {codigo:'PTBCRC3B36',  nombre:'Tubo Carretero 36" Clase III Pared B',      medidas:'d=36"',              unidad:'UD', peso:754,  iva:'SI', lista:594880,  minimo:509899,  grupo:'Tubo'},
  // VIGA PRETENSADA
  {codigo:'PVGPPH112H',  nombre:'Vigueta Pretensada H11 2 Hilos + 1',        medidas:'a=11 h=11 cm ML',    unidad:'ML', peso:21.5, iva:'SI', lista:19410,   minimo:17530,   grupo:'Viga Pretensada'},
  {codigo:'PVGPPH113H-01',nombre:'Vigueta Pretensada H11 3 Hilos + 1',       medidas:'a=11 h=11 cm ML',    unidad:'ML', peso:21.5, iva:'SI', lista:20840,   minimo:18820,   grupo:'Viga Pretensada'},
  {codigo:'PVGPPH182H',  nombre:'Vigueta Pretensada H18 2 Hilos + 1',        medidas:'a=11 h=18 cm ML',    unidad:'ML', peso:32,   iva:'SI', lista:21190,   minimo:19130,   grupo:'Viga Pretensada'},
  {codigo:'PVGPPH183H',  nombre:'Vigueta Pretensada H18 3 Hilos + 1',        medidas:'a=11 h=18 cm ML',    unidad:'ML', peso:32,   iva:'SI', lista:22590,   minimo:20390,   grupo:'Viga Pretensada'},
  {codigo:'PVGPPH184H-01',nombre:'Vigueta Pretensada H18 4 Hilos + 1',       medidas:'a=11 h=18 cm ML',    unidad:'ML', peso:32,   iva:'SI', lista:23990,   minimo:21660,   grupo:'Viga Pretensada'},
];

// CATALOGO = todos los productos (incluye ocultos) tal como vienen de Supabase.
// PRODUCTOS = solo los activos, que es lo que ve el cotizador. Inicia con la semilla y se reemplaza al cargar.
let CATALOGO = PRODUCTOS_SEED.map(p => ({ ...p, activo: true }));
let PRODUCTOS = CATALOGO.filter(p => p.activo !== false);

function refrescarCatalogo(rows) {
  CATALOGO = rows.map(p => ({
    codigo: p.codigo, nombre: p.nombre, medidas: p.medidas || '', unidad: p.unidad || 'UD',
    peso: (p.peso === null || p.peso === undefined) ? null : Number(p.peso), iva: p.iva || 'NO',
    lista: Number(p.lista) || 0, minimo: Number(p.minimo) || 0, grupo: p.grupo || 'Otros',
    disenoMezcla: p.diseno_mezcla || '',
    activo: p.activo !== false
  }));
  PRODUCTOS = CATALOGO.filter(p => p.activo !== false);
}

async function cargarCatalogo() {
  const { data, error } = await sb.from('productos').select('*').order('grupo', { ascending: true }).order('nombre', { ascending: true });
  if (error) {
    console.warn('Tabla productos no disponible aún; usando catálogo del código (semilla).');
    return;
  }
  if (data && data.length) {
    refrescarCatalogo(data);
  } else {
    // Primera vez: sembrar la tabla con el catálogo del código
    const seed = PRODUCTOS_SEED.map(p => ({
      codigo: p.codigo, nombre: p.nombre, medidas: p.medidas, unidad: p.unidad,
      peso: p.peso, iva: p.iva, lista: p.lista, minimo: p.minimo, grupo: p.grupo,
      activo: true, modificado: new Date().toISOString()
    }));
    const { error: eSeed } = await sb.from('productos').upsert(seed, { onConflict: 'codigo' });
    if (eSeed) { console.error('Error sembrando productos:', eSeed.message); return; }
    refrescarCatalogo(seed);
    console.log('Catálogo sembrado en Supabase:', seed.length, 'productos.');
  }
}

// ═══════════════════════════════
// ADMINISTRACIÓN DE PRODUCTOS (CATÁLOGO)
// ═══════════════════════════════
function _normHdr(s) { return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,''); }

function renderProductosAdmin() {
  const tbody = document.getElementById('productos-adm-body');
  const resumen = document.getElementById('prod-adm-resumen');
  if (!tbody) return;
  // Poblar filtro de grupos y datalist
  const grupos = [...new Set(CATALOGO.map(p => p.grupo))].filter(Boolean).sort();
  const selG = document.getElementById('filtro-grupo-prod-adm');
  const actual = selG.value;
  selG.innerHTML = '<option value="">Todos los grupos</option>' + grupos.map(g => `<option value="${g}">${g}</option>`).join('');
  selG.value = actual;
  const dl = document.getElementById('lista-grupos-dl');
  if (dl) dl.innerHTML = grupos.map(g => `<option value="${g}">`).join('');

  const q = (document.getElementById('buscar-prod-adm')?.value || '').toLowerCase().trim();
  const grupo = selG.value;
  const verOcultos = document.getElementById('ver-ocultos-prod')?.checked;

  let data = [...CATALOGO];
  if (!verOcultos) data = data.filter(p => p.activo !== false);
  if (grupo) data = data.filter(p => p.grupo === grupo);
  if (q) data = data.filter(p => (p.nombre + ' ' + p.codigo + ' ' + (p.medidas||'')).toLowerCase().includes(q));
  data.sort((a,b) => a.grupo.localeCompare(b.grupo) || a.nombre.localeCompare(b.nombre));

  const activos = CATALOGO.filter(p => p.activo !== false).length;
  const ocultos = CATALOGO.length - activos;
  resumen.innerHTML = `
    <div style="background:white;border-radius:6px;padding:8px 14px;box-shadow:var(--sombra);border-top:3px solid var(--verde);min-width:130px"><div style="font-size:10px;font-weight:700;color:var(--verde);text-transform:uppercase">Productos activos</div><div style="font-size:18px;font-weight:800">${activos}</div></div>
    <div style="background:white;border-radius:6px;padding:8px 14px;box-shadow:var(--sombra);border-top:3px solid #C62828;min-width:130px"><div style="font-size:10px;font-weight:700;color:#C62828;text-transform:uppercase">Ocultos</div><div style="font-size:18px;font-weight:800">${ocultos}</div></div>
    <div style="background:white;border-radius:6px;padding:8px 14px;box-shadow:var(--sombra);border-top:3px solid var(--azul);min-width:130px"><div style="font-size:10px;font-weight:700;color:var(--azul);text-transform:uppercase">Mostrados</div><div style="font-size:18px;font-weight:800">${data.length}</div></div>`;

  if (!data.length) { tbody.innerHTML = `<tr><td colspan="9" class="empty-state"><div class="icono">📦</div><div>Sin productos para este filtro.</div></td></tr>`; return; }
  tbody.innerHTML = data.map(p => {
    const inactivo = p.activo === false;
    return `<tr style="border-top:1px solid var(--gris-borde);${inactivo?'opacity:.55':''}">
      <td style="font-weight:600;color:var(--azul);font-size:12px">${p.codigo}</td>
      <td><div style="font-weight:600;font-size:13px">${p.nombre}</div><div style="font-size:11px;color:var(--gris-medio)">${p.medidas||''}</div></td>
      <td style="color:var(--gris-medio)">${p.grupo}</td>
      <td style="text-align:center">${p.unidad}</td>
      <td style="text-align:center"><span style="color:${p.iva==='SI'?'var(--rojo)':'var(--verde)'};font-weight:700;font-size:12px">${p.iva}</span></td>
      <td style="text-align:right"><input type="number" value="${p.lista}" onchange="actualizarPrecioProducto('${p.codigo}','lista',this.value)" style="width:100px;text-align:right;padding:4px 6px;border:1px solid var(--gris-borde);border-radius:4px"></td>
      <td style="text-align:right"><input type="number" value="${p.minimo}" onchange="actualizarPrecioProducto('${p.codigo}','minimo',this.value)" style="width:100px;text-align:right;padding:4px 6px;border:1px solid var(--gris-borde);border-radius:4px"></td>
      <td><span class="badge" style="background:${inactivo?'#FFEBEE':'#E8F5E9'};color:${inactivo?'#C62828':'#2E7D32'}">${inactivo?'Oculto':'Activo'}</span></td>
      <td><div class="flex-gap">
        <button class="btn btn-primario btn-xs" onclick="abrirModalProducto('${p.codigo}')">✏️ Editar</button>
        ${inactivo
          ? `<button class="btn btn-verde btn-xs" onclick="toggleOcultarProducto('${p.codigo}',false)">↩️ Reactivar</button>`
          : `<button class="btn btn-secundario btn-xs" onclick="toggleOcultarProducto('${p.codigo}',true)">🚫 Ocultar</button>`}
      </div></td>
    </tr>`;
  }).join('');
}

function _upsertProducto(p) {
  return sb.from('productos').upsert({
    codigo: p.codigo, nombre: p.nombre, medidas: p.medidas, unidad: p.unidad,
    peso: p.peso, iva: p.iva, lista: p.lista, minimo: p.minimo, grupo: p.grupo,
    diseno_mezcla: p.disenoMezcla || null,
    activo: p.activo !== false, modificado: new Date().toISOString()
  }, { onConflict: 'codigo' });
}

function actualizarPrecioProducto(codigo, campo, valor) {
  const p = CATALOGO.find(x => x.codigo === codigo);
  if (!p) return;
  p[campo] = parseFloat(valor) || 0;
  PRODUCTOS = CATALOGO.filter(x => x.activo !== false);
  _upsertProducto(p).then(({ error }) => { if (error) { console.error(error.message); alert('No se pudo guardar el precio: ' + error.message); } });
}

function toggleOcultarProducto(codigo, ocultar) {
  const p = CATALOGO.find(x => x.codigo === codigo);
  if (!p) return;
  if (ocultar && !confirm(`¿Ocultar "${p.nombre}"? Dejará de aparecer en cotizaciones nuevas (no se borra).`)) return;
  p.activo = !ocultar;
  PRODUCTOS = CATALOGO.filter(x => x.activo !== false);
  _upsertProducto(p).then(({ error }) => { if (error) alert('Error: ' + error.message); });
  renderProductosAdmin();
}

function abrirModalProducto(codigo) {
  const esEdit = !!codigo;
  document.getElementById('modal-producto-titulo').textContent = esEdit ? '✏️ Editar producto' : '📦 Nuevo producto';
  document.getElementById('mp-codigo-orig').value = codigo || '';
  const p = esEdit ? CATALOGO.find(x => x.codigo === codigo) : null;
  document.getElementById('mp-codigo').value = p?.codigo || '';
  document.getElementById('mp-codigo').readOnly = esEdit;
  document.getElementById('mp-grupo').value = p?.grupo || '';
  document.getElementById('mp-nombre').value = p?.nombre || '';
  document.getElementById('mp-medidas').value = p?.medidas || '';
  document.getElementById('mp-unidad').value = p?.unidad || 'UD';
  document.getElementById('mp-peso').value = (p && p.peso != null) ? p.peso : '';
  document.getElementById('mp-iva').value = p?.iva || 'NO';
  document.getElementById('mp-lista').value = p?.lista ?? '';
  document.getElementById('mp-minimo').value = p?.minimo ?? '';
  if (typeof poblarSelectDisenos === 'function') poblarSelectDisenos('mp-diseno-mezcla');
  document.getElementById('mp-diseno-mezcla').value = p?.disenoMezcla || '';
  document.getElementById('modal-producto').classList.add('abierto');
}

function guardarProducto() {
  const codigo = document.getElementById('mp-codigo').value.trim();
  const nombre = document.getElementById('mp-nombre').value.trim();
  const grupo = document.getElementById('mp-grupo').value.trim();
  const lista = parseFloat(document.getElementById('mp-lista').value);
  const minimo = parseFloat(document.getElementById('mp-minimo').value);
  if (!codigo || !nombre || !grupo || !(lista >= 0) || !(minimo >= 0)) { alert('Completa: Código, Nombre, Grupo, Precio Lista y Precio Mínimo.'); return; }
  const orig = document.getElementById('mp-codigo-orig').value;
  if (!orig && CATALOGO.find(x => x.codigo === codigo)) { alert('Ya existe un producto con ese código.'); return; }
  const pesoVal = document.getElementById('mp-peso').value;
  const prod = {
    codigo, nombre, grupo,
    medidas: document.getElementById('mp-medidas').value.trim(),
    unidad: document.getElementById('mp-unidad').value.trim() || 'UD',
    peso: pesoVal === '' ? null : parseFloat(pesoVal),
    iva: document.getElementById('mp-iva').value,
    lista, minimo, activo: true,
    disenoMezcla: document.getElementById('mp-diseno-mezcla').value || ''
  };
  const idx = CATALOGO.findIndex(x => x.codigo === codigo);
  const esNuevo = idx < 0;
  const anterior = esNuevo ? null : { ...CATALOGO[idx] };
  if (idx >= 0) CATALOGO[idx] = { ...CATALOGO[idx], ...prod }; else CATALOGO.push(prod);
  PRODUCTOS = CATALOGO.filter(x => x.activo !== false);
  _upsertProducto(prod).then(({ error }) => {
    if (error) {
      // Si el guardado falla, se revierte el cambio local para no dejar un producto
      // "fantasma" (o un edit fantasma) que bloquee futuros intentos con ese código.
      if (esNuevo) CATALOGO = CATALOGO.filter(x => x.codigo !== codigo);
      else { const i2 = CATALOGO.findIndex(x => x.codigo === codigo); if (i2 >= 0) CATALOGO[i2] = anterior; }
      PRODUCTOS = CATALOGO.filter(x => x.activo !== false);
      renderProductosAdmin();
      alert('Error al guardar: ' + error.message);
    }
  });
  cerrarModal('modal-producto');
  renderProductosAdmin();
}

// ── IMPORTACIÓN DESDE EXCEL / CSV ──
let _importData = null;

function abrirModalImportar() {
  document.getElementById('archivo-importar').value = '';
  document.getElementById('importar-preview').style.display = 'none';
  document.getElementById('btn-aplicar-import').disabled = true;
  _importData = null;
  document.getElementById('modal-importar').classList.add('abierto');
}

function descargarPlantillaProductos() {
  if (typeof XLSX === 'undefined') { alert('La librería de Excel no cargó. Verifica tu conexión.'); return; }
  const rows = [['Codigo','Producto','Grupo','Medidas','Unidad','Peso','IVA','Precio Lista','Precio Minimo']];
  CATALOGO.filter(p => p.activo !== false).sort((a,b)=>a.grupo.localeCompare(b.grupo)||a.nombre.localeCompare(b.nombre))
    .forEach(p => rows.push([p.codigo, p.nombre, p.grupo, p.medidas, p.unidad, p.peso, p.iva, p.lista, p.minimo]));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Productos');
  XLSX.writeFile(wb, 'Plantilla_Productos_Proconcreto.xlsx');
}

function procesarArchivoImportar(ev) {
  const file = ev.target.files[0];
  if (!file) return;
  if (typeof XLSX === 'undefined') { alert('La librería de Excel no cargó. Verifica tu conexión.'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (aoa.length < 2) { alert('El archivo no tiene datos.'); return; }
      const hdr = aoa[0].map(_normHdr);
      const col = (claves) => hdr.findIndex(h => claves.includes(h));
      const ci = {
        codigo: col(['codigo','code']), nombre: col(['producto','nombre']), grupo: col(['grupo']),
        medidas: col(['medidas','medida']), unidad: col(['unidad','unid']), peso: col(['peso','pesokg']),
        iva: col(['iva']), lista: col(['preciolista','lista','preciolistacop']), minimo: col(['preciominimo','minimo','preciominimocop'])
      };
      if (ci.codigo < 0 || ci.lista < 0) { alert('El archivo debe tener al menos las columnas "Codigo" y "Precio Lista".'); return; }
      const items = [];
      for (let i = 1; i < aoa.length; i++) {
        const r = aoa[i];
        const codigo = String(r[ci.codigo] ?? '').trim();
        if (!codigo) continue;
        items.push({
          codigo,
          nombre: ci.nombre>=0 ? String(r[ci.nombre]??'').trim() : '',
          grupo: ci.grupo>=0 ? String(r[ci.grupo]??'').trim() : '',
          medidas: ci.medidas>=0 ? String(r[ci.medidas]??'').trim() : '',
          unidad: ci.unidad>=0 ? (String(r[ci.unidad]??'').trim()||'UD') : 'UD',
          peso: ci.peso>=0 && r[ci.peso]!=='' ? parseFloat(r[ci.peso]) : null,
          iva: ci.iva>=0 ? (String(r[ci.iva]??'').trim().toUpperCase()==='SI'?'SI':'NO') : 'NO',
          lista: parseFloat(r[ci.lista]) || 0,
          minimo: ci.minimo>=0 ? (parseFloat(r[ci.minimo])||0) : 0
        });
      }
      // Diff contra catálogo
      const mapCat = {}; CATALOGO.forEach(p => mapCat[p.codigo] = p);
      const codigosArchivo = new Set(items.map(i => i.codigo));
      let nuevos=0, actualizados=0, sinCambio=0;
      items.forEach(it => {
        const ex = mapCat[it.codigo];
        if (!ex) { it._estado='nuevo'; nuevos++; }
        else {
          const cambio = ex.lista!==it.lista || ex.minimo!==it.minimo || ex.nombre!==(it.nombre||ex.nombre) || ex.grupo!==(it.grupo||ex.grupo) || ex.activo===false;
          if (cambio) { it._estado='actualizado'; actualizados++; } else { it._estado='igual'; sinCambio++; }
        }
      });
      const faltantes = CATALOGO.filter(p => p.activo!==false && !codigosArchivo.has(p.codigo));
      _importData = { items, faltantes };

      document.getElementById('importar-resumen').innerHTML = `
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <span class="badge" style="background:#E8F5E9;color:#2E7D32">🆕 ${nuevos} nuevos</span>
          <span class="badge" style="background:#E3F2FD;color:#1565C0">♻️ ${actualizados} actualizados</span>
          <span class="badge" style="background:#F2F4F7;color:#555">= ${sinCambio} sin cambio</span>
          <span class="badge" style="background:#FFF3E0;color:#E65100">🚫 ${faltantes.length} a ocultar</span>
        </div>`;
      const muestra = items.filter(i => i._estado!=='igual').slice(0, 60);
      document.getElementById('importar-detalle').innerHTML = `<table class="tabla-cots" style="width:100%"><thead><tr><th>Código</th><th>Producto</th><th style="text-align:right">Lista</th><th style="text-align:right">Mínimo</th><th>Estado</th></tr></thead><tbody>${
        muestra.map(it => {
          const ex = mapCat[it.codigo];
          const dif = ex && ex.lista!==it.lista ? ` <span style="font-size:10px;color:#888">(antes $${ex.lista.toLocaleString()})</span>` : '';
          return `<tr><td style="font-size:11px;color:var(--azul)">${it.codigo}</td><td style="font-size:12px">${it.nombre||(ex?ex.nombre:'')}</td><td style="text-align:right">$${it.lista.toLocaleString()}${dif}</td><td style="text-align:right">$${it.minimo.toLocaleString()}</td><td>${it._estado==='nuevo'?'<span class="badge" style="background:#E8F5E9;color:#2E7D32">Nuevo</span>':'<span class="badge" style="background:#E3F2FD;color:#1565C0">Actualiza</span>'}</td></tr>`;
        }).join('') + (items.filter(i=>i._estado!=='igual').length>60 ? `<tr><td colspan="5" style="text-align:center;color:#888;font-size:11px">… y más</td></tr>`:'')
      }</tbody></table>`;
      document.getElementById('importar-preview').style.display = 'block';
      document.getElementById('btn-aplicar-import').disabled = (nuevos+actualizados+faltantes.length)===0;
    } catch (err) {
      console.error(err); alert('No se pudo leer el archivo: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

async function aplicarImportacion() {
  if (!_importData) return;
  const ocultarFalt = document.getElementById('importar-ocultar-faltantes').checked;
  const btn = document.getElementById('btn-aplicar-import');
  btn.disabled = true; btn.textContent = '⏳ Aplicando...';
  // Filas a upsert: las del archivo (activas), completando datos faltantes desde el catálogo actual
  const mapCat = {}; CATALOGO.forEach(p => mapCat[p.codigo] = p);
  const upserts = _importData.items.map(it => {
    const ex = mapCat[it.codigo] || {};
    return {
      codigo: it.codigo,
      nombre: it.nombre || ex.nombre || it.codigo,
      grupo: it.grupo || ex.grupo || 'Otros',
      medidas: it.medidas || ex.medidas || '',
      unidad: it.unidad || ex.unidad || 'UD',
      peso: it.peso != null ? it.peso : (ex.peso ?? null),
      iva: it.iva || ex.iva || 'NO',
      lista: it.lista, minimo: it.minimo, activo: true, modificado: new Date().toISOString()
    };
  });
  if (ocultarFalt) {
    _importData.faltantes.forEach(p => upserts.push({ ...p, activo: false, modificado: new Date().toISOString() }));
  }
  try {
    // Supabase upsert por lotes de 500
    for (let i = 0; i < upserts.length; i += 500) {
      const lote = upserts.slice(i, i+500);
      const { error } = await sb.from('productos').upsert(lote, { onConflict: 'codigo' });
      if (error) throw error;
    }
    const { data } = await sb.from('productos').select('*').order('grupo').order('nombre');
    if (data) refrescarCatalogo(data);
    cerrarModal('modal-importar');
    renderProductosAdmin();
    alert(`✅ Importación aplicada: ${upserts.length} registros procesados.`);
  } catch (err) {
    console.error(err); alert('Error al aplicar: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Aplicar cambios';
  }
}

