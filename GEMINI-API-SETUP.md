# 🔑 Gemini API Setup Guide

## Problem

You're seeing: **"AI rate limit exceeded. Please try again in a moment."**

This happens when:
1. ❌ No Gemini API key configured
2. ❌ API key is invalid
3. ❌ Free tier quota exhausted

---

## ✅ Solution: Get Your Gemini API Key

### Step 1: Go to Google AI Studio

Open: **https://aistudio.google.com/apikey**

### Step 2: Create API Key

1. Click **"Get API Key"**
2. Click **"Create API key in new project"**
3. Copy the generated key

### Step 3: Add to `.env.local`

Open `.env.local` and replace:

```env
VITE_GEMINI_API_KEY=your_key_here
```

With your actual key:

```env
VITE_GEMINI_API_KEY=AIzaSyC...your_actual_key_here
```

### Step 4: Restart Dev Server

```bash
# Stop current server (Ctrl+C)
# Restart
npm run dev
```

---

## 🆓 Free Tier Limits

**Gemini 1.5 Flash (Free):**
- ✅ 15 requests per minute
- ✅ 1 million tokens per day
- ✅ 1,500 requests per day

**Tips:**
- Wait 4-5 seconds between requests
- Use retry logic (already implemented)
- Consider upgrading to paid if heavy use

---

## 🔧 What I Fixed

### 1. API Key Variable
**Before:** `process.env.API_KEY` ❌  
**After:** `import.meta.env.VITE_GEMINI_API_KEY` ✅

### 2. Retry Logic
**Before:** 2 retries, 2-4 second waits ❌  
**After:** 3 retries, exponential backoff (5s → 10s → 20s) ✅

### 3. Model Version
**Before:** `gemini-2.0-flash` (not available) ❌  
**After:** `gemini-1.5-flash` (stable) ✅

### 4. Error Detection
Added detection for:
- `rate limit` string
- HTTP 429 status
- `RESOURCE_EXHAUSTED` error

---

## 🚀 After Setup

**Test the AI:**
1. Add a new link
2. AI should analyze it automatically
3. Wait 5-10 seconds if rate limited
4. Should retry automatically

---

## 📊 Monitoring

**Check browser console for:**
```
Rate limit hit for https://example.com. 
Waiting 5000ms before retry 1/3...
```

**Success looks like:**
```json
{
  "categoryName": "Development",
  "suggestedTitle": "Example Site",
  "suggestedDescription": "A description...",
  "suggestedSection": "Frontend",
  "categoryIcon": "fa-code"
}
```

---

## ⚠️ If Still Not Working

**1. Verify API Key**
```bash
# In .env.local, key should start with:
VITE_GEMINI_API_KEY=AIzaSy...
```

**2. Check Quota**
Go to: https://aistudio.google.com/app/apikey
- Check usage limits
- Verify key is active

**3. Test Directly**
```bash
curl -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
  -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=YOUR_KEY"
```

**4. Fallback: Manual Entry**
If AI keeps failing, you can:
- Enter title/description manually
- Choose category from dropdown
- AI is optional!

---

## 🎯 Quick Fix Checklist

- [ ] Get API key from https://aistudio.google.com/apikey
- [ ] Add to `.env.local` as `VITE_GEMINI_API_KEY=...`
- [ ] Restart dev server (`npm run dev`)
- [ ] Test by adding a link
- [ ] Check browser console for errors

---

**Need help?** Check the fixes I made in `services/geminiService.ts`
