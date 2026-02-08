
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

export const SportsService = {
  getNBAGames: async () => {
    return fetchFromESPN('basketball/nba/scoreboard', 'NBA');
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
    return results.flat();
  },

  getTennisGames: async () => {
    return fetchFromESPN('tennis/atp/scoreboard', 'ATP');
  }
};
