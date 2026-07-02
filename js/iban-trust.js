/**
 * ABOUTME: Pure IBAN-trust heuristics that turn localStorage history into soft safety signals
 * ABOUTME: Cautions on unfamiliar IBANs and warns on IBAN/name mismatches; never asserts verification
 */

/**
 * Compare payee names the way a human would: accent-, case-, and whitespace-insensitive.
 * Needed because the same Croatian payee can appear as "Čakavica d.o.o." / "cakavica d.o.o".
 */
function normalizePayeeName(s) {
    return (s || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

class IbanTrust {
    /**
     * Decide what (if anything) the UI should say about this IBAN given the user's
     * barcode-generation history.
     *
     * Familiarity uses `matches - 1` because storage.add() inserts the current invoice
     * before the UI renders it, so the current IBAN is always present once; subtracting
     * that self-match avoids flagging every first generation as "familiar". The result
     * can only ever err toward "unfamiliar" (an extra caution), never toward a false
     * "familiar" — which is the safe direction.
     *
     * @param {string} iban          IBAN from the invoice currently being displayed.
     * @param {string} supplierName  Payee name for the current invoice.
     * @param {Array}  history       storage.getAll(); items carry {iban, supplierName}.
     */
    evaluate(iban, supplierName, history) {
        const normIban = xmlParser.normalizeIBAN(iban);
        const matches = normIban
            ? (history || []).filter((h) => h && xmlParser.normalizeIBAN(h.iban) === normIban)
            : [];

        const priorCount = Math.max(0, matches.length - 1);
        const currentName = normalizePayeeName(supplierName);

        // Distinct payee names ever associated with this IBAN (including the current one).
        // More than one distinct name means the IBAN has been used under a different payee.
        const seenByNorm = new Map(); // normalized name -> original display name
        for (const m of matches) {
            const original = (m && m.supplierName) || '';
            const n = normalizePayeeName(original);
            if (n && !seenByNorm.has(n)) seenByNorm.set(n, original);
        }

        let otherPayeeName = null;
        if (seenByNorm.size > 1) {
            for (const [n, original] of seenByNorm) {
                if (n !== currentName) { otherPayeeName = original; break; }
            }
        }

        // A representative name to cite: prefer the current payee, else any known one.
        const knownPayeeName = matches.length
            ? (seenByNorm.get(currentName) || [...seenByNorm.values()][0])
            : null;

        return {
            matchCount: matches.length,
            priorCount,
            isFamiliar: priorCount >= 1,
            nameMismatch: seenByNorm.size > 1,
            otherPayeeName,
            knownPayeeName
        };
    }
}

/**
 * Map an evaluation to a single, mutually-exclusive UI message:
 *   name mismatch (warning) > familiar (muted info) > unfamiliar (caution).
 * Deliberately no green / no checkmark / no "trusted" wording — localStorage history is
 * recognition, not verification (see Confirmation-of-Payee patterns for the contrast).
 */
function composeTrustMessages(ev, t) {
    if (!ev) return [];
    if (ev.nameMismatch && ev.otherPayeeName != null) {
        return [{ level: 'warning', text: t('warningIbanNameMismatch').replace('{name}', ev.otherPayeeName) }];
    }
    if (ev.isFamiliar && ev.knownPayeeName) {
        return [{ level: 'info', text: t('noticeKnownIban').replace('{name}', ev.knownPayeeName) }];
    }
    return [{ level: 'caution', text: t('cautionNewPayee') }];
}

/**
 * Merge the parser's own warnings (always 'warning' severity) with the IBAN-trust signal.
 * `data` is the invoice-data object ({iban, supplierName, warnings}); `history` is
 * storage.getAll(). The trust signal is skipped entirely when there is no IBAN, so the
 * missing-IBAN warning stands alone instead of being followed by a noisy "new payee".
 */
function buildDisplayMessages(data, history, t) {
    const messages = [];
    const warnings = (data && data.warnings) || [];
    for (const w of warnings) messages.push({ level: 'warning', text: w });

    if (data && data.iban) {
        const ev = ibanTrust.evaluate(data.iban, data.supplierName, history);
        for (const m of composeTrustMessages(ev, t)) messages.push(m);
    }
    return messages;
}

/**
 * Render messages to an HTML list string. `escape` is the caller's HTML-escaper (ui.escapeHtml)
 * so this stays pure and DOM-free for testing.
 */
function messagesToHtml(messages, escape) {
    const items = (messages || [])
        .map((m) => `<li class="msg-${m.level}">${escape(m.text)}</li>`)
        .join('');
    return `<ul>${items}</ul>`;
}

const ibanTrust = new IbanTrust();
