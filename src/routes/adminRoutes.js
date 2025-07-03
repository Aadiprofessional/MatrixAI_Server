import { Hono } from 'hono';
import { getSupabaseClient } from '../config/database.js';

const adminRoutes = new Hono();

// GET endpoint to fetch all user information
adminRoutes.get('/fetchUserInfoAdmin', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env);

    const { data, error } = await supabase
      .from('users')
      .select('*');

    if (error) {
      console.error('Error fetching users:', error);
      return c.json({ error: 'Failed to fetch user information' }, 500);
    }

    return c.json(data);
  } catch (error) {
    console.error('Error in fetchUserInfoAdmin:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET endpoint to fetch all feedback
adminRoutes.get('/getAllFeedback', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env);

    const { data, error } = await supabase
      .from('feedback')
      .select('*');

    if (error) {
      console.error('Error fetching feedback:', error);
      return c.json({ error: 'Failed to fetch feedback' }, 500);
    }

    return c.json(data);
  } catch (error) {
    console.error('Error in getAllFeedback:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET endpoint to fetch all help requests
adminRoutes.get('/getAllHelp', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env);

    const { data, error } = await supabase
      .from('help_requests')
      .select('*');

    if (error) {
      console.error('Error fetching help requests:', error);
      return c.json({ error: 'Failed to fetch help requests' }, 500);
    }

    return c.json(data);
  } catch (error) {
    console.error('Error in getAllHelp:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET endpoint to fetch all generated images with user info
adminRoutes.get('/getAllGeneratedImage', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env);

    // First, fetch all image data
    const { data: imageData, error: imageError } = await supabase
      .from('image_generate')
      .select('uid, image_id, image_url, created_at, prompt_text');

    if (imageError) {
      console.error('Error fetching generated images:', imageError);
      return c.json({ error: 'Failed to fetch generated images' }, 500);
    }

    // Get unique user IDs
    const userIds = [...new Set(imageData.map(image => image.uid))];
    
    // Fetch user info for all these UIDs
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .in('uid', userIds);

    if (userError) {
      console.error('Error fetching user information:', userError);
      return c.json({ error: 'Failed to fetch user information' }, 500);
    }

    // Create a map of user information for quick lookup
    const userMap = {};
    userData.forEach(user => {
      userMap[user.uid] = user;
    });

    // Group images by user
    const organizedData = userIds.map(uid => {
      const userImages = imageData.filter(image => image.uid === uid);
      return {
        user: userMap[uid],
        images: userImages
      };
    });

    return c.json(organizedData);
  } catch (error) {
    console.error('Error in getAllGeneratedImage:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET endpoint to fetch all audio conversions with user info
adminRoutes.get('/getAllAudioConverted', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env);

    // First, fetch all audio data
    const { data: audioData, error: audioError } = await supabase
      .from('audio_metadata')
      .select('audioid, uid, uploaded_at, duration, transcription, language, audio_name, audio_url');

    if (audioError) {
      console.error('Error fetching audio data:', audioError);
      return c.json({ error: 'Failed to fetch audio data' }, 500);
    }

    // Get unique user IDs
    const userIds = [...new Set(audioData.map(audio => audio.uid))];
    
    // Fetch user info for all these UIDs
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .in('uid', userIds);

    if (userError) {
      console.error('Error fetching user information:', userError);
      return c.json({ error: 'Failed to fetch user information' }, 500);
    }

    // Create a map of user information for quick lookup
    const userMap = {};
    userData.forEach(user => {
      userMap[user.uid] = user;
    });

    // Group audio by user
    const organizedData = userIds.map(uid => {
      const userAudios = audioData.filter(audio => audio.uid === uid);
      return {
        user: userMap[uid],
        audios: userAudios
      };
    });

    return c.json(organizedData);
  } catch (error) {
    console.error('Error in getAllAudioConverted:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET endpoint to fetch all coupons
adminRoutes.get('/getAllCoupons', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env);

    const { data: couponsData, error: couponsError } = await supabase
      .from('coupons')
      .select('*');

    if (couponsError) {
      console.error('Error fetching coupons:', couponsError);
      return c.json({ error: 'Failed to fetch coupons' }, 500);
    }

    return c.json({ success: true, data: couponsData });
  } catch (error) {
    console.error('Error in getAllCoupons:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET endpoint to fetch all transactions organized by users
adminRoutes.get('/getAllTransactions', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env);

    // Step 1: Fetch all users
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('uid, name, email');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    // Step 2: Fetch all transactions
    const { data: allTransactions, error: transactionsError } = await supabase
      .from('user_transaction')
      .select('*');

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      return c.json({ error: 'Failed to fetch transactions' }, 500);
    }

    // Step 3: Organize transactions by user
    const organizedData = usersData.map(user => {
      const userTransactions = allTransactions.filter(transaction => transaction.uid === user.uid);
      return {
        user: {
          uid: user.uid,
          name: user.name,
          email: user.email
        },
        transactions: userTransactions
      };
    });

    return c.json({ success: true, data: organizedData });
  } catch (error) {
    console.error('Error in getAllTransactions:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET endpoint to fetch all orders organized by users
adminRoutes.get('/getAllOrders', async (c) => {
  try {
    const supabase = getSupabaseClient(c.env);

    // Step 1: Fetch all users
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('uid, name, email');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    // Step 2: Fetch all orders
    const { data: allOrders, error: ordersError } = await supabase
      .from('user_order')
      .select('*');

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return c.json({ error: 'Failed to fetch orders' }, 500);
    }

    // Step 3: Organize orders by user
    const organizedData = usersData.map(user => {
      const userOrders = allOrders.filter(order => order.uid === user.uid);
      return {
        user: {
          uid: user.uid,
          name: user.name,
          email: user.email
        },
        orders: userOrders
      };
    });

    return c.json({ success: true, data: organizedData });
  } catch (error) {
    console.error('Error in getAllOrders:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default adminRoutes; 