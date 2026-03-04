#!/usr/bin/env node
/**
 * Blink Lightning Wallet CLI
 *
 * Unified entry point for all Blink wallet operations.
 * Run `blink --help` for usage or `blink <command> --help` for command-specific help.
 */

const { Command, InvalidArgumentError } = require('commander');
const path = require('path');

const program = new Command();
const scriptsDir = path.join(__dirname, '..', 'blink', 'scripts');

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseSats(value) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n <= 0) throw new InvalidArgumentError('Must be a positive integer (sats).');
  return n;
}

function parseCents(value) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n <= 0) throw new InvalidArgumentError('Must be a positive integer (cents).');
  return n;
}

function parseNonNegativeInt(value) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0) throw new InvalidArgumentError('Must be a non-negative integer.');
  return n;
}

function parsePositiveInt(value) {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 1) throw new InvalidArgumentError('Must be a positive integer.');
  return n;
}

/**
 * Inject parsed commander options/args into process.argv so that existing
 * script main() functions (which parse process.argv internally) work unchanged.
 *
 * @param {string[]} argv  Synthetic argv entries (e.g., ['1000', '--wallet', 'BTC'])
 */
function setProcessArgv(argv) {
  process.argv = [process.argv[0], 'blink', ...argv];
}

/** Standard error handler matching the existing script convention. */
function handleError(e) {
  console.error('Error:', e.message);
  process.exit(1);
}

// ── Program setup ────────────────────────────────────────────────────────────

program
  .name('blink')
  .version(require('../package.json').version)
  .description('Bitcoin Lightning wallet CLI — balances, invoices, payments, QR codes, price conversion, and transaction history via the Blink API.')
  .showHelpAfterError('(run with --help for usage)')
  .showSuggestionAfterError();

// ── balance ──────────────────────────────────────────────────────────────────

program
  .command('balance')
  .description('Show BTC and USD wallet balances with pre-computed USD estimates')
  .addHelpText('after', '\nExamples:\n  blink balance')
  .action(async () => {
    setProcessArgv([]);
    const { main } = require(path.join(scriptsDir, 'balance.js'));
    await main();
  });

// ── pay-invoice ──────────────────────────────────────────────────────────────

program
  .command('pay-invoice')
  .description('Pay a BOLT-11 Lightning invoice')
  .argument('<bolt11>', 'BOLT-11 payment request string (lnbc...)')
  .option('-w, --wallet <currency>', 'Wallet to pay from', 'BTC')
  .option('--dry-run', 'Show what would be sent without executing the payment')
  .option('--force', 'Skip balance sufficiency check')
  .addHelpText('after', '\nExamples:\n  blink pay-invoice lnbc10u1p...\n  blink pay-invoice lnbc10u1p... --wallet USD\n  blink pay-invoice lnbc10u1p... --dry-run')
  .action(async (bolt11, opts) => {
    const argv = [bolt11, '--wallet', opts.wallet];
    if (opts.dryRun) argv.push('--dry-run');
    if (opts.force) argv.push('--force');
    setProcessArgv(argv);
    const { main } = require(path.join(scriptsDir, 'pay_invoice.js'));
    await main();
  });

// ── pay-lnaddress ────────────────────────────────────────────────────────────

program
  .command('pay-lnaddress')
  .description('Send sats to a Lightning Address (user@domain)')
  .argument('<address>', 'Lightning Address (e.g. user@blink.sv)')
  .argument('<amount>', 'Amount in satoshis', parseSats)
  .option('-w, --wallet <currency>', 'Wallet to pay from', 'BTC')
  .option('--dry-run', 'Show what would be sent without executing the payment')
  .option('--force', 'Skip balance sufficiency check')
  .option('--max-amount <sats>', 'Reject if amount exceeds this threshold', parseSats)
  .addHelpText('after', '\nExamples:\n  blink pay-lnaddress user@blink.sv 1000\n  blink pay-lnaddress user@blink.sv 1000 --wallet USD\n  blink pay-lnaddress user@blink.sv 1000 --dry-run')
  .action(async (address, amount, opts) => {
    if (opts.maxAmount && amount > opts.maxAmount) {
      console.error(`Error: amount ${amount} sats exceeds --max-amount ${opts.maxAmount} sats`);
      process.exit(1);
    }
    const argv = [address, String(amount), '--wallet', opts.wallet];
    if (opts.dryRun) argv.push('--dry-run');
    if (opts.force) argv.push('--force');
    setProcessArgv(argv);
    const { main } = require(path.join(scriptsDir, 'pay_lnaddress.js'));
    await main();
  });

