-- sequence_enrollments.channel_id was declared without an ON DELETE action
-- (00005_sequences.sql), so deleting a channel with enrollments failed with a
-- 23503 FK violation. Every other channel FK cascades (or sets null); align
-- this one so channel deletion works.
ALTER TABLE sequence_enrollments
  DROP CONSTRAINT sequence_enrollments_channel_id_fkey,
  ADD CONSTRAINT sequence_enrollments_channel_id_fkey
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;
