// Load .env BEFORE any other import so modules that read process.env at
// module-load time (lib/line.ts, lib/jwt.ts) see the real values.
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import path from 'path'
import restaurantRoutes from './routes/restaurants'
import orderRoutes from './routes/orders'
import authRoutes from './routes/auth'
import userRoutes from './routes/users'

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
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/restaurants', restaurantRoutes)
app.use('/api/orders', orderRoutes)

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  })
})

// In production, the backend also serves the built Vue frontend so the whole app
// runs as a single service. In dev, Vite runs separately on :5173 and proxies /api.
if (IS_PROD) {
  // When compiled, __dirname is backend/dist; frontend build is at ../../frontend/dist
  const frontendDist = path.resolve(__dirname, '..', '..', 'frontend', 'dist')
  app.use(express.static(frontendDist))
  // SPA fallback — any non-API GET returns index.html so client-side routing works
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

async function start() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('MongoDB connected')
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT} (${IS_PROD ? 'production' : 'development'})`)
    })
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err)
    process.exit(1)
  }
}

start()
