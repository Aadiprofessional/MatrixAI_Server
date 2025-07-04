// Test script for new audio APIs
// Run this with: node test-new-apis.js

const BASE_URL = 'http://localhost:8787'; // Change to your deployed URL
const TEST_UID = '0a147ebe-af99-481b-bcaf-ae70c9aeb8d8';
const TEST_AUDIO_URL = 'https://ddtgdhehxhgarkonvpfq.supabase.co/storage/v1/object/public/user-uploads/users/0a147ebe-af99-481b-bcaf-ae70c9aeb8d8/audioFile/14bed0e6-17d6-41c5-950d-1238fcdddfcc.wav'; // Free test audio

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
        language: 'en-GB'
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



async function runTests() {
  console.log('🚀 Starting API tests...\n');
  
 
  
  // Test audio upload
  const audioid = await testUploadAudioUrl();
  
  if (audioid) {
    // Poll status until completion
    await pollAudioStatus(audioid);
  }
  
  console.log('\n✨ Tests completed!');
}

// Run the tests
runTests().catch(console.error);