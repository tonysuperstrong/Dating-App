
const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';

export interface Game {
  id: string;
  name: string;
  shortName: string;
  date: string;
  status: string;
  league: string;
}

const fetchFromESPN = async (endpoint: string, leagueName: string): Promise<Game[]> => {
  try {
    const response = await fetch(`${BASE_URL}/${endpoint}`);
    const data = await response.json();
    
    if (!data.events) return [];

    return data.events.map((event: any) => ({
      id: event.id,
      name: event.name, // e.g., "New York Knicks at Boston Celtics"
      shortName: event.shortName, // e.g., "NY @ BOS"
      date: event.date,
      status: event.status?.type?.description || 'Scheduled',
      league: leagueName
    }));
  } catch (error) {
    console.error(`Error fetching ${leagueName}:`, error);
    return [];
  }
};

// Mock data for fallback when API fails or returns no games
const MOCK_GAMES: Record<string, Game[]> = {
  'NBA': [
    { id: 'm1', name: 'Lakers at Warriors', shortName: 'LAL @ GSW', date: new Date().toISOString(), status: 'Scheduled', league: 'NBA' },
    { id: 'm2', name: 'Celtics at Heat', shortName: 'BOS @ MIA', date: new Date().toISOString(), status: 'Scheduled', league: 'NBA' }
  ],
  'Soccer': [
    { id: 'm3', name: 'Arsenal at Chelsea', shortName: 'ARS @ CHE', date: new Date().toISOString(), status: 'Scheduled', league: 'Premier League' },
    { id: 'm4', name: 'Real Madrid at Barcelona', shortName: 'RMA @ BAR', date: new Date().toISOString(), status: 'Scheduled', league: 'La Liga' }
  ],
  'ATP': [
    { id: 'm5', name: 'Alcaraz vs Sinner', shortName: 'ALC vs SIN', date: new Date().toISOString(), status: 'Scheduled', league: 'ATP' },
    { id: 'm6', name: 'Djokovic vs Nadal', shortName: 'DJO vs NAD', date: new Date().toISOString(), status: 'Scheduled', league: 'ATP' }
  ]
};

export const SportsService = {
  getNBAGames: async () => {
    const games = await fetchFromESPN('basketball/nba/scoreboard', 'NBA');
    return games.length > 0 ? games : MOCK_GAMES['NBA'];
  },

  getSoccerGames: async () => {
    const leagues = [
      { code: 'soccer/eng.1/scoreboard', name: 'Premier League' },
      { code: 'soccer/esp.1/scoreboard', name: 'La Liga' },
      { code: 'soccer/ger.1/scoreboard', name: 'Bundesliga' },
      { code: 'soccer/ita.1/scoreboard', name: 'Serie A' },
      { code: 'soccer/fra.1/scoreboard', name: 'Ligue 1' },
    ];

    const promises = leagues.map(l => fetchFromESPN(l.code, l.name));
    const results = await Promise.all(promises);
    const games = results.flat();
    return games.length > 0 ? games : MOCK_GAMES['Soccer'];
  },

  getTennisGames: async () => {
    const games = await fetchFromESPN('tennis/atp/scoreboard', 'ATP');
    return games.length > 0 ? games : MOCK_GAMES['ATP'];
  }
};
