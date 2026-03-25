/**
 * Week 17: OBS & TTS Integration
 * Connects to ElevenLabs (or similar TTS api) to give the agent a voice during live streams.
 */
export const generateSpeech = async (text: string, agentAge: number) => {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_API_KEY) {
    console.warn(`[TTS Engine] ⚠️ No API key found. Simulating Speech output: "${text}"`);
    return null; // Return simulated audio buffer
  }

  try {
    console.log(`[TTS Engine] Generating streaming voice for Agent Age: ${agentAge}`);
    // Base implementation URL
    const url = "https://api.elevenlabs.io/v1/text-to-speech/voice-id-placeholder/stream";
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        voice_settings: {
          stability: agentAge < 25 ? 0.3 : 0.7, // Younger agent = more energetic/erratic speech patterns
          similarity_boost: 0.7
        }
      })
    });

    if (!response.ok) throw new Error("TTS Generation failed.");
    console.log(`✅ [TTS Engine] Successfully generated streaming audio chunk.`);
    
    // Returns the audio stream to be piped into OBS/Virtual Cable
    return response.body; 

  } catch (error) {
    console.error("❌ [TTS Engine] Error:", error);
    return null;
  }
};
