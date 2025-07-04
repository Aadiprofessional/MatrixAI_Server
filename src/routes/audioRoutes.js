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

// Check if user has sufficient coins (without deducting)
const checkUserCoins = async (supabase, uid, requiredCoins) => {
  try {
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

    return { success: true, userCoins };
  } catch (error) {
    throw error;
  }
};

// Deduct coins from user account
const deductCoins = async (uid, requiredCoins, env) => {
  try {
    const coinDeductionResponse = await fetch(`${env.BASE_URL || 'http://localhost:8787'}/api/user/subtractCoins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uid: uid,
        coinAmount: requiredCoins,
        transaction_name: "Audio Transcription"
      }),
    });

    if (!coinDeductionResponse.ok) {
      const errorText = await coinDeductionResponse.text();
      throw new Error(`Failed to deduct coins: ${errorText}`);
    }

    const coinDeductionResult = await coinDeductionResponse.json();
    
    if (!coinDeductionResult.success) {
      throw new Error(coinDeductionResult.message || "Failed to deduct coins");
    }

    return { success: true };
  } catch (error) {
    throw error;
  }
};

// Upload audio URL and start background transcription using direct background processing
audioRoutes.post('/uploadAudioUrl', async (c) => {
  try {
    const { uid, audioUrl, audioName, language = "en-GB", duration } = await c.req.json();

    if (!uid || !audioUrl) {
      return c.json({ error: 'UID and audioUrl are required' }, 400);
    }

    if (!duration || duration <= 0) {
      return c.json({ error: 'Duration is required and must be greater than 0' }, 400);
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

    // Calculate required coins with new logic:
    // - Minimum 2 coins for audio less than 1 minute
    // - 2 coins per minute, rounded up to whole numbers for longer audio
    const requiredCoins = Math.max(2, Math.ceil(duration * 2));

    // Check if user has sufficient coins BEFORE creating the record
    try {
      await checkUserCoins(supabase, uid, requiredCoins);
    } catch (error) {
      return c.json({ error: error.message }, 400);
    }

    // Deduct coins upfront
    try {
      await deductCoins(uid, requiredCoins, c.env);
    } catch (error) {
      return c.json({ error: error.message }, 400);
    }

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
        duration: duration,
        file_path: filePath
      }]);

    if (insertError) {
      console.error('Error creating audio record:', insertError);
      return c.json({ error: 'Failed to create audio record' }, 500);
    }

    // Start background transcription using direct background processing
    try {
      // Get execution context for waitUntil
      const executionCtx = c.executionCtx;
      
      // Create background processing function
      const processTranscription = async () => {
        try {
          console.log(`Starting background transcription for audioid: ${audioid}`);
          
          // Update status to processing
          await supabase
            .from('audio_metadata')
            .update({ status: 'processing' })
            .eq('uid', uid)
            .eq('audioid', audioid);

          // Add a small delay to ensure the upload response is sent first
          await new Promise(resolve => setTimeout(resolve, 100));

          // Transcribe the audio using Deepgram
          const transcriptionResult = await transcribeAudioWithDeepgram(audioUrl, language, c.env);

          if (!transcriptionResult.transcription) {
            throw new Error("Failed to transcribe audio - empty transcription returned");
          }

          console.log(`Transcription completed for audioid: ${audioid}, length: ${transcriptionResult.transcription.length}`);

          // Update with transcription results
          const { error: transcriptionUpdateError } = await supabase
            .from('audio_metadata')
            .update({ 
              transcription: transcriptionResult.transcription,
              words_data: transcriptionResult.jsonResponse,
              status: 'completed'
            })
            .eq('uid', uid)
            .eq('audioid', audioid);

          if (transcriptionUpdateError) {
            console.error('Error updating transcription results:', transcriptionUpdateError);
            throw new Error('Failed to save transcription results');
          }

          console.log(`Successfully completed transcription for audioid: ${audioid}`);
          
        } catch (error) {
          console.error(`Error in background transcription:`, error);
          
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
      
      // Start background processing
      if (executionCtx && executionCtx.waitUntil) {
        executionCtx.waitUntil(processTranscription());
      } else {
        // Fallback: fire and forget
        processTranscription().catch(error => console.error('Background transcription error:', error));
      }
      
      console.log(`Audio transcription job started for audioid: ${audioid}`);
    } catch (error) {
      console.error('Error starting transcription job:', error);
      // If background job fails to start, update status to failed
      await supabase
        .from('audio_metadata')
        .update({ 
          status: 'failed',
          error_message: 'Failed to start transcription job'
        })
        .eq('uid', uid)
        .eq('audioid', audioid);
      
      return c.json({ error: 'Failed to start transcription job' }, 500);
    }

    // Return immediately with audioid - transcription happens in background
    return c.json({ 
      success: true,
      audioid: audioid,
      status: 'pending',
      message: 'Audio upload successful. Transcription is being processed in the background.',
      required_coins: requiredCoins
    });
    
  } catch (err) {
    console.error('Error in uploadAudioUrl:', err);
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

    // Retrieve the audio metadata from the database
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

    // Return status based on current state
    if (audioData.status === 'completed' && audioData.transcription) {
      const words = audioData.transcription.split(' ');
      const preview = words.slice(0, 15).join(' ');
      
      return c.json({
        audioid: audioData.audioid,
        audio_name: audioData.audio_name,
        audio_url: audioData.audio_url,
        language: audioData.language,
        status: 'completed',
        uploaded_at: audioData.uploaded_at,
        duration: audioData.duration,
        message: 'Audio transcription completed successfully',
        transcription_preview: preview + (words.length > 15 ? '...' : ''),
        word_count: words.length
      });
      
    } else if (audioData.status === 'failed') {
      return c.json({
        audioid: audioData.audioid,
        audio_name: audioData.audio_name,
        status: 'failed',
        message: 'Audio transcription failed',
        error_message: audioData.error_message,
        uploaded_at: audioData.uploaded_at,
        duration: audioData.duration
      });
      
    } else if (audioData.status === 'processing') {
      return c.json({
        audioid: audioData.audioid,
        audio_name: audioData.audio_name,
        status: 'processing',
        message: 'Audio transcription is currently being processed',
        uploaded_at: audioData.uploaded_at,
        duration: audioData.duration
      });
      
    } else {
      return c.json({
        audioid: audioData.audioid,
        audio_name: audioData.audio_name,
        status: 'pending',
        message: 'Audio transcription is queued for processing',
        uploaded_at: audioData.uploaded_at,
        duration: audioData.duration
      });
    }
    
  } catch (err) {
    console.error('Error in getAudioStatus:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get full audio file details by UID and audio ID
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
      .select('audioid, audio_name, duration, uploaded_at, transcription, xml_data, file_path, audio_url, language, words_data, status, error_message')
      .eq('uid', uid)
      .eq('audioid', audioid)
      .single();

    if (metadataError) {
      console.error('Error retrieving audio metadata:', metadataError);
      return c.json({ error: 'Failed to retrieve audio metadata' }, 500);
    }

    if (!audioMetadata) {
      return c.json({ error: 'No audio data found for the given UID and Audio ID' }, 404);
    }

    // Prepare base response
    const response = {
      audioid: audioMetadata.audioid,
      audio_name: audioMetadata.audio_name,
      audio_url: audioMetadata.audio_url,
      language: audioMetadata.language,
      duration: audioMetadata.duration,
      uploaded_at: audioMetadata.uploaded_at,
      status: audioMetadata.status,
      file_path: audioMetadata.file_path,
      xml_data: audioMetadata.xml_data
    };

    // Handle response based on status
    if (audioMetadata.status === 'completed' && audioMetadata.transcription) {
      response.transcription = audioMetadata.transcription;
      response.words_data = audioMetadata.words_data;
      response.message = 'Full transcription available';
      
    } else if (audioMetadata.status === 'failed') {
      response.error_message = audioMetadata.error_message;
      response.message = 'Transcription failed';
      
    } else if (audioMetadata.status === 'processing') {
      response.message = 'Transcription in progress';
      
    } else {
      response.message = 'Transcription pending';
    }

    return c.json(response);
    
  } catch (err) {
    console.error('Error in getAudioFile:', err);
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
      .select('audioid, duration, uploaded_at, audio_name, audio_url, language, status')
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