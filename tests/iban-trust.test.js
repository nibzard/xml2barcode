/**
 * ABOUTME: Unit tests for the IBAN-trust heuristics (familiarity + payee-name mismatch)
 * ABOUTME: Drives the inverted design: caution on unfamiliar IBANs, warn on name mismatches
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadTrustContext } = require('./setup');

const { ibanTrust, composeTrustMessages, buildDisplayMessages, messagesToHtml } = loadTrustContext();

const GOOD = 'HR5423900013221482195';
const OTHER_IBAN = 'GB82WEST12345698765432';

// Minimal history item shape (only the fields iban-trust reads).
const mk = (iban, name, amount = '100.00') => ({ iban, supplierName: name, amount });

// --- IbanTrust.evaluate -----------------------------------------------------

test('empty history -> unfamiliar (no prior use)', () => {
    const r = ibanTrust.evaluate(GOOD, 'ACME', []);
    assert.strictEqual(r.isFamiliar, false);
    assert.strictEqual(r.priorCount, 0);
    assert.strictEqual(r.nameMismatch, false);
    assert.strictEqual(r.otherPayeeName, null);
});

test('only the current entry in history -> still unfamiliar (self excluded)', () => {
    // storage.add() inserts the current item before display, so the current IBAN is
    // always present once. Familiarity must subtract that self-match.
    const r = ibanTrust.evaluate(GOOD, 'ACME', [mk(GOOD, 'ACME')]);
    assert.strictEqual(r.isFamiliar, false);
    assert.strictEqual(r.priorCount, 0);
});

test('a genuinely prior item with the same IBAN -> familiar', () => {
    const r = ibanTrust.evaluate(GOOD, 'ACME', [mk(GOOD, 'ACME'), mk(GOOD, 'ACME', '200.00')]);
    assert.strictEqual(r.isFamiliar, true);
    assert.strictEqual(r.priorCount, 1);
    assert.strictEqual(r.nameMismatch, false);
});

test('familiarity is space/case-insensitive across the two input pipelines', () => {
    // XML path stores without uppercasing, text path uppercases; compare normalized.
    // History includes the current entry once (production: storage.add runs before display),
    // plus a prior entry, so the IBAN is genuinely familiar.
    const r = ibanTrust.evaluate(
        'hr5423 9000 1322 1482 195',
        'ACME',
        [mk('HR5423900013221482195', 'ACME'), mk('HR5423900013221482195', 'ACME', '50.00')]
    );
    assert.strictEqual(r.isFamiliar, true);
    assert.strictEqual(r.priorCount, 1);
});

test('a different IBAN in history does not count as familiar', () => {
    const r = ibanTrust.evaluate(GOOD, 'ACME', [mk(OTHER_IBAN, 'ACME', '100.00')]);
    assert.strictEqual(r.isFamiliar, false);
    assert.strictEqual(r.priorCount, 0);
});

test('same IBAN previously used under a different payee name -> nameMismatch', () => {
    const r = ibanTrust.evaluate(GOOD, 'ACME', [mk(GOOD, 'ACME'), mk(GOOD, 'OLD SUPPLIER', '300.00')]);
    assert.strictEqual(r.isFamiliar, true);
    assert.strictEqual(r.nameMismatch, true);
    assert.strictEqual(r.otherPayeeName, 'OLD SUPPLIER');
});

test('payee-name match is accent/case/whitespace insensitive (Croatian names)', () => {
    // "Čakavica" vs "cakavica" — same payee, no false mismatch.
    const r = ibanTrust.evaluate(GOOD, 'Čakavica d.o.o.', [mk(GOOD, 'Čakavica d.o.o.'), mk(GOOD, 'cakavica d.o.o.', '20.00')]);
    assert.strictEqual(r.nameMismatch, false);
    assert.strictEqual(r.isFamiliar, true);
});

test('a representative known payee name is provided for the familiar notice', () => {
    const r = ibanTrust.evaluate(GOOD, 'ACME', [mk(GOOD, 'ACME'), mk(GOOD, 'ACME', '1.00')]);
    assert.strictEqual(r.knownPayeeName, 'ACME');
});

// --- composeTrustMessages (mutually exclusive: mismatch > familiar > new) ---

// Resolver that returns real templates for the {name}-parameterized keys so replacement
// is actually exercised; plain keys pass through (mirrors the harness's identity stub).
const t = (key) => ({
    cautionNewPayee: 'cautionNewPayee',
    noticeKnownIban: 'noticeKnownIban {name}',
    warningIbanNameMismatch: 'warningIbanNameMismatch {name}'
}[key] || key);

test('unfamiliar -> caution message', () => {
    const msgs = composeTrustMessages({ isFamiliar: false, nameMismatch: false }, t);
    assert.strictEqual(msgs.length, 1);
    assert.strictEqual(msgs[0].level, 'caution');
    assert.strictEqual(msgs[0].text, 'cautionNewPayee');
});

test('familiar, names match -> muted info notice (never a checkmark)', () => {
    const msgs = composeTrustMessages({ isFamiliar: true, nameMismatch: false, knownPayeeName: 'ACME' }, t);
    assert.strictEqual(msgs.length, 1);
    assert.strictEqual(msgs[0].level, 'info');
    assert.ok(msgs[0].text.indexOf('noticeKnownIban') !== -1);
    assert.ok(msgs[0].text.indexOf('ACME') !== -1, 'cites the known payee name');
});

test('familiar but name differs -> warning, citing the other name', () => {
    const msgs = composeTrustMessages({ isFamiliar: true, nameMismatch: true, otherPayeeName: 'OLD SUPPLIER' }, t);
    assert.strictEqual(msgs.length, 1);
    assert.strictEqual(msgs[0].level, 'warning');
    assert.ok(msgs[0].text.indexOf('OLD SUPPLIER') !== -1, 'cites the other payee name');
});

test('mismatch takes priority over familiar', () => {
    const msgs = composeTrustMessages({ isFamiliar: true, nameMismatch: true, otherPayeeName: 'X', knownPayeeName: 'Y' }, t);
    assert.strictEqual(msgs[0].level, 'warning');
});

// --- buildDisplayMessages (merges parser warnings + trust) ------------------

test('buildDisplayMessages merges parser warnings with the trust signal', () => {
    // History includes the current entry plus a prior -> familiar (info notice).
    const msgs = buildDisplayMessages(
        { iban: GOOD, supplierName: 'ACME', warnings: ['warningMissingAmount'] },
        [mk(GOOD, 'ACME'), mk(GOOD, 'ACME', '5.00')],
        t
    );
    assert.strictEqual(msgs.length, 2);
    assert.strictEqual(msgs[0].level, 'warning');
    assert.strictEqual(msgs[0].text, 'warningMissingAmount');
    assert.strictEqual(msgs[1].level, 'info'); // familiar notice
});

test('buildDisplayMessages omits the trust signal entirely when there is no IBAN', () => {
    const msgs = buildDisplayMessages({ iban: null, supplierName: '', warnings: ['warningMissingIban'] }, [], t);
    assert.strictEqual(msgs.length, 1);
    assert.strictEqual(msgs[0].level, 'warning');
    assert.strictEqual(msgs[0].text, 'warningMissingIban');
});

test('buildDisplayMessages yields a new-payee caution for a fresh IBAN', () => {
    const msgs = buildDisplayMessages({ iban: GOOD, supplierName: 'ACME', warnings: [] }, [], t);
    assert.strictEqual(msgs.length, 1);
    assert.strictEqual(msgs[0].level, 'caution');
    assert.strictEqual(msgs[0].text, 'cautionNewPayee');
});

// --- messagesToHtml (render contract) --------------------------------------

test('messagesToHtml emits severity-classed list items', () => {
    const html = messagesToHtml(
        [{ level: 'warning', text: 'A' }, { level: 'caution', text: 'B' }, { level: 'info', text: 'C' }],
        (x) => x // escaper passthrough
    );
    assert.ok(html.includes('<ul>'), 'wrapped in a list');
    assert.ok(html.includes('class="msg-warning"'), 'warning level classed');
    assert.ok(html.includes('class="msg-caution"'), 'caution level classed');
    assert.ok(html.includes('class="msg-info"'), 'info level classed');
});

test('messagesToHtml escapes message text', () => {
    const esc = (x) => x.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = messagesToHtml([{ level: 'warning', text: '<script>' }], esc);
    assert.ok(html.indexOf('<script>') === -1, 'raw payload never reaches the DOM');
    assert.ok(html.indexOf('&lt;script&gt;') !== -1, 'payload is HTML-escaped');
});
