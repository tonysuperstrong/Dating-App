import { Alert } from 'react-native';

// Using Pollinations.ai (Free, No API Key required)
// This service proxies to OpenAI/other models for free.
// Endpoint: https://text.pollinations.ai/openai

const SYSTEM_PROMPT = `
You are an AI Dating Assistant for a mobile app. Your goal is to help users plan dates, find restaurants, and suggest travel spots.
You are helpful, romantic, and concise.

You MUST return your response in a valid JSON format. Do not include any markdown formatting (like \`\`\`json) outside of the JSON string itself.

The JSON object must have the following fields:
- text (string): The conversational response to the user. You can use markdown in the text string (e.g., **bold**, lists).
- imageKeyword (optional string): A single keyword to search for an image relevant to your suggestion (e.g., 'sushi', 'romantic dinner', 'hiking').
- locations (optional array): A list of locations mentioned in your response. Each item should have:
    - name (string): The display name (e.g. "Joe's Pizza").
    - query (string): The search query for Google Maps (e.g. "Joe's Pizza New York").
    - time (optional string): Suggested time or duration (e.g. "7:00 PM" or "2 hours").
    - description (optional string): A short reason why this place is recommended (e.g. "Best wood-fired pizza in town").
- planDetails (optional object): If the user agrees to a specific plan or explicitly asks to generate/save a plan, provide this object:
    - title (string): Title of the event.
    - date (string): YYYY-MM-DD format.
    - time (string): HH:MM format (24h).
    - description (string): Full, structured details of the plan. Use bullet points and newlines for clarity.

If the user input is a greeting or general chat, just provide the 'text' field.
`;

export interface AIResponseData {
  text: string;
  imageKeyword?: string;
  locations?: { 
    name: string; 
    query: string;
    time?: string;
    description?: string;
  }[];
  locationQuery?: string; // Deprecated
  locationName?: string;  // Deprecated
  planDetails?: {
    title: string;
    date: string;
    time: string;
    description: string;
  };
}

export const generateIcebreaker = async (
  otherUserName: string,
  otherUserHobbies: string | string[],
  userHobbies: string | string[]
): Promise<string> => {
  try {
    const hobbiesStr = Array.isArray(otherUserHobbies) ? otherUserHobbies.join(', ') : otherUserHobbies;
    const myHobbiesStr = Array.isArray(userHobbies) ? userHobbies.join(', ') : userHobbies;
    
    const prompt = `
      Generate a fun, engaging, and short icebreaker message to start a conversation on a dating app.
      Target User: ${otherUserName}
      Target's Hobbies: ${hobbiesStr || 'Unknown'}
      My Hobbies: ${myHobbiesStr || 'Unknown'}
      
      The message should be casual, friendly, and related to their hobbies if possible. 
      Do not use hashtags. Keep it under 150 characters.
      Just return the message text.
    `;

    const response = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content.trim().replace(/^"|"$/g, '');
  } catch (error) {
    console.error('Error generating icebreaker:', error);
    return "Hi! I noticed we have some similar interests. How's your week going?";
  }
};

export const fetchAIResponse = async (
  userMessage: string, 
  userLocation: string,
  history: { role: 'user' | 'assistant', content: string }[] = []
): Promise<AIResponseData | null> => {
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT + `\nUser Location: ${userLocation}\nToday's Date: ${new Date().toISOString().split('T')[0]}` },
      ...history,
      { role: 'user', content: userMessage }
    ];

    const response = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai', // Reverted to standard 'openai' model as 'openai-large' is deprecated/not found
        messages: messages,
        temperature: 0.7,
        jsonMode: true 
      }),
    });

    const data = await response.json();
    // console.log('Pollinations Response Status:', response.status);
    
    if (!response.ok) {
        console.error('Pollinations API Error Response:', JSON.stringify(data, null, 2));
        throw new Error(data.error?.message || 'Unknown API Error');
    }

    const content = data.choices[0].message.content;
    // Clean content if it contains markdown code blocks
    let cleanContent = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
    if (jsonMatch) {
        cleanContent = jsonMatch[1];
    }

    // console.log('Cleaned Content:', cleanContent);
    
    try {
        const parsedContent: AIResponseData = JSON.parse(cleanContent);
        return parsedContent;
    } catch (parseError) {
        console.error('Failed to parse JSON content:', cleanContent);
        // Fallback: try to just return text if JSON fails
        return {
            text: cleanContent.replace(/[{}]/g, '') // strip braces if it was partial json
        } as AIResponseData; 
    }

  } catch (error) {
    console.error('Error fetching Pollinations response:', error);
    return null;
  }
};

const FUNNY_SYSTEM_PROMPT = `
You are a witty and charming dating coach. Your goal is to rewrite the user's message to be more engaging, funny, and charismatic.
Guidelines:
- Inject humor or playful teasing.
- Make it sound natural and conversational.
- Provide variety.
- If the input is boring, spice it up!
Return ONLY the polished text.
`;

const CHARMING_SYSTEM_PROMPT = `
You are a helpful writing assistant. Your task is to polish the user's message to be more grammatically correct, natural, and charming for a dating context.
Guidelines:
- Keep the same meaning, but make it sound smoother and more confident.
- Fix any grammar or spelling issues.
- Be polite but not overly formal.
Return ONLY the polished text.
`;

export const polishMessage = async (text: string, style: 'funny' | 'charming' = 'charming'): Promise<string | null> => {
  try {
    const prompt = style === 'funny' ? FUNNY_SYSTEM_PROMPT : CHARMING_SYSTEM_PROMPT;
    const userPrompt = style === 'funny' 
        ? `Rewrite this message to be funny and humorous: "${text}"`
        : `Rewrite this message to be charming and polished: "${text}"`;

    const response = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: style === 'funny' ? 0.9 : 0.7,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error?.message || 'Unknown API Error');
    }

    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error polishing message:', error);
    return null;
  }
};
