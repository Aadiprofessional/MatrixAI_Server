# MatrixAI Server - Cloudflare Pages

A serverless audio management API built for Cloudflare Pages Functions with Supabase integration.

## Features

- **Serverless Architecture**: Built on Cloudflare Pages Functions
- **Audio Management**: Complete CRUD operations for audio files
- **Supabase Integration**: Database and storage management
- **CORS Support**: Cross-origin resource sharing enabled
- **GitHub Integration**: Automatic deployment via GitHub Actions

## API Endpoints

- `POST /api/getAudioFile` - Get audio file details by UID and audio ID
- `GET /api/getAudio/:uid` - Get all audio files for a user
- `POST /api/removeAudio` - Remove audio file and metadata
- `POST /api/editAudio` - Edit audio file name
- `POST /api/sendXmlGraph` - Save XML data for audio
- `GET /api/health` - Health check endpoint

## Setup Instructions

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

### 5. Database Setup (Supabase)

Ensure your Supabase database has the `audio_metadata` table with the following structure:

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

## Usage

### Example API Calls

**Get audio file details:**
```bash
curl -X POST https://your-domain.pages.dev/api/getAudioFile \
  -H "Content-Type: application/json" \
  -d '{"uid":"user123","audioid":"audio456"}'
```

**Get all audio for a user:**
```bash
curl https://your-domain.pages.dev/api/getAudio/user123
```

**Health check:**
```bash
curl https://your-domain.pages.dev/api/health
```

## Project Structure

```
.
├── functions/
│   └── api/
│       └── [[route]].js       # Main API handler
├── .github/
│   └── workflows/
│       └── deploy.yml         # GitHub Actions workflow
├── package.json               # Dependencies and scripts
├── wrangler.toml             # Cloudflare configuration
├── env.example               # Environment variables template
└── README.md                 # This file
```

## Deployment

The project automatically deploys to Cloudflare Pages when you:

1. Push to the `main` branch (production deployment)
2. Push to the `develop` branch (preview deployment)
3. Create a pull request to `main` (preview deployment)

## Monitoring

- **Logs**: Check Cloudflare Pages dashboard for function logs
- **Analytics**: Available in Cloudflare Analytics
- **Health**: Use the `/api/health` endpoint for monitoring

## Troubleshooting

1. **Environment variables not working**: Ensure they're set in both Cloudflare Pages dashboard and wrangler.toml
2. **CORS issues**: Update the CORS origins in the function to match your frontend domain
3. **Build failures**: Check GitHub Actions logs and ensure all dependencies are correctly specified

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run dev`
5. Create a pull request

## License

MIT License 