/**
 * ════════════════════════════════════════════════════════════════
 *  dTELECOM TOKEN BACKEND  —  /api/dtelecom-token
 *  ShelbyChat · Secure server-side JWT generation
 * ════════════════════════════════════════════════════════════════
 *
 *  SETUP:
 *  ──────
 *  1. npm install @dtelecom/server-sdk-js
 *  2. Create a .env file (NEVER commit this):
 *
 *       DTELECOM_API_KEY=your_api_key_here
 *       DTELECOM_API_SECRET=your_api_secret_here
 *       DTELECOM_WS_URL=wss://your-project.dtelecom.io
 *
 *  3. Deploy options:
 *     • Vercel:  place this file as  /api/dtelecom-token.js
 *                (Vercel auto-routes it to GET /api/dtelecom-token)
 *     • Express: app.get('/api/dtelecom-token', handler)
 *     • Next.js: place as /pages/api/dtelecom-token.js
 *
 *  SECURITY:
 *  ─────────
 *  ✅  API key & secret stay server-side only
 *  ✅  Token expires in 6 hours
 *  ✅  Each token uses a random identity (no PII exposed)
 *  ✅  Room name is validated and sanitized
 *  ✅  CORS restricted to your own domain in production
 * ════════════════════════════════════════════════════════════════
 */

// Load env vars (for local dev; Vercel/Render inject them automatically)
require('dotenv').config();

const { AccessToken } = require('@dtelecom/server-sdk-js');

// ── Config ────────────────────────────────────────────────────────
const API_KEY     = process.env.DTELECOM_API_KEY;
const API_SECRET  = process.env.DTELECOM_API_SECRET;
const WS_URL      = process.env.DTELECOM_WS_URL; // e.g. wss://xyz.dtelecom.io

// Allowed room names (optional whitelist — remove to allow any room name)
const ALLOWED_ROOMS = null; // Set to e.g. ['shelby-room', 'dev-room'] to restrict

// ── Handler (Vercel Serverless / Next.js API style) ───────────────
module.exports = async function handler(req, res) {
  // ── CORS headers ─────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Validate environment ──────────────────────────────────────
  if (!API_KEY || !API_SECRET || !WS_URL) {
    console.error('[dTelecom] Missing env vars: DTELECOM_API_KEY, DTELECOM_API_SECRET, DTELECOM_WS_URL');
    return res.status(500).json({ error: 'Server misconfigured — missing dTelecom credentials' });
  }

  // ── Parse & validate room name ────────────────────────────────
  const rawRoom = (req.query?.room || 'shelby-room').toString().trim();
  // Sanitize: alphanumeric, hyphens, underscores only
  const roomName = rawRoom.replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 64) || 'shelby-room';

  if (ALLOWED_ROOMS && !ALLOWED_ROOMS.includes(roomName)) {
    return res.status(403).json({ error: `Room "${roomName}" is not allowed` });
  }

  // ── Generate random user identity ─────────────────────────────
  // Using random ID so no real user info is attached to the call token
  const identity = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // ── Build JWT access token ────────────────────────────────────
  try {
    const at = new AccessToken(API_KEY, API_SECRET, {
      identity,
      name: `ShelbyUser-${identity.slice(-6)}`, // display name in room
      ttl: 6 * 60 * 60, // 6 hours in seconds
    });

    // Grant permissions for this room
    at.addGrant({
      room: roomName,
      roomJoin: true,          // allow joining
      canPublish: true,         // allow publishing audio/video
      canSubscribe: true,       // allow receiving others' streams
      canPublishData: false,    // disable data channels (not needed for basic calls)
    });

    const token = at.toJwt();

    // Return token + websocket URL to frontend
    return res.status(200).json({
      token,
      url: WS_URL,
      room: roomName,
      identity,
    });

  } catch (err) {
    console.error('[dTelecom] Token generation error:', err);
    return res.status(500).json({ error: 'Failed to generate access token' });
  }
};


/**
 * ════════════════════════════════════════════════════════════════
 *  EXPRESS.JS USAGE (alternative to Vercel serverless)
 * ════════════════════════════════════════════════════════════════
 *
 *  const express = require('express');
 *  const app = express();
 *  const dtelecomHandler = require('./api-dtelecom-token');
 *
 *  app.get('/api/dtelecom-token', dtelecomHandler);
 *  app.listen(3001);
 *
 * ════════════════════════════════════════════════════════════════
 *  VERCEL DEPLOYMENT
 * ════════════════════════════════════════════════════════════════
 *
 *  1. Rename this file to:  /api/dtelecom-token.js
 *     (Vercel auto-detects files in /api/ as serverless functions)
 *
 *  2. Add env vars in Vercel dashboard:
 *     Settings → Environment Variables → add:
 *       DTELECOM_API_KEY     = <your key>
 *       DTELECOM_API_SECRET  = <your secret>
 *       DTELECOM_WS_URL      = wss://your-project.dtelecom.io
 *       ALLOWED_ORIGIN       = https://your-app.vercel.app
 *
 *  3. Deploy: vercel --prod
 *
 * ════════════════════════════════════════════════════════════════
 */
