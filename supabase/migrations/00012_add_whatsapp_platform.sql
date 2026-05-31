-- Add WhatsApp to the channels platform CHECK constraint
-- The TypeScript types and UI already support WhatsApp, but the DB constraint was missing.

ALTER TABLE channels DROP CONSTRAINT channels_platform_check;
ALTER TABLE channels ADD CONSTRAINT channels_platform_check
  CHECK (platform IN ('facebook', 'instagram', 'twitter', 'telegram', 'bluesky', 'reddit', 'whatsapp'));

-- Also add to conversations if it has a similar constraint
-- (conversations.platform references the same set of values)
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_platform_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_platform_check
  CHECK (platform IN ('facebook', 'instagram', 'twitter', 'telegram', 'bluesky', 'reddit', 'whatsapp'));
