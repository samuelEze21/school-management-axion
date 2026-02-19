/**
 * SharkFin - workflow/actions runner. Stub for compatibility.
 */
module.exports = class SharkFin {
    constructor({ layers, actions, ...injectable } = {}) {
        this.layers = layers || [];
        this.actions = actions || {};
        this.injectable = injectable;
    }
};
