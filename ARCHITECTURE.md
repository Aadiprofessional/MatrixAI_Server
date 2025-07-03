# MatrixAI Server Architecture

## Project Structure

```
MatrixAI_Server/
├── functions/
│   └── api/
│       └── [[route]].js          # Entry point for Cloudflare Pages Functions
├── src/
│   ├── app.js                    # Main application setup
│   ├── config/
│   │   └── database.js           # Database configuration
│   ├── middleware/
│   │   └── errorHandler.js       # Error handling middleware
│   ├── routes/
│   │   ├── audioRoutes.js        # Audio-related endpoints
│   │   └── userRoutes.js         # User-related endpoints (template)
│   └── utils/
│       └── validation.js         # Input validation utilities
├── .github/
│   └── workflows/
│       └── deploy.yml            # GitHub Actions deployment
├── package.json                  # Dependencies and scripts
├── wrangler.toml                 # Cloudflare configuration
├── _routes.json                  # Route configuration
└── README.md                     # Project documentation
```

## Architecture Overview

### 1. Entry Point (`functions/api/[[route]].js`)
- Minimal entry point for Cloudflare Pages Functions
- Imports and exports the main application
- Handles all API routes through the catch-all `[[route]]` pattern

### 2. Main Application (`src/app.js`)
- Sets up the Hono application instance
- Configures CORS middleware
- Registers route modules
- Provides health check and API info endpoints
- Handles 404 responses

### 3. Route Modules (`src/routes/`)
- **Modular Design**: Each feature area has its own route file
- **audioRoutes.js**: Handles all audio-related operations
- **userRoutes.js**: Template for user-related operations
- Easy to add new route modules for different features

### 4. Configuration (`src/config/`)
- **database.js**: Centralized database client configuration
- Environment variable validation
- Reusable Supabase client factory

### 5. Middleware (`src/middleware/`)
- **errorHandler.js**: Centralized error handling
- Async wrapper for route handlers
- Consistent error response format

### 6. Utilities (`src/utils/`)
- **validation.js**: Input validation functions
- Reusable validation logic
- Sanitization utilities

## Adding New Features

### 1. Adding New Route Modules

Create a new route file in `src/routes/`:

```javascript
// src/routes/newFeatureRoutes.js
import { Hono } from 'hono';
import { getSupabaseClient } from '../config/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const newFeatureRoutes = new Hono();

newFeatureRoutes.get('/endpoint', asyncHandler(async (c) => {
  // Your logic here
  return c.json({ message: 'New feature endpoint' });
}));

export default newFeatureRoutes;
```

Then register it in `src/app.js`:

```javascript
import newFeatureRoutes from './routes/newFeatureRoutes.js';

// Register the new route module
app.route('/api/new-feature', newFeatureRoutes);
```

### 2. Adding Middleware

Create middleware in `src/middleware/`:

```javascript
// src/middleware/authMiddleware.js
export const authMiddleware = async (c, next) => {
  // Authentication logic
  await next();
};
```

Apply it in routes or globally:

```javascript
// In route file
import { authMiddleware } from '../middleware/authMiddleware.js';
routes.use('*', authMiddleware);

// Or globally in app.js
app.use('*', authMiddleware);
```

### 3. Adding Utilities

Create utility functions in `src/utils/`:

```javascript
// src/utils/helpers.js
export const formatResponse = (data) => {
  return {
    success: true,
    data: data,
    timestamp: new Date().toISOString()
  };
};
```

## API Endpoints

### Current Endpoints

#### Audio Routes (`/api/audio/`)
- `POST /api/audio/getAudioFile` - Get audio file details
- `GET /api/audio/getAudio/:uid` - Get all audio files for user
- `POST /api/audio/removeAudio` - Remove audio file
- `POST /api/audio/editAudio` - Edit audio file name
- `POST /api/audio/sendXmlGraph` - Save XML data

#### User Routes (`/api/user/`) - Template
- `GET /api/user/profile/:uid` - Get user profile
- `POST /api/user/profile/update` - Update user profile

#### System Routes
- `GET /health` - Health check
- `GET /api` - API information

## Error Handling

The application uses centralized error handling:

1. **Validation Errors**: Return 400 with validation message
2. **Database Errors**: Return 500 with generic database error
3. **Unexpected Errors**: Return 500 with generic error message

## Environment Variables

Required environment variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Deployment

The application automatically deploys to Cloudflare Pages when:
1. Code is pushed to `main` branch (production)
2. Code is pushed to `develop` branch (preview)
3. Pull requests are created to `main` (preview)

## Benefits of This Architecture

1. **Modularity**: Easy to add new features without affecting existing code
2. **Maintainability**: Clear separation of concerns
3. **Scalability**: Can handle growing number of endpoints
4. **Testability**: Each module can be tested independently
5. **Consistency**: Standardized error handling and validation
6. **Developer Experience**: Clear structure for team development

## Best Practices

1. Keep route files focused on a single feature area
2. Use the `asyncHandler` wrapper for all async route handlers
3. Validate inputs using the validation utilities
4. Use consistent error handling patterns
5. Document new endpoints in this file
6. Follow the established file naming conventions 