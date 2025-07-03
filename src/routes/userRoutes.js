import { Hono } from 'hono';
import { getSupabaseClient } from '../config/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateRequiredFields, validateUID } from '../utils/validation.js';

const userRoutes = new Hono();

// Example: Get user profile
userRoutes.get('/profile/:uid', asyncHandler(async (c) => {
  const uid = c.req.param('uid');
  validateUID(uid);
  
  const supabase = getSupabaseClient(c.env);
  
  // Add your user profile logic here
  return c.json({ 
    message: 'User routes ready for implementation',
    uid: uid 
  });
}));

// Example: Update user profile
userRoutes.post('/profile/update', asyncHandler(async (c) => {
  const data = await c.req.json();
  validateRequiredFields(data, ['uid']);
  
  const supabase = getSupabaseClient(c.env);
  
  // Add your user update logic here
  return c.json({ 
    message: 'User profile update endpoint ready',
    data: data 
  });
}));

// Get coupons for a user
userRoutes.post('/getCoupon', async (c) => {
  try {
    const { uid } = await c.req.json();

    if (!uid) {
      return c.json({ error: 'UID is required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Step 1: Fetch the user's details from the `users` table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('newuser')
      .eq('uid', uid)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return c.json({ error: 'Failed to fetch user information' }, 500);
    }

    const isNewUser = userData?.newuser || false;

    // Step 2: Fetch coupons based on the user's eligibility
    let query = supabase
      .from('coupons')
      .select('*')
      .or(`uid.cs.{${uid}},uid.is.null`)
      .eq('active', true);

    // Add condition for new user coupons
    if (isNewUser) {
      query = query.or('only_new_users.eq.true,only_new_users.eq.false');
    } else {
      query = query.eq('only_new_users', false);
    }

    const { data: couponsData, error: couponsError } = await query;

    if (couponsError) {
      console.error('Error fetching coupons:', couponsError);
      return c.json({ error: 'Failed to fetch coupons' }, 500);
    }

    return c.json({ success: true, data: couponsData });
  } catch (error) {
    console.error('Error in getCoupon:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Add a new coupon
userRoutes.post('/AddCoupon', async (c) => {
  try {
    const { couponName, couponAmount, durationInMinutes, uids, forEveryone, onlyNewUsers } = await c.req.json();

    if (!couponName || !couponAmount || !durationInMinutes) {
      return c.json({ error: 'Missing required fields: couponName, couponAmount, durationInMinutes' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Calculate the `valid_till` timestamp based on the current time and duration in minutes
    const validTill = new Date(Date.now() + durationInMinutes * 60000).toISOString();

    const couponData = {
      coupon_name: couponName,
      coupon_amount: couponAmount,
      valid_till: validTill,
      only_new_users: onlyNewUsers || false,
      active: true,
    };

    if (forEveryone) {
      couponData.uid = null;
    } else if (uids && uids.length > 0) {
      couponData.uid = uids;
    }

    const { error } = await supabase.from('coupons').insert([couponData]);
    if (error) {
      console.error('Error adding coupon:', error);
      return c.json({ error: 'Failed to add coupon' }, 500);
    }

    return c.json({ success: true, message: 'Coupon added successfully' });
  } catch (error) {
    console.error('Error in AddCoupon:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Activate/deactivate a coupon
userRoutes.post('/activateCoupon', async (c) => {
  try {
    const { couponId, durationInMinutes, active } = await c.req.json();

    if (!couponId || durationInMinutes === undefined || active === undefined) {
      return c.json({ error: 'Missing required fields: couponId, durationInMinutes, active' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Calculate the `valid_till` timestamp based on the current time and duration in minutes
    const validTill = new Date(Date.now() + durationInMinutes * 60000).toISOString();

    const { error } = await supabase
      .from('coupons')
      .update({ active, valid_till: validTill })
      .eq('id', couponId);

    if (error) {
      console.error('Error updating coupon:', error);
      return c.json({ error: 'Failed to update coupon status' }, 500);
    }

    return c.json({ success: true, message: 'Coupon status updated successfully' });
  } catch (error) {
    console.error('Error in activateCoupon:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Add user to a coupon
userRoutes.post('/addUserCoupon', async (c) => {
  try {
    const { uid, couponId } = await c.req.json();

    if (!uid || !couponId) {
      return c.json({ error: 'UID and couponId are required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Step 1: Fetch the existing coupon
    const { data: couponData, error: couponError } = await supabase
      .from('coupons')
      .select('uid')
      .eq('id', couponId)
      .single();

    if (couponError) {
      console.error('Error fetching coupon:', couponError);
      return c.json({ error: 'Failed to fetch coupon' }, 500);
    }

    // Step 2: Check if the user is already in the coupon's uid list
    const existingUids = couponData?.uid || [];
    if (existingUids.includes(uid)) {
      return c.json({ success: false, message: 'User already exists in the coupon' }, 400);
    }

    // Step 3: Add the user to the coupon's uid list
    const updatedUids = [...existingUids, uid];

    // Step 4: Update the coupon with the new uid list
    const { error: updateError } = await supabase
      .from('coupons')
      .update({ uid: updatedUids })
      .eq('id', couponId);

    if (updateError) {
      console.error('Error updating coupon:', updateError);
      return c.json({ error: 'Failed to add user to coupon' }, 500);
    }

    return c.json({ success: true, message: 'User added to the coupon successfully' });
  } catch (error) {
    console.error('Error in addUserCoupon:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Buy subscription
userRoutes.post('/BuySubscription', async (c) => {
  try {
    const { uid, plan, totalPrice, couponId } = await c.req.json();

    if (!uid || !plan || !totalPrice) {
      return c.json({ error: 'Missing required fields: uid, plan, totalPrice' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Step 1: Fetch plan details
    const { data: planData, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('plan_name', plan)
      .single();

    if (planError || !planData) {
      console.error('Error fetching plan:', planError);
      return c.json({ error: 'Plan not found' }, 404);
    }

    const { coins, plan_period } = planData;

    // Step 2: Fetch user details
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_active, user_plan, plan_valid_till, user_coins')
      .eq('uid', uid)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return c.json({ error: 'Failed to fetch user information' }, 500);
    }

    const { subscription_active, plan_valid_till, user_coins } = userData;

    // Step 3: Calculate plan validity and coin expiry
    let planValidTill, coinsExpiry;
    const now = new Date();

    if (plan === 'Addon') {
      if (!subscription_active || !plan_valid_till) {
        return c.json({ error: 'Addon plan can only be purchased with an active subscription' }, 400);
      }

      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      planValidTill = currentMonthEnd.toISOString();
      coinsExpiry = planValidTill;
    } else if (plan === 'Yearly') {
      planValidTill = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
      coinsExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      planValidTill = new Date(now.getTime() + plan_period * 1000).toISOString();
      coinsExpiry = planValidTill;
    }

    // Step 4: Update user based on plan type
    if (plan === 'Addon') {
      const updatedCoins = (user_coins || 0) + coins;

      const { error: updateError } = await supabase
        .from('users')
        .update({ user_coins: updatedCoins, coins_expiry: coinsExpiry })
        .eq('uid', uid);

      if (updateError) {
        console.error('Error updating user coins:', updateError);
        return c.json({ error: 'Failed to update user coins' }, 500);
      }
    } else {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          subscription_active: true,
          user_plan: plan,
          user_coins: coins,
          plan_valid_till: planValidTill,
          coins_expiry: coinsExpiry,
          last_coin_addition: now.toISOString()
        })
        .eq('uid', uid);

      if (updateError) {
        console.error('Error updating user subscription:', updateError);
        return c.json({ error: 'Failed to update user subscription' }, 500);
      }
    }

    // Step 5: Insert order into user_order table
    const { error: orderError } = await supabase
      .from('user_order')
      .insert([{
        uid,
        plan_name: plan,
        total_price: totalPrice,
        coins_added: coins,
        plan_valid_till: planValidTill,
        coupon_id: couponId || null,
        status: 'active'
      }]);

    if (orderError) {
      console.error('Error creating order:', orderError);
      return c.json({ error: 'Failed to create order' }, 500);
    }

    return c.json({ success: true, message: 'Subscription purchased successfully' });
  } catch (error) {
    console.error('Error in BuySubscription:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get user orders
userRoutes.post('/getUserOrder', async (c) => {
  try {
    const { uid } = await c.req.json();

    if (!uid) {
      return c.json({ error: 'UID is required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    const { data: orders, error: ordersError } = await supabase
      .from('user_order')
      .select('*')
      .eq('uid', uid);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return c.json({ error: 'Failed to fetch orders' }, 500);
    }

    return c.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error in getUserOrder:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Subtract coins from user
userRoutes.post('/subtractCoins', async (c) => {
  try {
    const { uid, coinAmount, transaction_name } = await c.req.json();

    if (!uid || !coinAmount || !transaction_name) {
      return c.json({ error: 'Missing required fields: uid, coinAmount, transaction_name' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    // Step 1: Fetch user details
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_coins')
      .eq('uid', uid)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return c.json({ error: 'Failed to fetch user information' }, 500);
    }

    const { user_coins } = userData;

    // Step 2: Check if the user has enough coins
    if (user_coins < coinAmount) {
      // Log failed transaction
      const { error: transactionError } = await supabase
        .from('user_transaction')
        .insert([{
          uid,
          transaction_name,
          coin_amount: coinAmount,
          remaining_coins: user_coins,
          status: 'failed',
          time: new Date().toISOString()
        }]);

      if (transactionError) {
        console.error('Error logging failed transaction:', transactionError);
      }

      return c.json({ success: false, message: 'Insufficient coins. Please buy more coins.' }, 400);
    }

    // Step 3: Subtract coins from the user's balance
    const updatedCoins = user_coins - coinAmount;
    const { error: updateError } = await supabase
      .from('users')
      .update({ user_coins: updatedCoins })
      .eq('uid', uid);

    if (updateError) {
      console.error('Error updating user coins:', updateError);
      return c.json({ error: 'Failed to update user coins' }, 500);
    }

    // Step 4: Log successful transaction
    const { error: transactionError } = await supabase
      .from('user_transaction')
      .insert([{
        uid,
        transaction_name,
        coin_amount: coinAmount,
        remaining_coins: updatedCoins,
        status: 'success',
        time: new Date().toISOString()
      }]);

    if (transactionError) {
      console.error('Error logging transaction:', transactionError);
    }

    return c.json({ success: true, message: 'Coins subtracted successfully' });
  } catch (error) {
    console.error('Error in subtractCoins:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all transactions for a user
userRoutes.post('/AllTransactions', async (c) => {
  try {
    const { uid } = await c.req.json();

    if (!uid) {
      return c.json({ error: 'UID is required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    const { data: transactions, error: transactionsError } = await supabase
      .from('user_transaction')
      .select('*')
      .eq('uid', uid);

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      return c.json({ error: 'Failed to fetch transactions' }, 500);
    }

    return c.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error in AllTransactions:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get user info
userRoutes.post('/userinfo', async (c) => {
  try {
    const { uid } = await c.req.json();

    if (!uid) {
      return c.json({ error: 'UID is required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    const { data: userData, error } = await supabase
      .from('users')
      .select('name, age, gender, email, dp_url, subscription_active')
      .eq('uid', uid)
      .single();

    if (error) {
      console.error('Error fetching user info:', error);
      return c.json({ error: 'Failed to fetch user information' }, 500);
    }

    return c.json({ success: true, data: userData });
  } catch (error) {
    console.error('Error in userinfo:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Edit user info
userRoutes.post('/edituser', async (c) => {
  try {
    const { uid, name, age, gender, dp_url } = await c.req.json();

    if (!uid) {
      return c.json({ error: 'UID is required' }, 400);
    }

    const supabase = getSupabaseClient(c.env);

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (age !== undefined) updateData.age = age;
    if (gender !== undefined) updateData.gender = gender;
    if (dp_url !== undefined) updateData.dp_url = dp_url;

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('uid', uid);

    if (error) {
      console.error('Error updating user:', error);
      return c.json({ error: 'Failed to update user information' }, 500);
    }

    return c.json({ success: true, message: 'User updated successfully' });
  } catch (error) {
    console.error('Error in edituser:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default userRoutes; 