/**
 * ABOUTME: Test harness that loads the browser-global parser modules into Node
 * ABOUTME: Stubs DOMParser/debug/i18n so text-parser + xml-parser run without a DOM
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadParserContext() {
    const root = path.resolve(__dirname, '..');
    const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

    // Minimal stubs for the browser globals the modules reference at load/runtime.
    // DOMParser: only the constructor runs when xml-parser.js loads (parseFromString is
    // never called by the text path). debug/i18n: provide no-op / identity stubs.
    const sandbox = {
        console,
        DOMParser: class { parseFromString() { return null; } },
        debug: { info() {}, warn() {}, error() {}, log() {} },
        i18n: { t: (key) => key },
    };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(read('js/constants.js'), ctx);
    vm.runInContext(read('js/xml-parser.js'), ctx);
    vm.runInContext(read('js/text-parser.js'), ctx);

    // Top-level `const`/`class` bindings live in the context's shared lexical scope;
    // evaluate them as expressions to pull the values back out to Node.
    return {
        textParser: vm.runInContext('textParser', ctx),
        TextParser: vm.runInContext('TextParser', ctx),
        xmlParser: vm.runInContext('xmlParser', ctx),
        XMLParser: vm.runInContext('XMLParser', ctx),
        CONSTANTS: vm.runInContext('CONSTANTS', ctx),
    };
}

// Loads constants + xml-parser + the pure iban-trust module (no DOM/storage needed;
// history is passed in by the caller). Used by the IBAN-trust unit/integration tests.
function loadTrustContext() {
    const root = path.resolve(__dirname, '..');
    const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

    const sandbox = {
        console,
        DOMParser: class { parseFromString() { return null; } },
        debug: { info() {}, warn() {}, error() {}, log() {} },
        i18n: { t: (key) => key },
    };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(read('js/constants.js'), ctx);
    vm.runInContext(read('js/xml-parser.js'), ctx);
    vm.runInContext(read('js/iban-trust.js'), ctx);

    return {
        xmlParser: vm.runInContext('xmlParser', ctx),
        ibanTrust: vm.runInContext('ibanTrust', ctx),
        IbanTrust: vm.runInContext('IbanTrust', ctx),
        composeTrustMessages: vm.runInContext('composeTrustMessages', ctx),
        buildDisplayMessages: vm.runInContext('buildDisplayMessages', ctx),
        messagesToHtml: vm.runInContext('messagesToHtml', ctx),
        CONSTANTS: vm.runInContext('CONSTANTS', ctx),
    };
}

function loadGeneratorContext() {
    const root = path.resolve(__dirname, '..');
    const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

    // formatPaymentString is pure (no DOM/bwipjs), but provide stubs anyway in case
    // generate()/render() are ever exercised. The HUB3Generator constructor is DOM-free.
    const sandbox = {
        console,
        DOMParser: class { parseFromString() { return null; } },
        debug: { info() {}, warn() {}, error() {}, log() {} },
        i18n: { t: (key) => key },
        document: { createElement() { return {}; } },
        bwipjs: {},
    };

    const ctx = vm.createContext(sandbox);
    vm.runInContext(read('js/constants.js'), ctx);
    vm.runInContext(read('js/hub3-generator.js'), ctx);

    return { hub3Generator: vm.runInContext('hub3Generator', ctx) };
}

module.exports = { loadParserContext, loadGeneratorContext, loadTrustContext };
