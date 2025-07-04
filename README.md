# MatrixAI Server - Cloudflare Pages

A **modular serverless** audio management API built for Cloudflare Pages Functions with Supabase integration.

## 🚀 Features

- **Modular Architecture**: Clean separation of concerns with dedicated route modules
- **Serverless**: Built on Cloudflare Pages Functions for automatic scaling
- **Audio Management**: Complete CRUD operations for audio files
- **Supabase Integration**: Database and storage management
- **CORS Support**: Cross-origin resource sharing enabled
- **Error Handling**: Centralized error handling with consistent responses
- **Input Validation**: Comprehensive validation utilities
- **GitHub Integration**: Automatic deployment via GitHub Actions

## 📁 Project Structure

```
MatrixAI_Server/
├── functions/api/[[route]].js    # Cloudflare Pages entry point
├── src/
│   ├── app.js                    # Main application setup
│   ├── config/database.js        # Database configuration
│   ├── middleware/errorHandler.js # Error handling
│   ├── routes/
│   │   ├── audioRoutes.js        # Audio endpoints
│   │   └── userRoutes.js         # User endpoints (template)
│   └── utils/validation.js       # Input validation
├── .github/workflows/deploy.yml  # CI/CD pipeline
└── ARCHITECTURE.md               # Detailed architecture docs
```

## 🔗 API Endpoints

### Audio Management (`/api/audio/`)
- `POST /api/audio/uploadAudioUrl` - Upload audio URL and get unique audioid
- `POST /api/audio/getAudioStatus` - Get audio processing status and transcription
- `POST /api/audio/getAudioFile` - Get audio file details by UID and audio ID
- `GET /api/audio/getAudio/:uid` - Get all audio files for a user
- `POST /api/audio/removeAudio` - Remove audio file and metadata
- `POST /api/audio/editAudio` - Edit audio file name
- `POST /api/audio/sendXmlGraph` - Save XML data for audio

### User Management (`/api/user/`) - Template Ready
- `GET /api/user/profile/:uid` - Get user profile
- `POST /api/user/profile/update` - Update user profile

### System Endpoints
- `GET /health` - Health check with service info
- `GET /api` - API information and available endpoints

## 🛠️ Setup Instructions

### 1. Prerequisites

- GitHub account
- Cloudflare account
- Supabase project
- Node.js 18+ installed locally

### 2. Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd MatrixAI_Server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables for local development:**
   ```bash
   cp .dev.vars.example .dev.vars
   ```
   
   Edit `.dev.vars` with your Supabase credentials:
   ```
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   ENVIRONMENT=development
   ```

4. **Start local development:**
   ```bash
   npx wrangler pages dev --port 8787
   ```
   
   Your API will be available at `http://localhost:8787`

### 3. Cloudflare Setup

1. **Log in to Cloudflare Dashboard**
2. **Create a new Pages project**:
   - Go to Pages in your Cloudflare dashboard
   - Click "Create a project"
   - Connect to GitHub and select your repository
   - Set build settings:
     - Framework preset: None
     - Build command: `npm run build`
     - Build output directory: `.`

3. **Configure environment variables in Cloudflare**:
   - Go to your Pages project settings
   - Navigate to "Environment variables"
   - Add the following variables for both Production and Preview:
     ```
     SUPABASE_URL=your_supabase_project_url
     SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

### 4. GitHub Integration Setup

1. **Get Cloudflare API credentials**:
   - Go to Cloudflare dashboard → My Profile → API Tokens
   - Create token with "Cloudflare Pages:Edit" permissions
   - Get your Account ID from the right sidebar

2. **Configure GitHub Secrets**:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add the following secrets:
     ```
     CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
     CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
     ```

3. **Deploy**:
   - Push to main branch or create a pull request
   - GitHub Actions will automatically deploy to Cloudflare Pages

## 🧪 Testing Your API

### Health Check
```bash
curl https://your-domain.pages.dev/health
```

### API Information
```bash
curl https://your-domain.pages.dev/api
```

### Upload Audio URL (New)
```bash
curl -X POST https://your-domain.pages.dev/api/audio/uploadAudioUrl \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "user123",
    "audioUrl": "https://example.com/audio.mp3",
    "audioName": "My Audio File",
    "language": "en-GB",
    "duration": 120
  }'
```

### Check Audio Status (New)
```bash
curl -X POST https://your-domain.pages.dev/api/audio/getAudioStatus \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "user123",
    "audioid": "audio_1234567890_abc123def"
  }'
```

### Get Audio Files
```bash
curl https://your-domain.pages.dev/api/audio/getAudio/user123
```

### Get Specific Audio File
```bash
curl -X POST https://your-domain.pages.dev/api/audio/getAudioFile \
  -H "Content-Type: application/json" \
  -d '{"uid":"user123","audioid":"audio456"}'
