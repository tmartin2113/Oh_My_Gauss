# Mobile Manual Test Plan — Oh_My_Gauss App

**Status:** Ready to execute once VIB-21 delivers Expo app code.
**Prerequisite:** Backend running (`npm run dev` in `backend/`) + MCP server running (`npm start` in project root).

---

## 1. Auth Flow

### iOS Simulator (Expo Go)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Launch app fresh | Welcome screen shown — provider picker (Claude / OpenAI / Gemini) visible | |
| 2 | Select Claude, enter invalid API key, tap Connect | Error message shown, user stays on Connect screen | |
| 3 | Select Claude, enter valid API key, tap Connect | Verifying screen → success → Dashboard | |
| 4 | Force-quit app, relaunch | Dashboard shown immediately (JWT from SecureStore) | |
| 5 | Sign out from Settings | Welcome screen shown, JWT cleared from SecureStore | |

### Android Emulator (Expo Go)

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Launch app fresh | Welcome screen (provider picker) with correct Android ripple feedback | |
| 2 | Keyboard appears on Connect screen | Screen adjusts (adjustResize keyboard behavior), input stays visible | |
| 3 | Sign in with OpenAI key | Provider badge shows "OpenAI" accent color (#10B981) in Settings | |
| 4 | Force-quit, relaunch | Auth persists via SecureStore | |
| 5 | Switch provider from Settings | Old session cleared, new sign-in flow starts | |

---

## 2. SecureStore Persistence

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Sign in, then kill + restart app | JWT persists, no re-login needed | |
| 2 | Sign in, uninstall app, reinstall | Welcome screen (SecureStore cleared on uninstall) | |
| 3 | Sign in, let JWT expire (1h), open app | App auto-refreshes JWT via refresh token silently | |
| 4 | Sign in, let refresh token expire (7d) | App redirects to Welcome screen, prompts re-login | |

---

## 3. Tool Execution — Loading / Error / Empty States

### search_papers

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Enter query "quantum entanglement", tap Search | Loading spinner shown | |
| 2 | Results appear | FlashList renders paper cards with title, source badge, relevance score | |
| 3 | Enter empty query | Validation error ("Query is required") before network call | |
| 4 | Disable WiFi, tap Search | Error state shown with retry button | |
| 5 | Search yields 0 results | Empty state illustration + "No papers found" message | |

### search_science

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Enter question, select field, tap Search | Loading state → results in FlashList | |
| 2 | Field filter changes results | Results relevant to selected science field | |

### scrape_science

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Pick a source from picker, tap Scrape | Bottom-sheet opens at 50% snap showing progress | |
| 2 | Scrape completes | Results shown in bottom-sheet at 90% snap | |
| 3 | Swipe down to dismiss | Bottom-sheet dismisses cleanly | |

### list_sources

| # | Step | Expected | Pass? |
|---|------|----------|-------|
| 1 | Navigate to Sources tab | SectionList grouped by science field, KB stats in header | |
| 2 | Count of sources matches `/tools/list_sources` API response | Numbers consistent | |

---

## 4. Platform-Specific UI Checks

### iOS

| # | Check | Expected | Pass? |
|---|-------|----------|-------|
| 1 | Safe areas (iPhone with notch) | No content obscured by notch or home indicator | |
| 2 | Haptic feedback on Connect success | Device vibrates (expo-haptics) | |
| 3 | Bottom-sheet on tool result | Native iOS feel, correct spring animation | |
| 4 | KeyboardAvoidingView on API key entry | Input not obscured by keyboard | |

### Android

| # | Check | Expected | Pass? |
|---|-------|----------|-------|
| 1 | Edge-to-edge display | App renders behind status bar correctly | |
| 2 | Ripple feedback on buttons | Material ripple visible on tap | |
| 3 | Elevation shadows | Cards have correct Android elevation | |
| 4 | Back button behavior | Hardware back navigates correctly | |

---

## 5. Design Token Verification

| Token | Value | Verified? |
|-------|-------|-----------|
| Primary color | #7C3AED | |
| Background | #0F0F13 | |
| Surface | #1A1A24 | |
| Claude accent | #D97706 | |
| OpenAI accent | #10B981 | |
| Gemini accent | #3B82F6 | |
| Base spacing | 4/8/12/16/24/32px | |
| Border radius | 8/12/24px | |

---

## 6. Security Checks

| # | Check | Expected | Pass? |
|---|-------|----------|-------|
| 1 | Inspect network traffic (Charles Proxy) | Raw API key never appears in any request after initial `/auth/validate` | |
| 2 | Check SecureStore contents via Expo DevTools | JWT stored, NOT raw API key | |
| 3 | Check response bodies from `/tools/*` | No API key in any response | |

---

## Notes

- **iOS physical device**: Required for push notification and keychain tests (beyond this scope).
- **MCP_LIVE E2E**: Run `MCP_LIVE=1 npx vitest run backend/__tests__/e2e.test.ts` with both servers running for automated E2E validation before this manual plan.
