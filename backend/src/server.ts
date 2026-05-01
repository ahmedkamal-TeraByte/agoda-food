// Load .env BEFORE any other import so MONGODB_URI / PORT / NODE_ENV are available.
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import path from 'path'
import { config } from '@config/AppConfig'
import restaurantRoutes from '@routes/restaurants'
import orderRoutes from '@routes/orders'
import authRoutes from '@routes/auth'
import userRoutes from '@routes/users'
import emailRoutes from '@routes/email'
import merchantRoutes from '@routes/merchant'
import stripeWebhookRoutes from '@routes/stripeWebhook'
import agodaFoodLineWebhookRoutes from '@routes/agodaFoodLineWebhook'
import { LOCAL_UPLOAD_DIR, LOCAL_PUBLIC_PATH, getIsLocalStorage } from '@lib/storage'

const app = express()
const PORT = process.env.PORT ?? 3000
const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/agoda-food'
const IS_PROD = process.env.NODE_ENV === 'production'

// CORS only matters in dev — in prod the frontend is served from the same origin.
if (!IS_PROD) {
  app.use(
    cors({
      origin: 'http://localhost:5173',
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )
}

// Routes that need the raw body for HMAC signature verification MUST be
// mounted before express.json(), which consumes the stream and makes the
// raw bytes unavailable.
app.use('/api/stripe', stripeWebhookRoutes)
app.use('/api/line', agodaFoodLineWebhookRoutes)

app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/auth/email', emailRoutes)
app.use('/api/users', userRoutes)
app.use('/api/restaurants', restaurantRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/merchant', merchantRoutes)

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  })
})

// In production, the backend also serves the built Vue frontend so the whole app
// runs as a single service. In dev, Vite runs separately on :5173 and proxies /api.
if (IS_PROD) {
  const frontendDist = path.resolve(__dirname, '..', '..', 'frontend', 'dist')
  app.use(express.static(frontendDist))
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

async function start() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('MongoDB connected')

    await config.load()

    // Local-fs static handler depends on storage config, so it mounts after load.
    if (getIsLocalStorage()) {
      app.use(LOCAL_PUBLIC_PATH, express.static(LOCAL_UPLOAD_DIR))
    }

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT} (${IS_PROD ? 'production' : 'development'})`)
    })
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

start()