// ── pay-lnurl ────────────────────────────────────────────────────────────────

program
  .command('pay-lnurl')
  .description('Send sats to a raw LNURL payRequest string')
  .argument('<lnurl>', 'LNURL string (lnurl1...)')
  .argument('<amount>', 'Amount in satoshis', parseSats)
  .option('-w, --wallet <currency>', 'Wallet to pay from', 'BTC')
  .option('--dry-run', 'Show what would be sent without executing the payment')
  .option('--force', 'Skip balance sufficiency check')
  .option('--max-amount <sats>', 'Reject if amount exceeds this threshold', parseSats)
  .addHelpText('after', '\nExamples:\n  blink pay-lnurl lnurl1dp68... 5000\n  blink pay-lnurl lnurl1dp68... 5000 --wallet USD')
  .action(async (lnurl, amount, opts) => {
    if (opts.maxAmount && amount > opts.maxAmount) {
      console.error(`Error: amount ${amount} sats exceeds --max-amount ${opts.maxAmount} sats`);
      process.exit(1);
    }
    const argv = [lnurl, String(amount), '--wallet', opts.wallet];
    if (opts.dryRun) argv.push('--dry-run');
    if (opts.force) argv.push('--force');
    setProcessArgv(argv);
    const { main } = require(path.join(scriptsDir, 'pay_lnurl.js'));
    await main();
  });

// ── create-invoice ───────────────────────────────────────────────────────────

program
  .command('create-invoice')
  .description('Create a BTC Lightning invoice (BOLT-11) with optional auto-subscribe')
  .argument('<amount>', 'Amount in satoshis', parseSats)
  .argument('[memo...]', 'Optional memo text')
  .option('--timeout <seconds>', 'Subscription timeout in seconds (0 = no timeout)', parseNonNegativeInt, 300)
  .option('--no-subscribe', 'Skip WebSocket auto-subscribe for payment status')
  .addHelpText('after', '\nExamples:\n  blink create-invoice 1000\n  blink create-invoice 5000 "Coffee payment"\n  blink create-invoice 1000 --no-subscribe\n  blink create-invoice 1000 --timeout 60')
  .action(async (amount, memo, opts) => {
    const argv = [String(amount)];
    if (opts.timeout !== undefined) argv.push('--timeout', String(opts.timeout));
    if (opts.subscribe === false) argv.push('--no-subscribe');
    if (memo && memo.length > 0) argv.push(...memo);
    setProcessArgv(argv);
    const { main } = require(path.join(scriptsDir, 'create_invoice.js'));
    await main();
  });

// ── create-invoice-usd ──────────────────────────────────────────────────────

program
  .command('create-invoice-usd')
  .description('Create a USD-denominated Lightning invoice (amount in cents, e.g. 100 = $1.00)')
  .argument('<amount>', 'Amount in USD cents (e.g. 100 = $1.00)', parseCents)
  .argument('[memo...]', 'Optional memo text')
  .option('--timeout <seconds>', 'Subscription timeout in seconds (0 = no timeout)', parseNonNegativeInt, 300)
  .option('--no-subscribe', 'Skip WebSocket auto-subscribe for payment status')
  .addHelpText('after', '\nExamples:\n  blink create-invoice-usd 100      # $1.00\n  blink create-invoice-usd 500 "Tip"\n  blink create-invoice-usd 100 --no-subscribe')
  .action(async (amount, memo, opts) => {
    const argv = [String(amount)];
    if (opts.timeout !== undefined) argv.push('--timeout', String(opts.timeout));
    if (opts.subscribe === false) argv.push('--no-subscribe');
    if (memo && memo.length > 0) argv.push(...memo);
    setProcessArgv(argv);
    const { main } = require(path.join(scriptsDir, 'create_invoice_usd.js'));
    await main();
  });

// ── check-invoice ────────────────────────────────────────────────────────────

program
  .command('check-invoice')
  .description('Check payment status of a Lightning invoice by payment hash')
  .argument('<payment_hash>', 'Payment hash (64-char hex string from create-invoice)')
  .addHelpText('after', '\nExamples:\n  blink check-invoice abc123def456...')
  .action(async (paymentHash) => {
    setProcessArgv([paymentHash]);
    const { main } = require(path.join(scriptsDir, 'check_invoice.js'));
    await main();
  });

// ── fee-probe ────────────────────────────────────────────────────────────────

