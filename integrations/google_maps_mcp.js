/**
 * Google Maps MCP Integration — fully wired
 * Operations: geocode, reverseGeocode, directions, distanceMatrix,
 *             placeSearch, placeDetails, elevation
 */
export class GoogleMapsMCP {
  constructor() {
    this._apiKey = null;
    this._baseUrl = 'https://maps.googleapis.com/maps/api';
    this._connected = false;
    this.operations = {
      geocode: (p) => this._geocode(p),
      reverseGeocode: (p) => this._reverseGeocode(p),
      directions: (p) => this._directions(p),
      distanceMatrix: (p) => this._distanceMatrix(p),
      placeSearch: (p) => this._placeSearch(p),
      placeDetails: (p) => this._placeDetails(p),
      elevation: (p) => this._elevation(p),
    };
  }
  async connect(config = {}) {
    const key = config.apiKey || process.env.GOOGLE_MAPS_API_KEY;
    if (!key) throw new Error('GoogleMaps: apiKey required (config.apiKey or GOOGLE_MAPS_API_KEY env var)');
    this._apiKey = key;
    this._connected = true;
    return { connected: true };
  }
  async disconnect() { this._apiKey = null; this._connected = false; }
  isConnected() { return this._connected; }
  async _geocode({ address }) {
    if (!address) throw new Error('GoogleMaps geocode: address required');
    return this._fetch('/geocode/json', { address });
  }
  async _reverseGeocode({ lat, lng }) {
    if (!lat || !lng) throw new Error('GoogleMaps reverseGeocode: lat and lng required');
    return this._fetch('/geocode/json', { latlng: `${lat},${lng}` });
  }
  async _directions({ origin, destination, mode = 'driving', waypoints, avoid }) {
    if (!origin || !destination) throw new Error('GoogleMaps directions: origin and destination required');
    const params = { origin, destination, mode };
    if (waypoints?.length) params.waypoints = waypoints.join('|');
    if (avoid) params.avoid = avoid;
    return this._fetch('/directions/json', params);
  }
  async _distanceMatrix({ origins, destinations, mode = 'driving' }) {
    if (!origins?.length || !destinations?.length) throw new Error('GoogleMaps distanceMatrix: origins and destinations required');
    return this._fetch('/distancematrix/json', {
      origins: origins.join('|'), destinations: destinations.join('|'), mode,
    });
  }
  async _placeSearch({ query, location, radius, type }) {
    if (!query && !location) throw new Error('GoogleMaps placeSearch: query or location required');
    const params = {};
    if (query) { params.query = query; }
    if (location) { params.location = location; params.radius = radius || 1000; }
    if (type) params.type = type;
    const endpoint = query ? '/place/textsearch/json' : '/place/nearbysearch/json';
    return this._fetch(endpoint, params);
  }
  async _placeDetails({ place_id, fields = 'name,formatted_address,rating,opening_hours,geometry' }) {
    if (!place_id) throw new Error('GoogleMaps placeDetails: place_id required');
    return this._fetch('/place/details/json', { place_id, fields });
  }
  async _elevation({ locations }) {
    if (!locations?.length) throw new Error('GoogleMaps elevation: locations array required [{lat,lng}]');
    return this._fetch('/elevation/json', { locations: locations.map(l => `${l.lat},${l.lng}`).join('|') });
  }
  async _fetch(path, params = {}) {
    const p = new URLSearchParams({ ...params, key: this._apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${this._baseUrl}${path}?${p}`, { signal: controller.signal });
      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok || json.status === 'REQUEST_DENIED' || json.status === 'INVALID_REQUEST') {
        throw new Error(`GoogleMaps API ${path} => ${json.status}: ${json.error_message || JSON.stringify(json)}`);
      }
      return json;
    } catch (err) { clearTimeout(timeout); throw err; }
  }
}
export default GoogleMapsMCP;
