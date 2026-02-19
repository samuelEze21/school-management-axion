/** Get parameter names from a function (for __paramName middleware resolution). */
function getParamNames(fn) {
    if (typeof fn !== 'function') return [];
    const match = fn.toString().match(/\(([^)]*)\)/);
    if (!match) return [];
    return match[1]
        .split(',')
        .map((s) => s.trim().replace(/\s*=.*$/, ''))
        .filter(Boolean);
}

module.exports = getParamNames;