program
  .command('fee-probe')
  .description('Estimate the fee for paying a Lightning invoice without sending')
  .argument('<bolt11>', 'BOLT-11 payment request string (lnbc...)')
  .option('-w, --wallet <currency>', 'Wallet to probe from', 'BTC')
  .addHelpText('after', '\nExamples:\n  blink fee-probe lnbc10u1p...\n  blink fee-probe lnbc10u1p... --wallet USD')
  .action(async (bolt11, opts) => {
    setProcessArgv([bolt11, '--wallet', opts.wallet]);
    const { main } = require(path.join(scriptsDir, 'fee_probe.js'));
    await main();
  });

// ── qr ───────────────────────────────────────────────────────────────────────

program
  .command('qr')
  .description('Generate a QR code for a Lightning invoice (terminal + PNG file)')
  .argument('<bolt11>', 'BOLT-11 payment request string (lnbc...)')
  .addHelpText('after', '\nExamples:\n  blink qr lnbc10u1p...\n\nOutputs QR code to terminal (stderr) and saves PNG to /tmp/blink_qr_<timestamp>.png')
  .action((bolt11) => {
    setProcessArgv([bolt11]);
    const { main } = require(path.join(scriptsDir, 'qr_invoice.js'));
    main();
  });

// ── transactions ─────────────────────────────────────────────────────────────

program
  .command('transactions')
  .description('List recent wallet transactions with pagination')
  .option('--first <n>', 'Number of transactions to return (1-100)', parsePositiveInt, 20)
  .option('--after <cursor>', 'Pagination cursor from a previous response')
  .option('-w, --wallet <currency>', 'Filter to BTC or USD wallet')
  .addHelpText('after', '\nExamples:\n  blink transactions\n  blink transactions --first 50\n  blink transactions --wallet BTC\n  blink transactions --after <endCursor>')
  .action(async (opts) => {
    const argv = [];
    if (opts.first) argv.push('--first', String(opts.first));
    if (opts.after) argv.push('--after', opts.after);
    if (opts.wallet) argv.push('--wallet', opts.wallet);
    setProcessArgv(argv);
    const { main } = require(path.join(scriptsDir, 'transactions.js'));
    await main();
  });

// ── price ────────────────────────────────────────────────────────────────────

program
  .command('price')
  .description('BTC/USD price, currency conversion, and price history (no API key required)')
  .argument('[amount_sats]', 'Convert this many sats to USD')
  .option('--usd <amount>', 'Convert USD amount to sats', parseFloat)
  .option('--history <range>', 'Show historical prices (ONE_DAY, ONE_WEEK, ONE_MONTH, ONE_YEAR, FIVE_YEARS)')
  .option('--currencies', 'List all supported display currencies')
  .option('--raw', 'Include raw realtimePrice data')
  .addHelpText('after', '\nExamples:\n  blink price                    # Current BTC/USD price\n  blink price 50000              # Convert 50000 sats to USD\n  blink price --usd 10.00        # Convert $10.00 to sats\n  blink price --history ONE_WEEK # Weekly price history\n  blink price --currencies       # List supported currencies')
  .action(async (amountSats, opts) => {
    const argv = [];
    if (opts.raw) argv.push('--raw');
    if (opts.usd !== undefined) {
      argv.push('--usd', String(opts.usd));
    } else if (opts.history) {
      argv.push('--history', opts.history);
    } else if (opts.currencies) {
      argv.push('--currencies');
    } else if (amountSats) {
      argv.push(amountSats);
    }
    setProcessArgv(argv);
    const { main } = require(path.join(scriptsDir, 'price.js'));
    await main();
  });

// ── account-info ─────────────────────────────────────────────────────────────

program
  .command('account-info')
  .description('Show account level, spending limits, and wallet summary')
  .addHelpText('after', '\nExamples:\n  blink account-info')
  .action(async () => {
    setProcessArgv([]);
    const { main } = require(path.join(scriptsDir, 'account_info.js'));
    await main();
  });

// ── subscribe-invoice ────────────────────────────────────────────────────────

program
  .command('subscribe-invoice')
  .description('Watch a Lightning invoice for payment via WebSocket (requires Node 22+ or --experimental-websocket)')
  .argument('<bolt11>', 'BOLT-11 payment request string (lnbc...)')
  .option('--timeout <seconds>', 'Timeout in seconds (0 = no timeout)', parseNonNegativeInt, 300)
  .addHelpText('after', '\nExamples:\n  blink subscribe-invoice lnbc10u1p...\n  blink subscribe-invoice lnbc10u1p... --timeout 60')
  .action((bolt11, opts) => {
    const argv = [bolt11];
    if (opts.timeout !== undefined) argv.push('--timeout', String(opts.timeout));
    setProcessArgv(argv);
    const { main } = require(path.join(scriptsDir, 'subscribe_invoice.js'));
    main();
  });

