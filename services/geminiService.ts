import { GoogleGenAI } from "@google/genai";
import { ParkingStats, ParkingSpot } from "../types";

const apiKey = process.env.API_KEY || '';

// Initialize the Gemini client
// We create a new instance per call in the component usually to handle key updates, 
// but here we assume a static env key or handled via context if dynamic. 
// For this architecture, we instantiate here for simplicity as the prompt implies env var usage.
const ai = new GoogleGenAI({ apiKey });

export const generateParkingInsights = async (stats: ParkingStats, spots: ParkingSpot[]): Promise<string> => {
  if (!apiKey) return "API Key is missing. Please configure your environment.";

  try {
    const model = 'gemini-2.5-flash';
    
    const prompt = `
      You are an expert Facility Manager AI. Analyze the current parking status provided below.
      
      Current Stats:
      - Cars: ${stats.occupiedCars}/${stats.totalCars} occupied
      - Motorcycles: ${stats.occupiedMotos}/${stats.totalMotos} occupied
      - Total Occupancy Rate: ${stats.occupancyRate.toFixed(1)}%

      Provide a concise, 2-sentence executive summary. 
      First sentence: Comment on the current congestion level.
      Second sentence: Give a specific recommendation (e.g., "Open overflow lot", "Reduce security checks", "Monitor Section B").
      Tone: Professional and operational.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text || "No insights available.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate insights at this time.";
  }
};

export const simulateTrafficScenario = async (currentSpots: ParkingSpot[], scenarioDescription: string): Promise<ParkingSpot[]> => {
  if (!apiKey) throw new Error("API Key missing");

  const model = 'gemini-2.5-flash';
  
  // We send a simplified map to save tokens, just IDs
  const spotIds = currentSpots.map(s => s.id);

  const prompt = `
    I have a parking lot with ${currentSpots.length} spots.
    The spots are identified by IDs: ${JSON.stringify(spotIds)}.
    
    Scenario: "${scenarioDescription}"
    
    Based on this scenario, decide which spots should be OCCUPIED and which should be FREE.
    Return a JSON object where keys are spot IDs and values are strings: "OCCUPIED" or "FREE".
    Do not return Markdown. Just the JSON string.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const resultText = response.text;
    if (!resultText) return currentSpots;

    const statusMap = JSON.parse(resultText) as Record<string, string>;

    return currentSpots.map(spot => ({
      ...spot,
      status: (statusMap[spot.id] === 'OCCUPIED') ? 'OCCUPIED' : 'FREE' as any,
      lastUpdated: new Date()
    }));

  } catch (error) {
    console.error("Gemini Simulation Error:", error);
    return currentSpots;
  }
};