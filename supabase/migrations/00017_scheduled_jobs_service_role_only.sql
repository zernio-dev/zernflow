-- scheduled_jobs is service-role only (00002). 00009 added user policies so
-- the broadcast send route could insert with its session client; that route
-- now uses the service client, so the policies go.
DROP POLICY IF EXISTS "Authenticated users can insert jobs" ON scheduled_jobs;
DROP POLICY IF EXISTS "Authenticated users can read jobs" ON scheduled_jobs;
DROP POLICY IF EXISTS "Authenticated users can update jobs" ON scheduled_jobs;