// ── subscribe-updates ────────────────────────────────────────────────────────

program
  .command('subscribe-updates')
  .description('Stream account activity updates via WebSocket (NDJSON output; requires Node 22+ or --experimental-websocket)')
  .option('--timeout <seconds>', 'Timeout in seconds (0 = no timeout)', parseNonNegativeInt, 0)
  .option('--max <count>', 'Stop after this many events (0 = unlimited)', parseNonNegativeInt, 0)
  .addHelpText('after', '\nExamples:\n  blink subscribe-updates\n  blink subscribe-updates --timeout 60\n  blink subscribe-updates --max 5')
  .action((opts) => {
    const argv = [];
    if (opts.timeout !== undefined) argv.push('--timeout', String(opts.timeout));
    if (opts.max !== undefined) argv.push('--max', String(opts.max));
    setProcessArgv(argv);
    const { main } = require(path.join(scriptsDir, 'subscribe_updates.js'));
    main();
  });

// ── swap-quote ───────────────────────────────────────────────────────────────

program
  .command('swap-quote')
  .description('Get a BTC <-> USD conversion quote (no funds moved)')
  .argument('<direction>', 'Swap direction: btc-to-usd or usd-to-btc (aliases: sell-btc, buy-usd, sell-usd, buy-btc)')
  .argument('<amount>', 'Amount to swap (positive integer)', parsePositiveInt)
  .option('--unit <unit>', 'Amount unit: sats or cents (default depends on direction)')
  .option('--ttl-seconds <seconds>', 'Quote TTL in seconds', parsePositiveInt, 60)
  .option('--immediate', 'Flag the quote for immediate execution')
  .addHelpText('after', '\nExamples:\n  blink swap-quote btc-to-usd 1000\n  blink swap-quote usd-to-btc 500 --unit cents\n  blink swap-quote btc-to-usd 1000 --immediate --ttl-seconds 45')
  .action(async (direction, amount, opts) => {
    const argv = [direction, String(amount)];
    if (opts.unit) argv.push('--unit', opts.unit);
    if (opts.ttlSeconds !== undefined) argv.push('--ttl-seconds', String(opts.ttlSeconds));
    if (opts.immediate) argv.push('--immediate');
    setProcessArgv(argv);
    const { main } = require(path.join(scriptsDir, 'swap_quote.js'));
    await main();
  });

// ── swap-execute ─────────────────────────────────────────────────────────────

program
  .command('swap-execute')
  .description('Execute a BTC <-> USD wallet conversion (CAUTION: moves real funds without --dry-run)')
  .argument('<direction>', 'Swap direction: btc-to-usd or usd-to-btc (aliases: sell-btc, buy-usd, sell-usd, buy-btc)')
  .argument('<amount>', 'Amount to swap (positive integer)', parsePositiveInt)
  .option('--unit <unit>', 'Amount unit: sats or cents (default depends on direction)')
  .option('--dry-run', 'Show what would be swapped without executing')
  .option('--memo <text>', 'Optional memo attached to the transaction')
  .option('--ttl-seconds <seconds>', 'Quote TTL in seconds', parsePositiveInt, 60)
  .option('--immediate', 'Flag the quote for immediate execution')
  .addHelpText('after', '\nExamples:\n  blink swap-execute btc-to-usd 2000\n  blink swap-execute usd-to-btc 500 --unit cents\n  blink swap-execute btc-to-usd 2000 --dry-run\n  blink swap-execute btc-to-usd 2000 --memo "Monthly DCA"')
  .action(async (direction, amount, opts) => {
    const argv = [direction, String(amount)];
    if (opts.unit) argv.push('--unit', opts.unit);
    if (opts.ttlSeconds !== undefined) argv.push('--ttl-seconds', String(opts.ttlSeconds));
    if (opts.immediate) argv.push('--immediate');
    if (opts.dryRun) argv.push('--dry-run');
    if (opts.memo) argv.push('--memo', opts.memo);
    setProcessArgv(argv);
    const { main } = require(path.join(scriptsDir, 'swap_execute.js'));
    await main();
  });

// ── Parse ────────────────────────────────────────────────────────────────────

program.parseAsync().catch(handleError);
