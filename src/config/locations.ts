/**
 * UBICACIONES DEL PERÚ — Departamento → Provincia → Distrito
 * ------------------------------------------------------------
 * Copia de src/config/locations.js del frontend (mismos datos) con tipos.
 * Se usa para interpretar la búsqueda por texto ("Lima", "san miguel") y para
 * obtener coordenadas cuando el propietario no las indica.
 */
import { normalize } from './countries.ts';

export type Coords = { lat: number; lng: number };
type DistrictInput = string | (Coords & { name: string });
type Province = Coords & { name: string; districts: DistrictInput[] };
type Department = Coords & { name: string; provinces: Province[] };

const D = (name: string, lat: number, lng: number) => ({ name, lat, lng });

export const PERU: Department[] = [
  { name: 'Amazonas', lat: -6.2294, lng: -77.8728, provinces: [
    { name: 'Chachapoyas', lat: -6.2294, lng: -77.8728, districts: ['Chachapoyas', 'Huancas', 'Leimebamba', 'Luya'] },
    { name: 'Bagua', lat: -5.6386, lng: -78.5308, districts: ['Bagua', 'La Peca', 'Aramango'] },
    { name: 'Utcubamba', lat: -5.7539, lng: -78.4408, districts: ['Bagua Grande', 'Cajaruro', 'Jamalca'] },
  ]},
  { name: 'Áncash', lat: -9.0853, lng: -78.5783, provinces: [
    { name: 'Santa', lat: -9.0853, lng: -78.5783, districts: [D('Chimbote', -9.0853, -78.5783), D('Nuevo Chimbote', -9.1226, -78.5152), 'Coishco', 'Santa', 'Samanco'] },
    { name: 'Huaraz', lat: -9.5277, lng: -77.5278, districts: ['Huaraz', 'Independencia', 'Tarica'] },
    { name: 'Casma', lat: -9.4741, lng: -78.3030, districts: ['Casma', 'Buena Vista Alta'] },
    { name: 'Huaylas', lat: -9.0490, lng: -77.8106, districts: ['Caraz', 'Yungay'] },
  ]},
  { name: 'Apurímac', lat: -13.6339, lng: -72.8814, provinces: [
    { name: 'Abancay', lat: -13.6339, lng: -72.8814, districts: ['Abancay', 'Tamburco', 'Curahuasi'] },
    { name: 'Andahuaylas', lat: -13.6573, lng: -73.3874, districts: ['Andahuaylas', 'Talavera', 'San Jerónimo'] },
  ]},
  { name: 'Arequipa', lat: -16.4090, lng: -71.5375, provinces: [
    { name: 'Arequipa', lat: -16.4090, lng: -71.5375, districts: [
      D('Arequipa', -16.3989, -71.5350), D('Alto Selva Alegre', -16.3750, -71.5200), D('Cayma', -16.3830, -71.5480), D('Cerro Colorado', -16.3750, -71.5670),
      D('Characato', -16.4700, -71.4870), D('Jacobo Hunter', -16.4470, -71.5570), D('José Luis Bustamante y Rivero', -16.4280, -71.5230), D('Mariano Melgar', -16.4050, -71.5030),
      D('Miraflores', -16.3930, -71.5230), D('Paucarpata', -16.4270, -71.5000), D('Sachaca', -16.4210, -71.5680), D('Socabaya', -16.4650, -71.5320),
      D('Tiabaya', -16.4520, -71.5900), D('Yanahuara', -16.3930, -71.5450), D('Yura', -16.2540, -71.6790),
    ]},
    { name: 'Camaná', lat: -16.6244, lng: -72.7111, districts: ['Camaná', 'Samuel Pastor', 'Mariscal Cáceres'] },
    { name: 'Islay', lat: -17.0231, lng: -72.0147, districts: ['Mollendo', 'Mejía', 'Islay'] },
    { name: 'Caylloma', lat: -15.6380, lng: -71.6011, districts: ['Chivay', 'Majes'] },
  ]},
  { name: 'Ayacucho', lat: -13.1588, lng: -74.2239, provinces: [
    { name: 'Huamanga', lat: -13.1588, lng: -74.2239, districts: ['Ayacucho', 'San Juan Bautista', 'Carmen Alto', 'Jesús Nazareno', 'Andrés Avelino Cáceres Dorregaray'] },
    { name: 'Huanta', lat: -12.9400, lng: -74.2480, districts: ['Huanta', 'Luricocha'] },
  ]},
  { name: 'Cajamarca', lat: -7.1638, lng: -78.5003, provinces: [
    { name: 'Cajamarca', lat: -7.1638, lng: -78.5003, districts: ['Cajamarca', 'Baños del Inca', 'Jesús', 'Llacanora'] },
    { name: 'Jaén', lat: -5.7081, lng: -78.8081, districts: ['Jaén', 'Bellavista', 'San Ignacio'] },
    { name: 'Chota', lat: -6.5633, lng: -78.6511, districts: ['Chota', 'Lajas'] },
  ]},
  { name: 'Callao', lat: -12.0566, lng: -77.1181, provinces: [
    { name: 'Callao', lat: -12.0566, lng: -77.1181, districts: [
      D('Callao', -12.0566, -77.1181), D('Bellavista', -12.0620, -77.1100), D('Carmen de la Legua Reynoso', -12.0450, -77.0930), D('La Perla', -12.0700, -77.1090),
      D('La Punta', -12.0700, -77.1630), D('Ventanilla', -11.8750, -77.1260), D('Mi Perú', -11.8560, -77.1230),
    ]},
  ]},
  { name: 'Cusco', lat: -13.5319, lng: -71.9675, provinces: [
    { name: 'Cusco', lat: -13.5319, lng: -71.9675, districts: [
      D('Cusco', -13.5170, -71.9785), D('San Sebastián', -13.5460, -71.9210), D('San Jerónimo', -13.5480, -71.8870), D('Santiago', -13.5320, -71.9850),
      D('Wanchaq', -13.5280, -71.9600), D('Poroy', -13.4900, -72.0300), D('Saylla', -13.5860, -71.8420),
    ]},
    { name: 'Urubamba', lat: -13.3050, lng: -72.1160, districts: ['Urubamba', 'Ollantaytambo', 'Machupicchu', 'Yucay'] },
    { name: 'La Convención', lat: -12.8650, lng: -72.6930, districts: ['Santa Ana', 'Echarate'] },
    { name: 'Canchis', lat: -14.2700, lng: -71.2260, districts: ['Sicuani', 'San Pablo'] },
  ]},
  { name: 'Huancavelica', lat: -12.7870, lng: -74.9750, provinces: [
    { name: 'Huancavelica', lat: -12.7870, lng: -74.9750, districts: ['Huancavelica', 'Ascensión', 'Yauli'] },
    { name: 'Tayacaja', lat: -12.3970, lng: -74.8660, districts: ['Pampas', 'Acraquia'] },
  ]},
  { name: 'Huánuco', lat: -9.9306, lng: -76.2422, provinces: [
    { name: 'Huánuco', lat: -9.9306, lng: -76.2422, districts: ['Huánuco', 'Amarilis', 'Pillco Marca'] },
    { name: 'Leoncio Prado', lat: -9.2960, lng: -76.0000, districts: ['Rupa-Rupa', 'Castillo Grande'] },
  ]},
  { name: 'Ica', lat: -14.0678, lng: -75.7286, provinces: [
    { name: 'Ica', lat: -14.0678, lng: -75.7286, districts: [D('Ica', -14.0678, -75.7286), D('La Tinguiña', -14.0450, -75.7100), D('Parcona', -14.0470, -75.6900), D('Subtanjalla', -14.0200, -75.7500), 'Los Aquijes', 'Salas'] },
    { name: 'Chincha', lat: -13.4180, lng: -76.1320, districts: ['Chincha Alta', 'Pueblo Nuevo', 'Sunampe', 'Grocio Prado'] },
    { name: 'Pisco', lat: -13.7100, lng: -76.2030, districts: ['Pisco', 'San Andrés', 'Paracas', 'San Clemente'] },
    { name: 'Nasca', lat: -14.8290, lng: -74.9370, districts: ['Nasca', 'Vista Alegre'] },
  ]},
  { name: 'Junín', lat: -12.0660, lng: -75.2100, provinces: [
    { name: 'Huancayo', lat: -12.0660, lng: -75.2100, districts: [D('Huancayo', -12.0660, -75.2100), D('El Tambo', -12.0490, -75.2220), D('Chilca', -12.0880, -75.2070), 'Pilcomayo', 'Sapallanga', 'San Agustín de Cajas'] },
    { name: 'Tarma', lat: -11.4190, lng: -75.6900, districts: ['Tarma', 'Acobamba'] },
    { name: 'Chanchamayo', lat: -11.0550, lng: -75.3310, districts: ['Chanchamayo', 'San Ramón', 'Pichanaqui'] },
    { name: 'Satipo', lat: -11.2520, lng: -74.6380, districts: ['Satipo', 'Mazamari'] },
  ]},
  { name: 'La Libertad', lat: -8.1120, lng: -79.0290, provinces: [
    { name: 'Trujillo', lat: -8.1120, lng: -79.0290, districts: [
      D('Trujillo', -8.1120, -79.0290), D('Víctor Larco Herrera', -8.1400, -79.0450), D('La Esperanza', -8.0760, -79.0450), D('El Porvenir', -8.0930, -78.9990),
      D('Huanchaco', -8.0810, -79.1200), D('Moche', -8.1710, -79.0080), D('Laredo', -8.0900, -78.9600), D('Florencia de Mora', -8.0800, -79.0200), D('Salaverry', -8.2220, -78.9770),
    ]},
    { name: 'Pacasmayo', lat: -7.4280, lng: -79.5030, districts: ['San Pedro de Lloc', 'Pacasmayo', 'Guadalupe'] },
    { name: 'Chepén', lat: -7.2260, lng: -79.4300, districts: ['Chepén', 'Pacanga'] },
    { name: 'Ascope', lat: -7.7140, lng: -79.1070, districts: ['Ascope', 'Casa Grande', 'Chocope'] },
  ]},
  { name: 'Lambayeque', lat: -6.7714, lng: -79.8409, provinces: [
    { name: 'Chiclayo', lat: -6.7714, lng: -79.8409, districts: [
      D('Chiclayo', -6.7714, -79.8409), D('José Leonardo Ortiz', -6.7520, -79.8420), D('La Victoria', -6.7920, -79.8360), D('Pimentel', -6.8370, -79.9340),
      D('Monsefú', -6.8770, -79.8700), D('Reque', -6.8660, -79.8200), D('Santa Rosa', -6.8760, -79.9160),
    ]},
    { name: 'Lambayeque', lat: -6.7020, lng: -79.9070, districts: ['Lambayeque', 'Mórrope', 'Motupe'] },
    { name: 'Ferreñafe', lat: -6.6390, lng: -79.7890, districts: ['Ferreñafe', 'Pítipo'] },
  ]},
  { name: 'Lima', lat: -12.0464, lng: -77.0428, provinces: [
    { name: 'Lima', lat: -12.0464, lng: -77.0428, districts: [
      D('Ate', -12.0261, -76.9187), D('Barranco', -12.1442, -77.0206), D('Breña', -12.0592, -77.0500), D('Carabayllo', -11.8990, -77.0340), D('Cercado de Lima', -12.0464, -77.0428),
      D('Chorrillos', -12.1700, -77.0200), D('Comas', -11.9331, -77.0600), D('El Agustino', -12.0450, -77.0000), D('Independencia', -11.9900, -77.0530), D('Jesús María', -12.0753, -77.0483),
      D('La Molina', -12.0800, -76.9400), D('La Victoria', -12.0700, -77.0200), D('Lince', -12.0870, -77.0350), D('Los Olivos', -11.9700, -77.0700), D('Lurigancho', -11.9400, -76.7000),
      D('Lurín', -12.2750, -76.8700), D('Magdalena del Mar', -12.0900, -77.0700), D('Miraflores', -12.1200, -77.0300), D('Pachacámac', -12.2300, -76.8600), D('Pueblo Libre', -12.0750, -77.0650),
      D('Puente Piedra', -11.8620, -77.0760), D('Rímac', -12.0300, -77.0350), D('San Borja', -12.1000, -77.0000), D('San Isidro', -12.0950, -77.0350), D('San Juan de Lurigancho', -11.9900, -77.0000),
      D('San Juan de Miraflores', -12.1600, -76.9700), D('San Luis', -12.0750, -77.0000), D('San Martín de Porres', -12.0000, -77.0800), D('San Miguel', -12.0770, -77.0900),
      D('Santa Anita', -12.0450, -76.9700), D('Santiago de Surco', -12.1350, -76.9900), D('Surquillo', -12.1100, -77.0200), D('Villa El Salvador', -12.2100, -76.9400), D('Villa María del Triunfo', -12.1600, -76.9300),
    ]},
    { name: 'Cañete', lat: -13.0760, lng: -76.3860, districts: ['San Vicente de Cañete', 'Imperial', 'Mala', 'Asia', 'Cerro Azul'] },
    { name: 'Huaral', lat: -11.4950, lng: -77.2070, districts: ['Huaral', 'Chancay', 'Aucallama'] },
    { name: 'Huaura', lat: -11.1070, lng: -77.6100, districts: ['Huacho', 'Hualmay', 'Santa María', 'Huaura'] },
    { name: 'Barranca', lat: -10.7500, lng: -77.7610, districts: ['Barranca', 'Paramonga', 'Supe'] },
    { name: 'Huarochirí', lat: -11.8470, lng: -76.3940, districts: ['Matucana', 'Santa Eulalia', 'San Mateo'] },
  ]},
  { name: 'Loreto', lat: -3.7491, lng: -73.2538, provinces: [
    { name: 'Maynas', lat: -3.7491, lng: -73.2538, districts: [D('Iquitos', -3.7491, -73.2538), D('Punchana', -3.7200, -73.2500), D('Belén', -3.7700, -73.2450), D('San Juan Bautista', -3.7900, -73.2800)] },
    { name: 'Alto Amazonas', lat: -5.9000, lng: -76.1130, districts: ['Yurimaguas', 'Balsapuerto'] },
  ]},
  { name: 'Madre de Dios', lat: -12.5940, lng: -69.1890, provinces: [
    { name: 'Tambopata', lat: -12.5940, lng: -69.1890, districts: ['Tambopata', 'Las Piedras', 'Laberinto'] },
  ]},
  { name: 'Moquegua', lat: -17.1940, lng: -70.9350, provinces: [
    { name: 'Mariscal Nieto', lat: -17.1940, lng: -70.9350, districts: ['Moquegua', 'Samegua', 'Torata'] },
    { name: 'Ilo', lat: -17.6450, lng: -71.3430, districts: ['Ilo', 'Pacocha', 'El Algarrobal'] },
  ]},
  { name: 'Pasco', lat: -10.6830, lng: -76.2560, provinces: [
    { name: 'Pasco', lat: -10.6830, lng: -76.2560, districts: ['Chaupimarca', 'Yanacancha', 'Simón Bolívar'] },
    { name: 'Oxapampa', lat: -10.5770, lng: -75.4020, districts: ['Oxapampa', 'Villa Rica', 'Chontabamba'] },
  ]},
  { name: 'Piura', lat: -5.1945, lng: -80.6328, provinces: [
    { name: 'Piura', lat: -5.1945, lng: -80.6328, districts: [D('Piura', -5.1945, -80.6328), D('Castilla', -5.1900, -80.6170), D('Veintiséis de Octubre', -5.1890, -80.6630), D('Catacaos', -5.2630, -80.6760), 'La Arena', 'Tambo Grande'] },
    { name: 'Sullana', lat: -4.9040, lng: -80.6850, districts: [D('Sullana', -4.9040, -80.6850), D('Bellavista', -4.8900, -80.6800), 'Marcavelica', 'Querecotillo'] },
    { name: 'Talara', lat: -4.5780, lng: -81.2720, districts: ['Pariñas', 'Los Órganos', 'Máncora', 'El Alto'] },
    { name: 'Paita', lat: -5.0890, lng: -81.1140, districts: ['Paita', 'Colán'] },
    { name: 'Sechura', lat: -5.5570, lng: -80.8220, districts: ['Sechura', 'Vice'] },
  ]},
  { name: 'Puno', lat: -15.8402, lng: -70.0219, provinces: [
    { name: 'Puno', lat: -15.8402, lng: -70.0219, districts: ['Puno', 'Chucuito', 'Acora'] },
    { name: 'San Román', lat: -15.4990, lng: -70.1330, districts: [D('Juliaca', -15.4990, -70.1330), 'San Miguel', 'Caracoto'] },
    { name: 'Azángaro', lat: -14.9080, lng: -70.1960, districts: ['Azángaro', 'Asillo'] },
  ]},
  { name: 'San Martín', lat: -6.4870, lng: -76.3590, provinces: [
    { name: 'San Martín', lat: -6.4870, lng: -76.3590, districts: [D('Tarapoto', -6.4870, -76.3590), D('Morales', -6.4800, -76.3800), D('La Banda de Shilcayo', -6.5000, -76.3400)] },
    { name: 'Moyobamba', lat: -6.0340, lng: -76.9720, districts: ['Moyobamba', 'Calzada'] },
    { name: 'Rioja', lat: -6.0610, lng: -77.1660, districts: ['Rioja', 'Nueva Cajamarca'] },
  ]},
  { name: 'Tacna', lat: -18.0146, lng: -70.2536, provinces: [
    { name: 'Tacna', lat: -18.0146, lng: -70.2536, districts: [D('Tacna', -18.0146, -70.2536), D('Alto de la Alianza', -17.9900, -70.2500), D('Ciudad Nueva', -17.9850, -70.2380), D('Coronel Gregorio Albarracín Lanchipa', -18.0400, -70.2450), D('Pocollay', -17.9950, -70.2200)] },
  ]},
  { name: 'Tumbes', lat: -3.5669, lng: -80.4515, provinces: [
    { name: 'Tumbes', lat: -3.5669, lng: -80.4515, districts: ['Tumbes', 'Corrales', 'San Jacinto'] },
    { name: 'Zarumilla', lat: -3.5010, lng: -80.2730, districts: ['Zarumilla', 'Aguas Verdes', 'Papayal'] },
    { name: 'Contralmirante Villar', lat: -3.6790, lng: -80.6750, districts: ['Zorritos', 'Canoas de Punta Sal'] },
  ]},
  { name: 'Ucayali', lat: -8.3791, lng: -74.5539, provinces: [
    { name: 'Coronel Portillo', lat: -8.3791, lng: -74.5539, districts: [D('Callería', -8.3791, -74.5539), D('Yarinacocha', -8.3500, -74.5800), D('Manantay', -8.4100, -74.5600), 'Campo Verde'] },
    { name: 'Padre Abad', lat: -9.0380, lng: -75.5090, districts: ['Padre Abad', 'Irazola'] },
  ]},
];

