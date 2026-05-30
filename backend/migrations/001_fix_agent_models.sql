-- Migration: Update Agent records from 'llama3.2' to valid OpenRouter model
-- This fixes the hardcoded fallback issue where classifier nodes send invalid model ID

UPDATE agents
SET model = 'meta-llama/llama-3.2-3b-instruct:free'
WHERE model = 'llama3.2';

-- Log the result
SELECT COUNT(*) as updated_count FROM agents WHERE model = 'meta-llama/llama-3.2-3b-instruct:free';
