export interface ParkArea {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number }[];
}

export const parks: ParkArea[] = [
  {
    id: 'ciutadella',
    name: 'Parc de la Ciutadella',
    coordinates: [
      { lat: 41.3888, lng: 2.1821 },
      { lat: 41.3922, lng: 2.1821 },
      { lat: 41.3922, lng: 2.1894 },
      { lat: 41.3888, lng: 2.1894 },
      { lat: 41.3888, lng: 2.1821 },
    ],
  },
  {
    id: 'montjuic',
    name: 'Parc de Montjuïc',
    coordinates: [
      { lat: 41.3604, lng: 2.1550 },
      { lat: 41.3758, lng: 2.1550 },
      { lat: 41.3758, lng: 2.1810 },
      { lat: 41.3604, lng: 2.1810 },
      { lat: 41.3604, lng: 2.1550 },
    ],
  },
  {
    id: 'park-guell',
    name: 'Park Güell',
    coordinates: [
      { lat: 41.4110, lng: 2.1500 },
      { lat: 41.4155, lng: 2.1500 },
      { lat: 41.4155, lng: 2.1590 },
      { lat: 41.4110, lng: 2.1590 },
      { lat: 41.4110, lng: 2.1500 },
    ],
  },
  {
    id: 'poblenou',
    name: 'Parc del Poblenou',
    coordinates: [
      { lat: 41.4080, lng: 2.2050 },
      { lat: 41.4112, lng: 2.2050 },
      { lat: 41.4112, lng: 2.2125 },
      { lat: 41.4080, lng: 2.2125 },
      { lat: 41.4080, lng: 2.2050 },
    ],
  },
];

export default parks;
