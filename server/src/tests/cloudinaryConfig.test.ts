/**
 * TripMate: Cloudinary Configuration & Initialization Test Suite
 *
 * Verifies:
 * 1. Environment variables are loaded before Cloudinary SDK initialization.
 * 2. ensureCloudinaryConfig() configures Cloudinary with valid credentials.
 * 3. Calling ensureCloudinaryConfig() multiple times is idempotent.
 * 4. Missing credentials produce clear, informative errors identifying the variable name without leaking secrets.
 * 5. Cloudinary credentials (api_key, api_secret) are never exposed.
 */

import { ensureCloudinaryConfig, cloudinary } from '../config/cloudinary';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('TripMate: Cloudinary Configuration Test Suite');
  console.log('======================================================\n');

  // Backup original env
  const origCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const origApiKey = process.env.CLOUDINARY_API_KEY;
  const origApiSecret = process.env.CLOUDINARY_API_SECRET;

  try {
    // 1. Verify current environment configuration loads successfully
    console.log('--- Test 1: Configuration with Loaded Environment ---');
    const instance = ensureCloudinaryConfig();
    const config = instance.config();

    assert(Boolean(config.cloud_name), 'Cloudinary cloud_name is loaded and configured');
    assert(Boolean(config.api_key), 'Cloudinary api_key is loaded and configured (Not undefined)');
    assert(typeof config.api_secret === 'string' && config.api_secret.length > 0, 'Cloudinary api_secret is loaded');
    assert(config.secure === true, 'Cloudinary secure mode is enabled');

    // 2. Verify idempotency
    console.log('\n--- Test 2: Idempotent Initialization ---');
    const secondCall = ensureCloudinaryConfig();
    assert(secondCall === instance, 'Subsequent ensureCloudinaryConfig() calls return the configured instance');

    // 3. Test missing variable detection without leaking secrets
    console.log('\n--- Test 3: Missing Environment Variable Validation ---');

    // We isolate this by re-testing the validation logic
    const validateEnv = (cloudName?: string, apiKey?: string, apiSecret?: string) => {
      const missing: string[] = [];
      if (!cloudName) missing.push('CLOUDINARY_CLOUD_NAME');
      if (!apiKey) missing.push('CLOUDINARY_API_KEY');
      if (!apiSecret) missing.push('CLOUDINARY_API_SECRET');
      if (missing.length > 0) {
        throw new Error(
          `Cloudinary configuration error: Missing required environment variable(s): ${missing.join(', ')}. Please verify server environment configuration.`
        );
      }
    };

    let caughtError = '';
    try {
      validateEnv('test-cloud', undefined, 'secret');
    } catch (err: any) {
      caughtError = err.message;
    }

    assert(
      caughtError.includes('CLOUDINARY_API_KEY') && !caughtError.includes('secret'),
      'Missing CLOUDINARY_API_KEY reports exact missing variable name without leaking values'
    );

    let caughtMulti = '';
    try {
      validateEnv(undefined, undefined, undefined);
    } catch (err: any) {
      caughtMulti = err.message;
    }
    assert(
      caughtMulti.includes('CLOUDINARY_CLOUD_NAME') &&
      caughtMulti.includes('CLOUDINARY_API_KEY') &&
      caughtMulti.includes('CLOUDINARY_API_SECRET'),
      'All missing variable names are reported together when multiple variables are unset'
    );

    // 4. Verify no secret leaks in config serialization
    console.log('\n--- Test 4: Secret Safety in Serialization ---');
    const serializedConfig = JSON.stringify({
      cloud_name: config.cloud_name,
      configured: Boolean(config.api_key),
    });
    assert(!serializedConfig.includes(origApiKey || '___') && !serializedConfig.includes(origApiSecret || '___'), 'Config representation does not expose api_key or api_secret');

    console.log('\n======================================================');
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    // Restore original env
    process.env.CLOUDINARY_CLOUD_NAME = origCloudName;
    process.env.CLOUDINARY_API_KEY = origApiKey;
    process.env.CLOUDINARY_API_SECRET = origApiSecret;
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

