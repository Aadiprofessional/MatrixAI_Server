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

3. **Configure environment variables:**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your Supabase credentials:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ENVIRONMENT=development
   ```

4. **Start local development:**
   ```bash
   npm run dev
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
  PRIMARY KEY (uid, audioid)
);
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

1. **Environment variables not working**: Ensure they're set in Cloudflare Pages dashboard
2. **CORS issues**: Update the CORS origins in `src/app.js`
3. **Build failures**: Check GitHub Actions logs
4. **Route not found**: Verify the route is registered in `src/app.js`

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