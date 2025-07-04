// Test script for new audio and video APIs
// Run this with: node test-new-apis.js

const BASE_URL = 'http://localhost:8787'; // Change to your deployed URL
const TEST_UID = '0a147ebe-af99-481b-bcaf-ae70c9aeb8d8';
const TEST_AUDIO_URL = 'https://ddtgdhehxhgarkonvpfq.supabase.co/storage/v1/object/public/user-uploads/users/0a147ebe-af99-481b-bcaf-ae70c9aeb8d8/audioFile/14bed0e6-17d6-41c5-950d-1238fcdddfcc.wav'; // Free test audio

// ===== AUDIO TESTS =====

async function testUploadAudioUrl() {
  console.log('🧪 Testing uploadAudioUrl API...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/audio/uploadAudioUrl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: TEST_UID,
        audioUrl: TEST_AUDIO_URL,
        audioName: 'Test Audio File',
        language: 'en-GB',
        duration: 30 // 30 seconds test duration
      })
    });

    const data = await response.json();
    console.log('✅ Upload Response:', data);
    
    if (data.success && data.audioid) {
      console.log(`🎯 Generated audioid: ${data.audioid}`);
      return data.audioid;
    } else {
      console.error('❌ Upload failed:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ Upload error:', error);
    return null;
  }
}

async function testGetAudioStatus(audioid) {
  console.log('\n🧪 Testing getAudioStatus API...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/audio/getAudioStatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: TEST_UID,
        audioid: audioid
      })
    });

    const data = await response.json();
    console.log('✅ Status Response:', data);
    
    return data.status;
  } catch (error) {
    console.error('❌ Status check error:', error);
    return null;
  }
}

async function pollAudioStatus(audioid, maxAttempts = 10) {
  console.log('\n🔄 Polling audio status...');
  
  for (let i = 0; i < maxAttempts; i++) {
    const status = await testGetAudioStatus(audioid);
    
    if (status === 'completed') {
      console.log('🎉 Audio processing completed!');
      break;
    } else if (status === 'failed') {
      console.log('💥 Audio processing failed!');
      break;
    } else {
      console.log(`⏳ Status: ${status}, waiting 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}

// ===== VIDEO TESTS =====

async function testCreateVideo() {
  console.log('\n🎬 Testing createVideo API...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/video/createVideo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: TEST_UID,
        promptText: 'A beautiful sunset over the ocean with gentle waves',
        size: '1280*720'
      })
    });

    const data = await response.json();
    console.log('✅ Create Video Response:', data);
    
    if (data.success && data.videoId) {
      console.log(`🎯 Generated videoId: ${data.videoId}`);
      return data.videoId;
    } else {
      console.error('❌ Video creation failed:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ Video creation error:', error);
    return null;
  }
}

async function testGetVideoStatus(videoId) {
  console.log('\n🧪 Testing getVideoStatus API...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/video/getVideoStatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: TEST_UID,
        videoId: videoId
      })
    });

    const data = await response.json();
    console.log('✅ Video Status Response:', data);
    
    return data.status;
  } catch (error) {
    console.error('❌ Video status check error:', error);
    return null;
  }
}

async function testGetVideo(videoId) {
  console.log('\n🧪 Testing getVideo API...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/video/getVideo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: TEST_UID,
        videoId: videoId
      })
    });

    const data = await response.json();
    console.log('✅ Get Video Response:', data);
    
    return data;
  } catch (error) {
    console.error('❌ Get video error:', error);
    return null;
  }
}

async function testGetAllVideos() {
  console.log('\n🧪 Testing getAllVideos API...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/video/getAllVideos/${TEST_UID}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();
    console.log('✅ Get All Videos Response:', data);
    
    return data;
  } catch (error) {
    console.error('❌ Get all videos error:', error);
    return null;
  }
}

async function pollVideoStatus(videoId, maxAttempts = 30) {
  console.log('\n🔄 Polling video status...');
  
  for (let i = 0; i < maxAttempts; i++) {
    const status = await testGetVideoStatus(videoId);
    
    if (status === 'completed') {
      console.log('🎉 Video generation completed!');
      // Get full video details
      await testGetVideo(videoId);
      break;
    } else if (status === 'failed') {
      console.log('💥 Video generation failed!');
      break;
    } else {
      console.log(`⏳ Status: ${status}, waiting 10 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

async function testEditVideo(videoId) {
  console.log('\n🧪 Testing editVideo API...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/video/editVideo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uid: TEST_UID,
        videoId: videoId,
        updatedPrompt: 'A beautiful sunset over the ocean with gentle waves - UPDATED'
      })
    });

    const data = await response.json();
    console.log('✅ Edit Video Response:', data);
    
    return data;
  } catch (error) {
    console.error('❌ Edit video error:', error);
    return null;
  }
}

// ===== MAIN TEST RUNNER =====

async function runTests() {
  console.log('🚀 Starting API tests...\n');
  
  const testType = process.argv[2] || 'both'; // 'audio', 'video', or 'both'
  
  if (testType === 'audio' || testType === 'both') {
    console.log('='.repeat(50));
    console.log('🎵 TESTING AUDIO APIS');
    console.log('='.repeat(50));
    
    // Test audio upload
    const audioid = await testUploadAudioUrl();
    
    if (audioid) {
      // Poll status until completion
      await pollAudioStatus(audioid);
    }
  }
  
  if (testType === 'video' || testType === 'both') {
    console.log('\n' + '='.repeat(50));
    console.log('🎬 TESTING VIDEO APIS');
    console.log('='.repeat(50));
    
    // Test video creation
    const videoId = await testCreateVideo();
    
    if (videoId) {
      // Poll status until completion
      await pollVideoStatus(videoId);
      
      // Test edit video
      await testEditVideo(videoId);
      
      // Test get all videos
      await testGetAllVideos();
    }
  }
  
  console.log('\n✨ Tests completed!');
  console.log('\n💡 Usage: node test-new-apis.js [audio|video|both]');
}

// Run the tests
runTests().catch(console.error);