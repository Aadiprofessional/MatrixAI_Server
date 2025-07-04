import { Hono } from 'hono';
import { getSupabaseClient } from '../config/database.js';

const videoRoutes = new Hono();

// Generate unique video ID
const generateVideoId = () => {
  return 'video_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Download video and upload to Supabase storage
const downloadAndUploadVideo = async (videoUrl, uid, videoId, supabase) => {
  try {
    console.log('Downloading video from:', videoUrl);
    
    // Download the video file with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes timeout
    
    const response = await fetch(videoUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MatrixAI-VideoProcessor/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.status} ${response.statusText}`);
    }
    
    const videoBuffer = await response.arrayBuffer();
    
    // Create file path: users/{uid}/videos/{videoId}.mp4
    const filePath = `users/${uid}/videos/${videoId}.mp4`;
    
    console.log('Uploading video to Supabase storage:', filePath);
    
    // Upload to Supabase storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, videoBuffer, { 
        contentType: 'video/mp4',
        upsert: true // Allow overwriting if file exists
      });

    if (storageError) {
      console.error('Storage upload error:', storageError);
      throw new Error(`Failed to upload video to storage: ${storageError.message}`);
    }

    console.log('Video uploaded successfully to storage:', storageData);
    
    // Get the public URL
    const { data: urlData } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath);
        
    return urlData.publicUrl;
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error("Video download timeout after 5 minutes");
      throw new Error("Video download timeout - video file may be too large or service is slow");
    }
    console.error('Error downloading and uploading video:', error);
    throw error;
  }
};

// Generate video using DashScope API
const generateVideoWithDashScope = async (promptText, size, env) => {
  try {
    const DASHSCOPE_API_KEY = env.DASHSCOPEVIDEO_API_KEY;

    if (!DASHSCOPE_API_KEY) {
      throw new Error('DashScope API configuration missing. Please check DASHSCOPEVIDEO_API_KEY environment variable.');
    }

    console.log(`Starting DashScope video generation for prompt: ${promptText}, Size: ${size}`);

    // Add timeout for DashScope API call (60 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis', {
      method: "POST",
      headers: {
        'X-DashScope-Async': 'enable',
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "wanx2.1-t2v-turbo",
        input: {
          prompt: promptText
        },
        parameters: {
          size: size
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DashScope API error:", response.status, response.statusText, errorText);
      throw new Error(`DashScope API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log("DashScope API response received, processing...");

    const { request_id, output } = data;
    const taskId = output?.task_id;
    const taskStatus = output?.task_status;
    
    console.log(`Video generation initiated: taskId=${taskId}, status=${taskStatus}`);
    
    return {
      request_id,
      task_id: taskId,
      task_status: taskStatus,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error("DashScope API timeout after 60 seconds");
      throw new Error("Video generation timeout - DashScope service is slow");
    }
    console.error("Error generating video:", error.message || error);
    throw error;
  }
};

// Check video generation status using DashScope API
const checkVideoStatus = async (taskId, env) => {
  try {
    const DASHSCOPE_API_KEY = env.DASHSCOPEVIDEO_API_KEY;

    if (!DASHSCOPE_API_KEY) {
      throw new Error('DashScope API configuration missing.');
    }

    const response = await fetch(`https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DashScope status check error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const { output } = data;
    
    return {
      task_status: output?.task_status,
      video_url: output?.video_url,
      submit_time: output?.submit_time,
      scheduled_time: output?.scheduled_time,
      end_time: output?.end_time,
      orig_prompt: output?.orig_prompt,
      actual_prompt: output?.actual_prompt
    };
  } catch (error) {
    console.error("Error checking video status:", error.message || error);
    throw error;
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
        transaction_name: "Video Generation"
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

// Create video and start background processing
videoRoutes.post('/createVideo', async (c) => {
  try {
    const { uid, promptText, size } = await c.req.json();

    if (!uid || !promptText) {
      return c.json({ error: 'UID and promptText are required' }, 400);
    }

    // Set default size if not provided
    const videoSize = size || "1280*720";

    // Early validation of DashScope configuration
    if (!c.env.DASHSCOPEVIDEO_API_KEY) {
      console.error('Missing DashScope configuration');
      return c.json({ error: 'Video generation service is not properly configured' }, 500);
    }

    // Validate prompt text length (reasonable limit)
    if (promptText.length > 1000) {
      return c.json({ error: 'Prompt text is too long (maximum 1000 characters)' }, 400);
    }

    console.log(`Processing video creation request: uid=${uid}, prompt length=${promptText.length}, size=${videoSize}`);

    const supabase = getSupabaseClient(c.env);

    // Fixed cost: 25 coins for video generation
    const requiredCoins = 25;

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

    // Generate unique video ID
    const videoId = generateVideoId();

    // Generate file path based on uid and videoId
    const filePath = `${uid}/videos/${videoId}`;

    // Create initial record with pending status
    const { error: insertError } = await supabase
      .from('video_metadata')
      .insert([{
        video_id: videoId,
        uid,
        prompt_text: promptText,
        size: videoSize,
        status: 'pending',
        created_at: new Date().toISOString(),
        task_id: null,
        task_status: null,
        request_id: null,
        video_url: null,
        file_path: filePath
      }]);

    if (insertError) {
      console.error('Error creating video record:', insertError);
      return c.json({ error: 'Failed to create video record' }, 500);
    }

    // Start background video generation using direct background processing
    try {
      // Get execution context for waitUntil
      const executionCtx = c.executionCtx;
      
      // Create background processing function
      const processVideoGeneration = async () => {
        try {
          console.log(`Starting background video generation for videoId: ${videoId}`);
          
          // Update status to processing
          const { error: statusUpdateError } = await supabase
            .from('video_metadata')
            .update({ status: 'processing' })
            .eq('uid', uid)
            .eq('video_id', videoId);

          if (statusUpdateError) {
            console.error('Error updating status to processing:', statusUpdateError);
            throw new Error('Failed to update processing status');
          }

          // Add a small delay to ensure the upload response is sent first
          await new Promise(resolve => setTimeout(resolve, 100));

          console.log(`Calling DashScope API for videoId: ${videoId}`);
          
          // Generate the video using DashScope
          const generationResult = await generateVideoWithDashScope(promptText, videoSize, c.env);

          if (!generationResult.task_id) {
            throw new Error("Failed to initiate video generation - no task ID returned");
          }

          console.log(`Video generation initiated for videoId: ${videoId}, taskId: ${generationResult.task_id}`);

          // Update with generation task details
          const { error: taskUpdateError } = await supabase
            .from('video_metadata')
            .update({ 
              task_id: generationResult.task_id,
              task_status: generationResult.task_status,
              request_id: generationResult.request_id,
              status: 'generating'
            })
            .eq('uid', uid)
            .eq('video_id', videoId);

          if (taskUpdateError) {
            console.error('Error updating task details:', taskUpdateError);
            throw new Error('Failed to save task details');
          }

          // Poll for video completion
          const maxPollingTime = 300000; // 5 minutes max
          const pollingInterval = 10000; // 10 seconds
          const startTime = Date.now();
          
          while (Date.now() - startTime < maxPollingTime) {
            await new Promise(resolve => setTimeout(resolve, pollingInterval));
            
            try {
              const statusResult = await checkVideoStatus(generationResult.task_id, c.env);
              
              // Update task status in database
              await supabase
                .from('video_metadata')
                .update({ task_status: statusResult.task_status })
                .eq('uid', uid)
                .eq('video_id', videoId);
              
              if (statusResult.task_status === 'SUCCEEDED' && statusResult.video_url) {
                console.log(`Video generation completed for videoId: ${videoId}`);
                
                try {
                  // Download and upload to Supabase storage
                  const supabaseVideoUrl = await downloadAndUploadVideo(statusResult.video_url, uid, videoId, supabase);
                  
                  // Update with final results
                  const { error: finalUpdateError } = await supabase
                    .from('video_metadata')
                    .update({ 
                      video_url: supabaseVideoUrl,
                      status: 'completed',
                      task_status: statusResult.task_status,
                      submit_time: statusResult.submit_time,
                      scheduled_time: statusResult.scheduled_time,
                      end_time: statusResult.end_time,
                      orig_prompt: statusResult.orig_prompt,
                      actual_prompt: statusResult.actual_prompt
                    })
                    .eq('uid', uid)
                    .eq('video_id', videoId);

                  if (finalUpdateError) {
                    console.error('Error updating final results:', finalUpdateError);
                    throw new Error('Failed to save final results');
                  }
                  
                  console.log(`Successfully completed video generation for videoId: ${videoId}`);
                  return;
                  
                } catch (uploadError) {
                  console.error('Error uploading video to storage:', uploadError);
                  
                  // Fallback: store the original URL if upload fails
                  await supabase
                    .from('video_metadata')
                    .update({ 
                      video_url: statusResult.video_url,
                      status: 'completed',
                      task_status: statusResult.task_status,
                      submit_time: statusResult.submit_time,
                      scheduled_time: statusResult.scheduled_time,
                      end_time: statusResult.end_time,
                      orig_prompt: statusResult.orig_prompt,
                      actual_prompt: statusResult.actual_prompt,
                      error_message: 'Video generated but not uploaded to storage'
                    })
                    .eq('uid', uid)
                    .eq('video_id', videoId);
                  
                  console.log(`Video generation completed with external URL for videoId: ${videoId}`);
                  return;
                }
              } else if (statusResult.task_status === 'FAILED') {
                throw new Error("Video generation failed on DashScope");
              }
              // Continue polling if still in progress
              
            } catch (statusError) {
              console.error('Error checking video status:', statusError);
              // Continue polling unless it's a critical error
            }
          }
          
          // If we reach here, polling timed out
          throw new Error("Video generation timed out - process took longer than expected");
          
        } catch (error) {
          console.error(`Error in background video generation for videoId: ${videoId}:`, error.message || error);
          
          // Update status to failed
          try {
            const { error: failedUpdateError } = await supabase
              .from('video_metadata')
              .update({ 
                status: 'failed',
                error_message: error.message || 'Unknown error occurred during video generation'
              })
              .eq('uid', uid)
              .eq('video_id', videoId);

            if (failedUpdateError) {
              console.error('Error updating failed status:', failedUpdateError);
            }
          } catch (updateError) {
            console.error('Critical error: Could not update failure status:', updateError);
          }
        }
      };
      
      // Start background processing
      if (executionCtx && executionCtx.waitUntil) {
        executionCtx.waitUntil(processVideoGeneration());
      } else {
        // Fallback: fire and forget
        processVideoGeneration().catch(error => console.error('Background video generation error:', error));
      }
      
      console.log(`Video generation job started for videoId: ${videoId}`);
    } catch (error) {
      console.error('Error starting video generation job:', error);
      // If background job fails to start, update status to failed
      await supabase
        .from('video_metadata')
        .update({ 
          status: 'failed',
          error_message: 'Failed to start video generation job'
        })
        .eq('uid', uid)
        .eq('video_id', videoId);
      
      return c.json({ error: 'Failed to start video generation job' }, 500);
    }

    // Return immediately with videoId - generation happens in background
    return c.json({ 
      success: true,
      videoId: videoId,
      status: 'pending',
      message: 'Video creation initiated. Generation is being processed in the background.',
      required_coins: requiredCoins
    });
    
  } catch (err) {
    console.error('Error in createVideo:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get video status by videoId
videoRoutes.post('/getVideoStatus', async (c) => {
  try {
    const { uid, videoId } = await c.req.json();

    if (!uid || !videoId) {
      return c.json({ error: 'Both UID and videoId are required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Retrieve the video metadata from the database
    const { data: videoData, error: fetchError } = await supabase
      .from('video_metadata')
      .select('video_id, prompt_text, size, task_id, task_status, status, video_url, created_at, error_message, submit_time, end_time')
      .eq('uid', uid)
      .eq('video_id', videoId)
      .single();

    if (fetchError) {
      console.error('Error fetching video data:', fetchError);
      return c.json({ error: 'Failed to fetch video data' }, 500);
    }

    if (!videoData) {
      return c.json({ error: 'Video not found' }, 404);
    }

    // Return status based on current state
    if (videoData.status === 'completed' && videoData.video_url) {
      return c.json({
        videoId: videoData.video_id,
        prompt_text: videoData.prompt_text,
        size: videoData.size,
        status: 'completed',
        created_at: videoData.created_at,
        message: 'Video generation completed successfully',
        video_url: videoData.video_url,
        task_id: videoData.task_id,
        submit_time: videoData.submit_time,
        end_time: videoData.end_time
      });
      
    } else if (videoData.status === 'failed') {
      return c.json({
        videoId: videoData.video_id,
        prompt_text: videoData.prompt_text,
        status: 'failed',
        message: 'Video generation failed',
        error_message: videoData.error_message,
        created_at: videoData.created_at,
        task_id: videoData.task_id
      });
      
    } else if (videoData.status === 'generating') {
      return c.json({
        videoId: videoData.video_id,
        prompt_text: videoData.prompt_text,
        status: 'generating',
        task_status: videoData.task_status,
        message: 'Video is currently being generated',
        created_at: videoData.created_at,
        task_id: videoData.task_id
      });
      
    } else if (videoData.status === 'processing') {
      return c.json({
        videoId: videoData.video_id,
        prompt_text: videoData.prompt_text,
        status: 'processing',
        message: 'Video generation task is being processed',
        created_at: videoData.created_at,
        task_id: videoData.task_id
      });
      
    } else {
      return c.json({
        videoId: videoData.video_id,
        prompt_text: videoData.prompt_text,
        status: 'pending',
        message: 'Video generation is queued for processing',
        created_at: videoData.created_at
      });
    }
    
  } catch (err) {
    console.error('Error in getVideoStatus:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get full video details by UID and video ID
videoRoutes.post('/getVideo', async (c) => {
  try {
    const { uid, videoId } = await c.req.json();

    if (!uid || !videoId) {
      return c.json({ error: 'Both UID and videoId are required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Query the database for video metadata by UID and video ID
    const { data: videoMetadata, error: metadataError } = await supabase
      .from('video_metadata')
      .select('*')
      .eq('uid', uid)
      .eq('video_id', videoId)
      .single();

    if (metadataError) {
      console.error('Error retrieving video metadata:', metadataError);
      return c.json({ error: 'Failed to retrieve video metadata' }, 500);
    }

    if (!videoMetadata) {
      return c.json({ error: 'No video data found for the given UID and video ID' }, 404);
    }

    // Prepare base response
    const response = {
      videoId: videoMetadata.video_id,
      prompt_text: videoMetadata.prompt_text,
      size: videoMetadata.size,
      status: videoMetadata.status,
      task_status: videoMetadata.task_status,
      created_at: videoMetadata.created_at,
      file_path: videoMetadata.file_path,
      task_id: videoMetadata.task_id,
      request_id: videoMetadata.request_id
    };

    // Handle response based on status
    if (videoMetadata.status === 'completed' && videoMetadata.video_url) {
      response.video_url = videoMetadata.video_url;
      response.submit_time = videoMetadata.submit_time;
      response.scheduled_time = videoMetadata.scheduled_time;
      response.end_time = videoMetadata.end_time;
      response.orig_prompt = videoMetadata.orig_prompt;
      response.actual_prompt = videoMetadata.actual_prompt;
      response.message = 'Video generation completed successfully';
      
    } else if (videoMetadata.status === 'failed') {
      response.error_message = videoMetadata.error_message;
      response.message = 'Video generation failed';
      
    } else if (videoMetadata.status === 'generating') {
      response.message = 'Video generation in progress';
      
    } else if (videoMetadata.status === 'processing') {
      response.message = 'Video generation task being processed';
      
    } else {
      response.message = 'Video generation pending';
    }

    return c.json(response);
    
  } catch (err) {
    console.error('Error in getVideo:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all videos for a user by UID
videoRoutes.get('/getAllVideos/:uid', async (c) => {
  try {
    const uid = c.req.param('uid');

    if (!uid) {
      return c.json({ error: 'UID is required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Query the database for video metadata by UID
    const { data: videosData, error: dbError } = await supabase
      .from('video_metadata')
      .select(`
        video_id,
        prompt_text,
        size,
        task_id,
        task_status,
        request_id,
        video_url,
        submit_time,
        scheduled_time,
        end_time,
        orig_prompt,
        actual_prompt,
        created_at,
        status,
        error_message,
        file_path
      `)
      .eq('uid', uid)
      .order('created_at', { ascending: false }); // Most recent first

    if (dbError) {
      console.error('Error retrieving video metadata:', dbError);
      return c.json({ error: 'Failed to retrieve video metadata' }, 500);
    }

    if (!videosData || videosData.length === 0) {
      return c.json({ 
        message: 'No videos found for this user',
        videos: [],
        totalCount: 0
      });
    }

    // Process the videos data to add additional info
    const processedVideos = videosData.map(video => {
      // Calculate video age
      const createdDate = new Date(video.created_at);
      const now = new Date();
      const ageInHours = Math.floor((now - createdDate) / (1000 * 60 * 60));
      const ageInDays = Math.floor(ageInHours / 24);
      
      let ageDisplay;
      if (ageInDays > 0) {
        ageDisplay = `${ageInDays} day${ageInDays > 1 ? 's' : ''} ago`;
      } else if (ageInHours > 0) {
        ageDisplay = `${ageInHours} hour${ageInHours > 1 ? 's' : ''} ago`;
      } else {
        ageDisplay = 'Less than an hour ago';
      }

      // Determine status display
      let statusDisplay = video.status || 'Unknown';
      let isReady = false;
      let hasVideo = false;

      if (video.video_url) {
        hasVideo = true;
        if (video.status === 'completed') {
          isReady = true;
          statusDisplay = 'Ready';
        }
      } else if (video.status === 'generating') {
        statusDisplay = 'Generating';
      } else if (video.status === 'processing') {
        statusDisplay = 'Processing';
      } else if (video.status === 'failed') {
        statusDisplay = 'Failed';
      } else if (video.status === 'pending') {
        statusDisplay = 'Pending';
      }

      return {
        videoId: video.video_id,
        promptText: video.prompt_text,
        size: video.size,
        taskId: video.task_id,
        taskStatus: video.task_status,
        status: video.status,
        statusDisplay: statusDisplay,
        isReady: isReady,
        hasVideo: hasVideo,
        videoUrl: video.video_url,
        createdAt: video.created_at,
        ageDisplay: ageDisplay,
        requestId: video.request_id,
        submitTime: video.submit_time,
        scheduledTime: video.scheduled_time,
        endTime: video.end_time,
        origPrompt: video.orig_prompt,
        actualPrompt: video.actual_prompt,
        errorMessage: video.error_message,
        filePath: video.file_path
      };
    });

    // Group videos by status for summary
    const statusSummary = {
      total: processedVideos.length,
      ready: processedVideos.filter(v => v.isReady).length,
      generating: processedVideos.filter(v => v.status === 'generating').length,
      processing: processedVideos.filter(v => v.status === 'processing').length,
      pending: processedVideos.filter(v => v.status === 'pending').length,
      failed: processedVideos.filter(v => v.status === 'failed').length
    };

    return c.json({
      message: 'Videos retrieved successfully',
      uid: uid,
      summary: statusSummary,
      videos: processedVideos,
      totalCount: processedVideos.length
    });

  } catch (error) {
    console.error('Error retrieving all videos:', error);
    return c.json({ 
      error: 'Internal server error',
      message: error.message
    }, 500);
  }
});

// Remove video file and metadata
videoRoutes.post('/removeVideo', async (c) => {
  try {
    const { uid, videoId } = await c.req.json();

    if (!uid || !videoId) {
      return c.json({ error: 'UID and videoId are required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Delete the video metadata from the database
    const { error: dbError } = await supabase
      .from('video_metadata')
      .delete()
      .eq('uid', uid)
      .eq('video_id', videoId);

    if (dbError) {
      console.error('Error deleting video metadata:', dbError);
      return c.json({ error: 'Failed to delete video metadata' }, 500);
    }

    // Delete the video file from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('user-uploads')
      .remove([`users/${uid}/videos/${videoId}.mp4`]);

    if (storageError) {
      console.error('Error deleting video file:', storageError);
      // Don't return error here as metadata is already deleted
      console.warn('Video file deletion failed but metadata was removed successfully');
    }

    return c.json({ message: 'Video removed successfully' });
  } catch (err) {
    console.error('Error processing request:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Edit video prompt text
videoRoutes.post('/editVideo', async (c) => {
  try {
    const { uid, videoId, updatedPrompt } = await c.req.json();

    if (!uid || !videoId || !updatedPrompt) {
      return c.json({ error: 'UID, videoId, and updated prompt are required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Update the video prompt in the database
    const { data, error } = await supabase
      .from('video_metadata')
      .update({ prompt_text: updatedPrompt })
      .eq('uid', uid)
      .eq('video_id', videoId);

    if (error) {
      console.error('Error updating video prompt:', error);
      return c.json({ error: 'Failed to update video prompt' }, 500);
    }

    return c.json({ message: 'Video prompt updated successfully', updatedVideo: data });
  } catch (err) {
    console.error('Error processing request:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default videoRoutes; 