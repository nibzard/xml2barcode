/**
 * ABOUTME: End-to-end tests for the IBAN-trust message pipeline
 * ABOUTME: Chains real textParser.parse -> mod-97 validation -> trust evaluation -> HTML render
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadParserContext, loadTrustContext } = require('./setup');

const { textParser } = loadParserContext();
const { buildDisplayMessages, messagesToHtml } = loadTrustContext();

const GOOD = 'HR5423900013221482195';
const TYPO = 'HR4523900013221482195'; // first two digits transposed -> fails mod-97

// Resolver mirroring production i18n.t, with {name}-templates so citations render.
const t = (key) => ({
    warningInvalidIban: 'warningInvalidIban',
    cautionNewPayee: 'cautionNewPayee',
    noticeKnownIban: 'noticeKnownIban {name}',
    warningIbanNameMismatch: 'warningIbanNameMismatch {name}'
}[key] || key);

const mk = (iban, name, amount = '100.00') => ({ iban, supplierName: name, amount });

// Drive the full pipeline and return the rendered HTML for a given paste + history.
function render(pasteText, history) {
    const data = textParser.parse(pasteText);
    const messages = buildDisplayMessages(data, history, t);
    return messagesToHtml(messages, (x) => x.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
}

const basePaste = (name) => [
    'IBAN: ' + GOOD,
    'Iznos: 50,00 eur',
    'Naziv primatelja: ' + name,
    'Poziv na broj primatelja: HR69 40002-55950527428-200'
].join('\n');

test('fresh valid IBAN, empty history -> new-payee caution (no green, no checkmark)', () => {
    const html = render(basePaste('ACME'), []);
    assert.ok(html.indexOf('cautionNewPayee') !== -1, 'cautions on an unseen IBAN');
    assert.ok(html.indexOf('msg-caution') !== -1, 'caution severity classed');
    assert.ok(html.indexOf('msg-info') === -1, 'no familiar badge for a new IBAN');
    assert.ok(html.indexOf('warningInvalidIban') === -1, 'valid IBAN -> no invalid warning');
});

test('transposed-digit IBAN -> mod-97 warning AND new-payee caution', () => {
    const paste = [
        'IBAN: ' + TYPO,
        'Iznos: 50,00 eur',
        'Poziv na broj primatelja: HR69 40002-55950527428-200'
    ].join('\n');
    // History includes the just-stored current item, so the IBAN is still unfamiliar.
    const html = render(paste, [mk(TYPO, 'ACME')]);
    assert.ok(html.indexOf('warningInvalidIban') !== -1, 'mod-97 failure surfaces as a warning');
    assert.ok(html.indexOf('msg-warning') !== -1);
    assert.ok(html.indexOf('cautionNewPayee') !== -1, 'still cautions as a new IBAN');
});

test('previously-used IBAN under a DIFFERENT payee name -> mismatch warning citing the old name', () => {
    // Current payment is to "NEW CO"; history has this IBAN under "OLD CO" (plus current).
    const html = render(basePaste('NEW CO'), [mk(GOOD, 'NEW CO'), mk(GOOD, 'OLD CO', '1.00')]);
    assert.ok(html.indexOf('warningIbanNameMismatch') !== -1, 'flags the IBAN/name mismatch');
    assert.ok(html.indexOf('OLD CO') !== -1, 'cites the previously-used payee name');
    assert.ok(html.indexOf('cautionNewPayee') === -1, 'mismatch takes priority over the caution');
});

test('previously-used IBAN under the SAME payee -> muted familiar notice, no caution', () => {
    const html = render(basePaste('ACME'), [mk(GOOD, 'ACME'), mk(GOOD, 'ACME', '5.00')]);
    assert.ok(html.indexOf('noticeKnownIban') !== -1, 'soft recognition for a known IBAN');
    assert.ok(html.indexOf('msg-info') !== -1, 'info severity, not amber');
    assert.ok(html.indexOf('cautionNewPayee') === -1, 'no caution once the IBAN is known');
});

test('output is HTML-escaped (cited payee name cannot inject markup)', () => {
    // The mismatch message cites the OTHER (prior) payee name, so the markup must be in
    // the prior entry to exercise escaping of the cited name.
    const html = render(basePaste('evil'), [mk(GOOD, 'evil'), mk(GOOD, '<b>ACME</b>', '1.00')]);
    assert.ok(html.indexOf('<b>') === -1, 'raw markup from the cited payee name never reaches the DOM');
    assert.ok(html.indexOf('&lt;b&gt;ACME&lt;/b&gt;') !== -1, 'cited payee name is escaped');
});