export const COUNTRY_LOCATIONS: Record<string, Department[]> = { PE: PERU };

// ---------------------------------------------------------------- Helpers

function districtObject(d: DistrictInput, province: Province) {
  return typeof d === 'string' ? { name: d, lat: province.lat, lng: province.lng } : d;
}

type LocationQuery = { department?: string | null; province?: string | null; district?: string | null };

/** Coordenadas del lugar más específico que esté definido */
export function getCoordinates({ department, province, district }: LocationQuery = {}, country = 'PE'): Coords | null {
  const dep = COUNTRY_LOCATIONS[country]?.find((d) => d.name === department);
  if (!dep) return null;
  const prov = dep.provinces.find((p) => p.name === province);
  if (!prov) return { lat: dep.lat, lng: dep.lng };
  const dist = prov.districts.map((d) => districtObject(d, prov)).find((d) => d.name === district);
  return dist ? { lat: dist.lat, lng: dist.lng } : { lat: prov.lat, lng: prov.lng };
}

export type FlatLocation = Coords & {
  level: 'department' | 'province' | 'district';
  name: string;
  department: string;
  province?: string;
  district?: string;
};

const flatCache = new Map<string, FlatLocation[]>();

/** Lista plana de todos los lugares */
export function getAllLocations(country = 'PE'): FlatLocation[] {
  const cached = flatCache.get(country);
  if (cached) return cached;
  const list: FlatLocation[] = [];
  (COUNTRY_LOCATIONS[country] || []).forEach((dep) => {
    list.push({ level: 'department', department: dep.name, name: dep.name, lat: dep.lat, lng: dep.lng });
    dep.provinces.forEach((prov) => {
      list.push({ level: 'province', department: dep.name, province: prov.name, name: prov.name, lat: prov.lat, lng: prov.lng });
      prov.districts.forEach((d) => {
        const dist = districtObject(d, prov);
        list.push({ level: 'district', department: dep.name, province: prov.name, district: dist.name, name: dist.name, lat: dist.lat, lng: dist.lng });
      });
    });
  });
  flatCache.set(country, list);
  return list;
}