```

## 🔧 Adding New Features

### 1. Create New Route Module

```javascript
// src/routes/newFeatureRoutes.js
import { Hono } from 'hono';
import { getSupabaseClient } from '../config/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const newFeatureRoutes = new Hono();

newFeatureRoutes.get('/endpoint', asyncHandler(async (c) => {
  const supabase = getSupabaseClient(c.env);
  // Your logic here
  return c.json({ message: 'New feature' });
}));

export default newFeatureRoutes;
```

### 2. Register in Main App

```javascript
// src/app.js
import newFeatureRoutes from './routes/newFeatureRoutes.js';

app.route('/api/new-feature', newFeatureRoutes);
```

## 📊 Database Setup (Supabase)

Create the `audio_metadata` table:

```sql
CREATE TABLE audio_metadata (
  uid TEXT NOT NULL,
  audioid TEXT NOT NULL,
  audio_name TEXT,
  duration INTEGER,
  uploaded_at TIMESTAMP DEFAULT NOW(),
  transcription TEXT,
  xml_data TEXT,
  file_path TEXT,
  audio_url TEXT,
  language TEXT,
  words_data JSONB,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  PRIMARY KEY (uid, audioid)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audio_metadata_status ON audio_metadata(status);
CREATE INDEX IF NOT EXISTS idx_audio_metadata_uid_status ON audio_metadata(uid, status);
```

## 🚀 New Audio Processing Workflow

The new audio processing system works as follows:

1. **Upload Audio URL**: Client sends audio URL to `/api/audio/uploadAudioUrl`
   - Returns unique `audioid` immediately
   - Audio processing starts in background
   - Status is set to 'pending'

2. **Background Processing**:
   - Validates user has sufficient coins
   - Deducts coins based on audio duration (2 coins per minute)
   - Transcribes audio using Deepgram API
   - Updates status to 'processing' → 'completed' or 'failed'

3. **Check Status**: Client polls `/api/audio/getAudioStatus` with `audioid`
   - Returns current status and transcription when ready
   - Possible statuses: `pending`, `processing`, `completed`, `failed`

### Status Response Examples:

**Pending:**
```json
{
  "audioid": "audio_1234567890_abc123def",
  "status": "pending",
  "message": "Audio is queued for processing"
}
```

**Completed:**
```json
{
  "audioid": "audio_1234567890_abc123def",
  "status": "completed",
  "message": "Audio transcription completed",
  "transcription": "Hello world, this is a test audio...",
  "words_data": [...],
  "duration": 120
}
```

**Failed:**
```json
{
  "audioid": "audio_1234567890_abc123def",
  "status": "failed",
  "message": "Audio transcription failed",
  "error_message": "Insufficient coins. Please buy more coins."
}
```

## 🚀 Deployment

The project automatically deploys to Cloudflare Pages when you:

1. Push to the `main` branch (production deployment)
2. Push to the `develop` branch (preview deployment)
3. Create a pull request to `main` (preview deployment)

## 📈 Monitoring

- **Logs**: Check Cloudflare Pages dashboard for function logs
- **Analytics**: Available in Cloudflare Analytics
- **Health**: Use the `/health` endpoint for monitoring

## 🔍 Troubleshooting

1. **Environment variables not working in local development**: 
   - Ensure you have created `.dev.vars` file from `.dev.vars.example`
   - Verify your Supabase credentials are correct
   - Restart the development server after changing `.dev.vars`

2. **Missing Supabase configuration error**: 
   - Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in `.dev.vars` (local) or Cloudflare dashboard (production)
   - Ensure environment variables don't have extra spaces or quotes

3. **CORS issues**: Update the CORS origins in `src/app.js`

4. **Build failures**: Check GitHub Actions logs

5. **Route not found**: Verify the route is registered in `src/app.js`

6. **Audio processing fails**: 
   - Check if user has sufficient coins in the database
   - Verify Deepgram API key is working
   - Ensure audio URL is accessible publicly

## 📖 Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed architecture documentation
- [API Documentation](https://your-domain.pages.dev/api) - Live API info endpoint

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add your route module in `src/routes/`
4. Register it in `src/app.js`
5. Test locally with `npm run dev`
6. Create a pull request

## 📄 License

MIT License

---

## 🎯 Benefits of This Architecture

✅ **Modular**: Easy to add new features without affecting existing code  
✅ **Scalable**: Handle growing number of endpoints efficiently  
✅ **Maintainable**: Clear separation of concerns  
✅ **Testable**: Each module can be tested independently  
✅ **Consistent**: Standardized error handling and validation  
✅ **Developer-Friendly**: Clear structure for team development 