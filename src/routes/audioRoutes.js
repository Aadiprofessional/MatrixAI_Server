import { Hono } from 'hono';
import { getSupabaseClient } from '../config/database.js';

const audioRoutes = new Hono();

// Generate unique audio ID
const generateAudioId = () => {
  return 'audio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Get audio duration from URL
const getAudioDuration = async (audioUrl) => {
  try {
    // This is a placeholder - in production, you might want to use a more robust method
    // For now, we'll return a default duration and update it later if needed
    return 60; // Default 60 seconds
  } catch (error) {
    console.error('Error getting audio duration:', error);
    return 60; // Default fallback
  }
};

// Transcribe audio using Deepgram API
const transcribeAudioWithDeepgram = async (audioUrl, language = "en-GB", env) => {
  try {
    const DEEPGRAM_API_URL = env.DEEPGRAM_API_URL;
    const DEEPGRAM_API_KEY = env.DEEPGRAM_API_KEY;

    const response = await fetch(`${DEEPGRAM_API_URL}?smart_format=true&language=${language}&model=whisper`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: audioUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Deepgram API error:", errorText);
      throw new Error(`Deepgram API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Deepgram API response:", JSON.stringify(data));

    // Extract the transcript from the Deepgram response
    const transcript = data.results?.channels[0]?.alternatives[0]?.transcript || "";
    
    // Extract word-level data with timestamps
    const words = data.results?.channels[0]?.alternatives[0]?.words || [];
    
    return {
      transcription: transcript,
      jsonResponse: words,
    };
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return { transcription: "", jsonResponse: null };
  }
};

// Check user coins and deduct if sufficient
const checkAndDeductCoins = async (supabase, uid, requiredCoins) => {
  try {
    // Check if user has enough coins
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("user_coins")
      .eq("uid", uid)
      .single();

    if (userError || !userData) {
      throw new Error("Failed to fetch user data");
    }

    const userCoins = userData.user_coins;
    
    if (userCoins < requiredCoins) {
      throw new Error("Insufficient coins. Please buy more coins.");
    }

    // Get current timestamp in Hong Kong timezone
    const hongKongTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" });

    // Deduct coins using the external API
    const coinDeductionResponse = await fetch("https://matrix-server.vercel.app/subtractCoins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uid: uid,
        coinAmount: requiredCoins,
        transaction_name: "Audio Transcription",
        transaction_time: hongKongTime
      }),
    });

    const coinDeductionResult = await coinDeductionResponse.json();
    
    if (!coinDeductionResponse.ok || !coinDeductionResult.success) {
      throw new Error("Failed to deduct coins");
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
};

// Process audio transcription in background
const processAudioTranscription = async (supabase, uid, audioid, audioUrl, language, env) => {
  try {
    // Get audio duration (placeholder implementation)
    const duration = await getAudioDuration(audioUrl);
    
    // Calculate required coins: 2 coins per minute of audio
    const requiredCoins = Math.ceil(duration * 2);

    // Check and deduct coins
    await checkAndDeductCoins(supabase, uid, requiredCoins);

    // Update status to processing
    await supabase
      .from('audio_metadata')
      .update({ 
        status: 'processing',
        duration: duration 
      })
      .eq('uid', uid)
      .eq('audioid', audioid);

    // Transcribe the audio using Deepgram
    const transcriptionResult = await transcribeAudioWithDeepgram(audioUrl, language, env);

    if (!transcriptionResult.transcription) {
      throw new Error("Failed to transcribe audio");
    }

    // Update with transcription results
    await supabase
      .from('audio_metadata')
      .update({ 
        transcription: transcriptionResult.transcription,
        words_data: transcriptionResult.jsonResponse,
        status: 'completed'
      })
      .eq('uid', uid)
      .eq('audioid', audioid);

    console.log(`Audio transcription completed for ${audioid}`);
  } catch (error) {
    console.error(`Error processing audio ${audioid}:`, error);
    
    // Update status to failed
    await supabase
      .from('audio_metadata')
      .update({ 
        status: 'failed',
        error_message: error.message
      })
      .eq('uid', uid)
      .eq('audioid', audioid);
  }
};

// Upload audio URL and get unique audioid
audioRoutes.post('/uploadAudioUrl', async (c) => {
  try {
    const { uid, audioUrl, audioName, language = "en-GB" } = await c.req.json();

    if (!uid || !audioUrl) {
      return c.json({ error: 'UID and audioUrl are required' }, 400);
    }

    // Validate audio URL format
    try {
      new URL(audioUrl);
    } catch (error) {
      return c.json({ error: 'Invalid audio URL format' }, 400);
    }

    // Check URL length (database limit is 255 characters)
    if (audioUrl.length > 255) {
      return c.json({ error: 'Audio URL is too long (maximum 255 characters)' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Generate unique audio ID
    const audioid = generateAudioId();

    // Generate file path based on uid and audioid (required by database)
    const filePath = `${uid}/audio/${audioid}`;

    // Create initial record with pending status
    const { error: insertError } = await supabase
      .from('audio_metadata')
      .insert([{
        uid,
        audioid,
        audio_name: audioName || 'Untitled Audio',
        audio_url: audioUrl,
        language,
        status: 'pending',
        uploaded_at: new Date().toISOString(),
        transcription: null,
        words_data: null,
        duration: null,
        file_path: filePath
      }]);

    if (insertError) {
      console.error('Error creating audio record:', insertError);
      return c.json({ error: 'Failed to create audio record' }, 500);
    }

    // Start background processing (don't await this)
    processAudioTranscription(supabase, uid, audioid, audioUrl, language, c.env)
      .catch(error => {
        console.error('Background processing error:', error);
      });

    return c.json({ 
      success: true,
      audioid: audioid,
      status: 'pending',
      message: 'Audio upload initiated. Use the audioid to check status.'
    });
  } catch (err) {
    console.error('Error processing request:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get audio status and transcription by audioid
audioRoutes.post('/getAudioStatus', async (c) => {
  try {
    const { uid, audioid } = await c.req.json();

    if (!uid || !audioid) {
      return c.json({ error: 'Both UID and audioid are required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Query the database for audio metadata
    const { data: audioData, error: fetchError } = await supabase
      .from('audio_metadata')
      .select('audioid, audio_name, audio_url, language, status, transcription, words_data, duration, uploaded_at, error_message')
      .eq('uid', uid)
      .eq('audioid', audioid)
      .single();

    if (fetchError) {
      console.error('Error fetching audio data:', fetchError);
      return c.json({ error: 'Failed to fetch audio data' }, 500);
    }

    if (!audioData) {
      return c.json({ error: 'Audio not found' }, 404);
    }

    // Return different responses based on status
    const response = {
      audioid: audioData.audioid,
      audio_name: audioData.audio_name,
      audio_url: audioData.audio_url,
      language: audioData.language,
      status: audioData.status,
      uploaded_at: audioData.uploaded_at,
      duration: audioData.duration
    };

    switch (audioData.status) {
      case 'pending':
        response.message = 'Audio is queued for processing';
        break;
      case 'processing':
        response.message = 'Audio is currently being transcribed';
        break;
      case 'completed':
        response.message = 'Audio transcription completed';
        response.transcription = audioData.transcription;
        response.words_data = audioData.words_data;
        break;
      case 'failed':
        response.message = 'Audio transcription failed';
        response.error_message = audioData.error_message;
        break;
      default:
        response.message = 'Unknown status';
    }

    return c.json(response);
  } catch (err) {
    console.error('Error processing request:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get audio file details by UID and audio ID
audioRoutes.post('/getAudioFile', async (c) => {
  try {
    const { uid, audioid } = await c.req.json();

    if (!uid || !audioid) {
      return c.json({ error: 'Both UID and Audio ID are required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Query the database for audio metadata by UID and Audio ID
    const { data: audioMetadata, error: metadataError } = await supabase
      .from('audio_metadata')
      .select('audioid, audio_name, duration, uploaded_at, transcription, xml_data, file_path, audio_url, language, words_data')
      .eq('uid', uid)
      .eq('audioid', audioid);

    if (metadataError) {
      console.error('Error retrieving audio metadata:', metadataError);
      return c.json({ error: 'Failed to retrieve audio metadata' }, 500);
    }

    if (!audioMetadata || audioMetadata.length === 0) {
      return c.json({ error: 'No audio data found for the given UID and Audio ID' }, 404);
    }

    return c.json(audioMetadata[0]);
  } catch (err) {
    console.error('Error processing request:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all audio files for a user by UID
audioRoutes.get('/getAudio/:uid', async (c) => {
  try {
    const uid = c.req.param('uid');

    if (!uid) {
      return c.json({ error: 'UID is required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Query the database for audio metadata by UID
    const { data, error } = await supabase
      .from('audio_metadata')
      .select('audioid, duration, uploaded_at, audio_name, audio_url, language')
      .eq('uid', uid);

    if (error) {
      console.error('Error retrieving audio metadata:', error);
      return c.json({ error: 'Failed to retrieve audio metadata' }, 500);
    }

    if (data.length === 0) {
      return c.json({ error: 'No audio data found for the given UID' }, 404);
    }

    return c.json({ audioData: data });
  } catch (err) {
    console.error('Error processing request:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Remove audio file and metadata
audioRoutes.post('/removeAudio', async (c) => {
  try {
    const { uid, audioid } = await c.req.json();

    if (!uid || !audioid) {
      return c.json({ error: 'UID and audioid are required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Delete the audio metadata from the database
    const { error: dbError } = await supabase
      .from('audio_metadata')
      .delete()
      .eq('uid', uid)
      .eq('audioid', audioid);

    if (dbError) {
      console.error('Error deleting metadata:', dbError);
      return c.json({ error: 'Failed to delete audio metadata' }, 500);
    }

    // Delete the audio file from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('user-uploads')
      .remove([`${uid}/audio/${audioid}_*`]);

    if (storageError) {
      console.error('Error deleting audio file:', storageError);
      return c.json({ error: 'Failed to delete audio file' }, 500);
    }

    return c.json({ message: 'Audio removed successfully' });
  } catch (err) {
    console.error('Error processing request:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Edit audio file name
audioRoutes.post('/editAudio', async (c) => {
  try {
    const { uid, audioid, updatedName } = await c.req.json();

    if (!uid || !audioid || !updatedName) {
      return c.json({ error: 'UID, audioid, and updated name are required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Update the audio name in the database
    const { data, error } = await supabase
      .from('audio_metadata')
      .update({ audio_name: updatedName })
      .eq('uid', uid)
      .eq('audioid', audioid);

    if (error) {
      console.error('Error updating audio name:', error);
      return c.json({ error: 'Failed to update audio name' }, 500);
    }

    return c.json({ message: 'Audio name updated successfully', updatedAudio: data });
  } catch (err) {
    console.error('Error processing request:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Save XML graph data for audio
audioRoutes.post('/sendXmlGraph', async (c) => {
  try {
    const { uid, audioid, xmlData } = await c.req.json();

    if (!uid || !audioid || !xmlData) {
      return c.json({ error: 'Missing required fields: uid, audioid, or xmlData' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Fetch the existing record using uid and audioid to get the file_path
    const { data: existingData, error: fetchError } = await supabase
      .from('audio_metadata')
      .select('file_path')
      .eq('uid', uid)
      .eq('audioid', audioid)
      .single();

    // Handle error in fetching the data
    if (fetchError && fetchError.code !== 'PGRST100') {
      throw new Error(fetchError.message);
    }

    // If the record exists, update it; otherwise, insert a new record
    let result;
    if (existingData) {
      // Update the record if it exists
      result = await supabase
        .from('audio_metadata')
        .update({ xml_data: xmlData })
        .eq('uid', uid)
        .eq('audioid', audioid);
    } else {
      // Insert a new record if it does not exist
      result = await supabase
        .from('audio_metadata')
        .insert([{ uid, audioid, file_path: '', xml_data: xmlData }]);
    }

    // Check if there was an error while inserting/updating
    if (result.error) {
      throw new Error(result.error.message);
    }

    return c.json({ message: 'XML data saved successfully!', data: result.data });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

export default audioRoutes; 