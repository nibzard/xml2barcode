/**
 * ABOUTME: Tests for the HUB-3 payment-string formatter
 * ABOUTME: Verifies the 14-field HRVHUB30 layout and data-driven purpose code (field 13)
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadGeneratorContext } = require('./setup');

const { hub3Generator } = loadGeneratorContext();

const baseData = {
    currency: 'EUR',
    amount: '123.55',
    iban: 'HR1210010051863000160',
    model: 'HR01',
    reference: '7269-68499637766-00019',
    receiverName: '2DBK d.d.',
    description: 'Troškovi za 1. mjesec'
};

test('formatPaymentString emits 14 LF-separated fields per HUB 3A spec', () => {
    const fields = hub3Generator.formatPaymentString({ ...baseData }).split('\n');
    assert.strictEqual(fields.length, 14, 'exactly 14 positional fields');
    assert.strictEqual(fields[0], 'HRVHUB30', 'header');
    assert.strictEqual(fields[1], 'EUR', 'currency (field 2)');
    assert.strictEqual(fields[9], 'HR1210010051863000160', 'recipient IBAN (field 10)');
    assert.strictEqual(fields[10], 'HR01', 'recipient model (field 11)');
    assert.strictEqual(fields[11], '7269-68499637766-00019', 'recipient reference (field 12)');
    assert.strictEqual(fields[13], 'Troškovi za 1. mjesec', 'description (field 14)');
});

test('purpose code is empty when not provided (no hardcoded GDSV)', () => {
    const fields = hub3Generator.formatPaymentString({ ...baseData }).split('\n');
    assert.strictEqual(fields[12], '', 'field 13 (šifra namjene) must be empty, not a hardcoded GDSV');
});

test('purpose code is emitted when provided on the data object', () => {
    const fields = hub3Generator.formatPaymentString({ ...baseData, purposeCode: 'COST' }).split('\n');
    assert.strictEqual(fields[12], 'COST');
});