const LEVEL_RANK = { department: 0, province: 1, district: 2 };

/**
 * Interpreta un texto escrito por el usuario ("Lima", "san miguel", "Trujillo").
 * Devuelve el lugar más amplio que coincida exactamente (departamento > provincia > distrito),
 * o el mejor parcial si no hay coincidencia exacta. null si no reconoce nada.
 */
export function findLocation(text: string, country = 'PE'): FlatLocation | null {
  const q = normalize(text);
  if (!q) return null;
  const all = getAllLocations(country);
  const rank = (loc: FlatLocation) => LEVEL_RANK[loc.level] * 10 + (loc.department === 'Lima' ? 0 : 1); // Lima primero si hay empate
  const byRank = (a: FlatLocation, b: FlatLocation) => rank(a) - rank(b);
  const exact = all.filter((l) => normalize(l.name) === q).sort(byRank);
  if (exact.length) return exact[0];
  const partial = all.filter((l) => normalize(l.name).startsWith(q)).sort(byRank);
  if (partial.length) return partial[0];
  const contains = all.filter((l) => normalize(l.name).includes(q)).sort(byRank);
  return contains[0] || null;
}

/** true si el departamento/provincia/distrito existen en el árbol */
export function isValidLocation({ department, province, district }: LocationQuery, country = 'PE'): boolean {
  const dep = COUNTRY_LOCATIONS[country]?.find((d) => d.name === department);
  const prov = dep?.provinces.find((p) => p.name === province);
  return Boolean(prov && prov.districts.some((d) => districtObject(d, prov).name === district));
}
