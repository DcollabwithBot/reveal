-- Migration: tour_onboarding
-- Tilføjer koloner til profiles-tabellen for guided tour tracking
-- Dato: 2026-03-21

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tour_skipped BOOLEAN DEFAULT FALSE;
