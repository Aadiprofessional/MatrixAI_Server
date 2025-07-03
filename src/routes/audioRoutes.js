import { Hono } from 'hono';
import { getSupabaseClient } from '../config/database.js';

const audioRoutes = new Hono();

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