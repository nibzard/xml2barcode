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
        CONSTANTS: vm.runInContext('CONSTANTS', ctx),
    };
}

module.exports = { loadParserContext };
